import Order from "../models/Order.js";
import { getBusinessId } from "../utils/businessScope.js";

/** GET /api/orders — only this business's orders, newest first. */
export const listOrders = async (req, res) => {
  try {
    const businessId = getBusinessId(req, res);
    if (!businessId) return;

    const filter = { businessId };

    // Optional filter: /api/orders?status=delivered
    if (req.query.status) {
      const status = String(req.query.status);
      const allowed = Order.schema.path("status").enumValues;

      if (!allowed.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Status must be one of: ${allowed.join(", ")}`
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
