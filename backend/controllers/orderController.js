import mongoose from "mongoose";

import Customer from "../models/Customer.js";
import Order from "../models/Order.js";
import Payment from "../models/Payment.js";
import Product from "../models/Product.js";
import { getBusinessId } from "../utils/businessScope.js";
import { isTransactionUnsupported } from "../utils/mongoTransactions.js";
import { LIMITS, readInteger } from "../utils/validation.js";

/**
 * The only moves an order is allowed to make. Cancellation is deliberately
 * limited to the stages before dispatch: once goods have left the business a
 * cancellation has to be handled as a return, not a stock restore.
 */
const STATUS_TRANSITIONS = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["processing", "cancelled"],
  processing: ["dispatched", "cancelled"],
  dispatched: ["delivered"],
  delivered: [],
  cancelled: []
};

const ORDER_STATUSES = Order.schema.path("status").enumValues;

const httpError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const roundCurrency = (value) => Math.round(value * 100) / 100;

const populateOrder = (query) => query.populate("customerId", "name phone");

/** Validate and normalise the client's item list before touching the database. */
const parseItems = (rawItems) => {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw httpError(400, "An order needs at least one item");
  }

  if (rawItems.length > LIMITS.orderItems) {
    throw httpError(400, `An order can contain at most ${LIMITS.orderItems} items`);
  }

  const seen = new Set();

  return rawItems.map((raw) => {
    const productId = String(raw?.productId ?? "");

    if (!mongoose.isValidObjectId(productId)) {
      throw httpError(400, "Each item needs a valid productId");
    }

    if (seen.has(productId)) {
      throw httpError(400, "Each product can appear only once in an order");
    }
    seen.add(productId);

    const quantity = readInteger(raw?.quantity, "quantity", {
      min: 1,
      max: LIMITS.orderQuantityMax
    });

    return { productId, quantity };
  });
};

/**
 * Load the requested products for this business and snapshot their current
 * name/price. Client-supplied prices and totals are never trusted — they are
 * simply not read from the request body.
 */
const buildLineItems = async ({ businessId, items }) => {
  const products = await Product.find({
    _id: { $in: items.map((item) => item.productId) },
    businessId
  });

  const byId = new Map(products.map((product) => [product._id.toString(), product]));

  return items.map(({ productId, quantity }) => {
    const product = byId.get(productId);

    if (!product || !product.isActive) {
      throw httpError(400, "One or more products are unavailable or inactive");
    }

    if (product.stock < quantity) {
      throw httpError(409, `Not enough stock for ${product.name}`);
    }

    return {
      productId: product._id,
      name: product.name,
      quantity,
      price: product.price
    };
  });
};

/** Atomically take stock. Returns the products that were decremented. */
const decrementStock = async ({ businessId, lineItems, session, decremented = [] }) => {
  for (const item of lineItems) {
    const product = await Product.findOneAndUpdate(
      {
        _id: item.productId,
        businessId,
        isActive: true,
        stock: { $gte: item.quantity }
      },
      { $inc: { stock: -item.quantity } },
      { returnDocument: "after", session }
    );

    if (!product) {
      throw httpError(409, `Not enough stock for ${item.name}`);
    }

    // The caller passes an accumulator so a failure part-way through the
    // fallback path can still compensate the lines that did succeed.
    decremented.push(item);
  }

  return decremented;
};

/**
 * Exactly-once stock restore for the non-transaction fallback. The marker and
 * the increment live on the same product document, so MongoDB applies them
 * together: a retry sees `stockRestoredFor` already contains the order and
 * changes nothing.
 */
const restoreStockOnce = async ({ businessId, orderId, lineItems }) => {
  for (const item of lineItems) {
    if (!item.productId || !(item.quantity > 0)) continue;

    await Product.updateOne(
      {
        _id: item.productId,
        businessId,
        stockRestoredFor: { $ne: orderId }
      },
      {
        $inc: { stock: item.quantity },
        $addToSet: { stockRestoredFor: orderId }
      }
    );
  }
};

/**
 * Finish a cancellation whose stock return may have been interrupted: restore
 * every line idempotently, then mark the order done only after all of them
 * succeeded.
 */
const finishCancellation = async ({ businessId, order }) => {
  if (!order.stockDeducted) return;

  await restoreStockOnce({
    businessId,
    orderId: order._id,
    lineItems: order.items
  });

  await Order.updateOne(
    { _id: order._id, businessId, status: "cancelled", stockRestored: { $ne: true } },
    { $set: { stockRestored: true } }
  );
};

/**
 * Restore stock as part of a transaction (or as best-effort compensation when
 * an order creation fails). Cancellation recovery uses restoreStockOnce
 * instead, because it must be idempotent outside a transaction.
 */
const restoreStock = async ({ businessId, lineItems, session }) => {
  for (const item of lineItems) {
    if (!item.productId || !(item.quantity > 0)) continue;

    const result = await Product.updateOne(
      { _id: item.productId, businessId },
      { $inc: { stock: item.quantity } },
      { session }
    );

    // A deleted product has no stock left to care about; don't block a
    // cancellation because of it.
    if (result.matchedCount === 0) {
      console.warn(`Could not restore stock for deleted product ${item.productId}`);
    }
  }
};

const createOrderInTransaction = async ({ businessId, customerId, lineItems, totalAmount }) => {
  let orderId = null;
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      // Reset in case the driver retries the callback.
      orderId = null;

      await decrementStock({ businessId, lineItems, session });

      const [order] = await Order.create(
        [
          {
            businessId,
            customerId,
            items: lineItems,
            totalAmount,
            status: "pending",
            paymentStatus: "unpaid",
            stockDeducted: true,
            stockRestored: false
          }
        ],
        { session }
      );

      orderId = order._id;
    });
  } finally {
    await session.endSession();
  }

  return populateOrder(Order.findById(orderId));
};

const createOrderWithoutTransactions = async ({ businessId, customerId, lineItems, totalAmount }) => {
  const decremented = [];

  try {
    await decrementStock({ businessId, lineItems, decremented });

    const order = await Order.create({
      businessId,
      customerId,
      items: lineItems,
      totalAmount,
      status: "pending",
      paymentStatus: "unpaid",
      stockDeducted: true,
      stockRestored: false
    });

    return populateOrder(Order.findById(order._id));
  } catch (error) {
    if (decremented.length) {
      await restoreStock({ businessId, lineItems: decremented }).catch((restoreError) => {
        console.error("Order create stock compensation failed:", restoreError);
      });
    }

    throw error;
  }
};

const createOrderWithStock = async (payload) => {
  try {
    return await createOrderInTransaction(payload);
  } catch (error) {
    if (!isTransactionUnsupported(error)) throw error;

    // The rejected transaction wrote nothing, so it is safe to retry with
    // explicit compensation.
    return createOrderWithoutTransactions(payload);
  }
};

/**
 * POST /api/orders
 * Body: { customerId, items: [{ productId, quantity }] }
 * Prices, totals, status and payment status are always computed server-side.
 */
export const createOrder = async (req, res) => {
  try {
    const businessId = getBusinessId(req, res);
    if (!businessId) return;

    const body = req.body || {};

    const customerId = String(body.customerId ?? "");
    if (!mongoose.isValidObjectId(customerId)) {
      return res.status(400).json({ success: false, message: "A valid customerId is required" });
    }

    const items = parseItems(body.items);

    const customer = await Customer.findOne({ _id: customerId, businessId });
    if (!customer) {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }
    if (customer.isActive === false) {
      return res.status(400).json({ success: false, message: "This customer is inactive" });
    }

    const lineItems = await buildLineItems({ businessId, items });
    const totalAmount = roundCurrency(
      lineItems.reduce((total, item) => total + item.price * item.quantity, 0)
    );

    if (!Number.isFinite(totalAmount) || totalAmount < 0 || totalAmount > LIMITS.orderTotalMax) {
      return res.status(400).json({
        success: false,
        message: `Order total must be between 0 and ${LIMITS.orderTotalMax}`
      });
    }

    const order = await createOrderWithStock({
      businessId,
      customerId,
      lineItems,
      totalAmount
    });

    return res.status(201).json({ success: true, message: "Order created", order });
  } catch (error) {
    if (error?.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }

    if (error?.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: Object.values(error.errors).map((item) => item.message).join(", ")
      });
    }

    console.error("Create order error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

/** GET /api/orders — only this business's orders, newest first. */
export const listOrders = async (req, res) => {
  try {
    const businessId = getBusinessId(req, res);
    if (!businessId) return;

    const filter = { businessId };

    // Optional filter: /api/orders?status=delivered
    if (req.query.status) {
      const status = String(req.query.status);

      if (!ORDER_STATUSES.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Status must be one of: ${ORDER_STATUSES.join(", ")}`
        });
      }

      filter.status = status;
    }

    const orders = await Order.find(filter)
      .populate("customerId", "name phone")
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, orders });
  } catch (error) {
    console.error("List orders error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

const assertTransition = (currentStatus, nextStatus) => {
  if (currentStatus === nextStatus) return false;

  const allowed = STATUS_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(nextStatus)) {
    throw httpError(
      409,
      `Cannot move an order from ${currentStatus} to ${nextStatus}`
    );
  }

  return true;
};

const updateStatusInTransaction = async ({ businessId, id, nextStatus }) => {
  let result = null;
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      result = null;

      const order = await Order.findOne({ _id: id, businessId }).session(session);
      if (!order) throw httpError(404, "Order not found");

      if (!assertTransition(order.status, nextStatus)) {
        result = await populateOrder(Order.findById(order._id).session(session));
        return;
      }

      const restore = nextStatus === "cancelled" && order.stockDeducted && !order.stockRestored;

      // Conditional on the status we just read: a concurrent update causes
      // this write (and therefore the whole transaction) to conflict instead
      // of both requests restoring the same stock.
      const update = { status: nextStatus };
      if (restore) update.stockRestored = true;

      const claimed = await Order.updateOne(
        { _id: order._id, businessId, status: order.status },
        { $set: update },
        { session }
      );

      if (claimed.modifiedCount !== 1) {
        throw httpError(409, "This order changed while you were updating it. Refresh and try again.");
      }

      if (restore) {
        await restoreStock({ businessId, lineItems: order.items, session });
      }

      result = await populateOrder(Order.findById(order._id).session(session));
    });
  } finally {
    await session.endSession();
  }

  return result;
};

const updateStatusWithoutTransactions = async ({ businessId, id, nextStatus }) => {
  const order = await Order.findOne({ _id: id, businessId });
  if (!order) throw httpError(404, "Order not found");

  if (!assertTransition(order.status, nextStatus)) {
    // A previous cancellation may have been interrupted between claiming the
    // status and returning the stock. Retrying the same request finishes it.
    if (order.status === "cancelled" && order.stockDeducted && !order.stockRestored) {
      await finishCancellation({ businessId, order });
    }

    return populateOrder(Order.findById(order._id));
  }

  // Claim the transition first so two requests cannot both cancel. The stock
  // flag is only set after the idempotent restore below succeeds.
  const claimed = await Order.updateOne(
    { _id: order._id, businessId, status: order.status },
    { $set: { status: nextStatus } }
  );

  if (claimed.modifiedCount !== 1) {
    throw httpError(409, "This order changed while you were updating it. Refresh and try again.");
  }

  if (nextStatus === "cancelled" && order.stockDeducted) {
    await finishCancellation({
      businessId,
      order: { ...order.toObject(), status: nextStatus }
    });
  }

  return populateOrder(Order.findById(order._id));
};

const updateStatusWithStock = async (payload) => {
  try {
    return await updateStatusInTransaction(payload);
  } catch (error) {
    if (!isTransactionUnsupported(error)) throw error;

    // The rejected transaction wrote nothing, so retry with explicit
    // compensation.
    return updateStatusWithoutTransactions(payload);
  }
};

/**
 * Repairs cancellations interrupted between claiming the status and returning
 * stock. Safe to run repeatedly: restoreStockOnce is idempotent per product.
 * Called at startup and after a retried cancellation.
 */
export const repairStockRestores = async ({ limit = 100 } = {}) => {
  const orders = await Order.find({
    status: "cancelled",
    stockDeducted: true,
    stockRestored: false
  }).limit(limit);

  let repaired = 0;

  for (const order of orders) {
    try {
      await finishCancellation({ businessId: order.businessId, order });
      repaired += 1;
    } catch (error) {
      console.error(`Stock restore repair failed for order ${order._id}:`, error);
    }
  }

  return repaired;
};

const PAYMENT_METHODS = Payment.schema.path("method").enumValues;

const readOptionalText = (value, field, maxLength) => {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") {
    throw httpError(400, `${field} must be a string`);
  }
  const text = value.trim();
  if (text.length > maxLength) {
    throw httpError(400, `${field} must be ${maxLength} characters or fewer`);
  }
  return text;
};

/** Validate a full payment against the order's server-computed total. */
const buildPaymentFields = (order, body) => {
  if (order.status === "cancelled") {
    throw httpError(409, "A cancelled order cannot be paid");
  }

  if (order.paymentStatus === "paid") {
    throw httpError(409, "This order is already paid");
  }

  const total = Number(order.totalAmount) || 0;
  if (total <= 0) {
    throw httpError(400, "Order total must be greater than zero");
  }

  const amount = body.amount === undefined ? total : Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw httpError(400, "amount must be a number greater than zero");
  }
  if (Math.abs(amount - total) > 0.01) {
    throw httpError(400, `Payment amount must equal the order total (${total})`);
  }

  const method = body.method === undefined ? "cash" : body.method;
  if (!PAYMENT_METHODS.includes(method)) {
    throw httpError(400, `method must be one of: ${PAYMENT_METHODS.join(", ")}`);
  }

  return {
    amount: total,
    method,
    status: "paid",
    paidAt: new Date(),
    reference: readOptionalText(body.reference, "reference", 200),
    notes: readOptionalText(body.notes, "notes", 1000)
  };
};

const recordPaymentInTransaction = async ({ businessId, id, body }) => {
  let paymentId = null;
  let orderId = null;
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      paymentId = null;
      orderId = null;

      const order = await Order.findOne({ _id: id, businessId }).session(session);
      if (!order) throw httpError(404, "Order not found");

      const fields = buildPaymentFields(order, body);

      const [payment] = await Payment.create(
        [{ businessId, orderId: order._id, ...fields }],
        { session }
      );
      paymentId = payment._id;
      orderId = order._id;

      const updated = await Order.updateOne(
        {
          _id: order._id,
          businessId,
          status: { $ne: "cancelled" },
          paymentStatus: { $ne: "paid" }
        },
        { $set: { paymentStatus: "paid" } },
        { session }
      );

      if (updated.modifiedCount !== 1) {
        throw httpError(409, "This order changed while recording the payment. Refresh and try again.");
      }
    });
  } finally {
    await session.endSession();
  }

  return {
    order: await populateOrder(Order.findById(orderId)),
    payment: await Payment.findById(paymentId)
  };
};

const recordPaymentWithoutTransactions = async ({ businessId, id, body }) => {
  const order = await Order.findOne({ _id: id, businessId });
  if (!order) throw httpError(404, "Order not found");

  const fields = buildPaymentFields(order, body);
  const payment = await Payment.create({ businessId, orderId: order._id, ...fields });

  try {
    const updated = await Order.updateOne(
      {
        _id: order._id,
        businessId,
        status: { $ne: "cancelled" },
        paymentStatus: { $ne: "paid" }
      },
      { $set: { paymentStatus: "paid" } }
    );

    if (updated.modifiedCount !== 1) {
      throw httpError(409, "This order changed while recording the payment. Refresh and try again.");
    }
  } catch (error) {
    await Payment.deleteOne({ _id: payment._id }).catch((deleteError) => {
      console.error("Payment compensation failed:", deleteError);
    });
    throw error;
  }

  return {
    order: await populateOrder(Order.findById(order._id)),
    payment
  };
};

/** POST /api/orders/:id/payment — records a full payment and marks the order paid. */
export const recordPayment = async (req, res) => {
  try {
    const businessId = getBusinessId(req, res);
    if (!businessId) return;

    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid order id" });
    }

    const payload = { businessId, id, body: req.body || {} };
    let result;

    try {
      result = await recordPaymentInTransaction(payload);
    } catch (error) {
      if (!isTransactionUnsupported(error)) throw error;
      result = await recordPaymentWithoutTransactions(payload);
    }

    return res.status(201).json({
      success: true,
      message: "Payment recorded",
      order: result.order,
      payment: result.payment
    });
  } catch (error) {
    if (error?.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }

    if (error?.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: Object.values(error.errors).map((item) => item.message).join(", ")
      });
    }

    console.error("Record payment error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

/** PUT /api/orders/:id/status — scoped, state-machine-checked transition. */export const updateOrderStatus = async (req, res) => {
  try {
    const businessId = getBusinessId(req, res);
    if (!businessId) return;

    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid order id" });
    }

    const { status } = req.body || {};

    if (!ORDER_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Status must be one of: ${ORDER_STATUSES.join(", ")}`
      });
    }

    const order = await updateStatusWithStock({ businessId, id, nextStatus: status });

    return res.status(200).json({ success: true, message: "Order status updated", order });
  } catch (error) {
    if (error?.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }

    console.error("Update order status error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

export { ORDER_STATUSES, STATUS_TRANSITIONS };
