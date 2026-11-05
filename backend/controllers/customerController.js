import mongoose from "mongoose";

import Customer from "../models/Customer.js";
import { getBusinessId } from "../utils/businessScope.js";
import {
  isValidEmail,
  LIMITS,
  readText
} from "../utils/validation.js";

/** GET /api/customers — only this business's customers, newest first. */
export const listCustomers = async (req, res) => {
  try {
    const businessId = getBusinessId(req, res);
    if (!businessId) return;

    const customers = await Customer.find({ businessId }).sort({ createdAt: -1 });

    return res.status(200).json({ success: true, customers });
  } catch (error) {
    console.error("List customers error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

/**
 * Whitelisted create fields. `businessId`, `_id` and status fields are never
 * read from the body.
 */
const buildCustomerFields = (body) => {
  const fields = {};

  fields.name = readText(body.name, "name", { max: LIMITS.customerName, required: true });

  if (body.phone !== undefined && body.phone !== null) {
    const phone = readText(body.phone, "phone", { max: LIMITS.phone });
    if (phone) fields.phone = phone;
  }

  if (body.email !== undefined && body.email !== null) {
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (email) {
      if (!isValidEmail(email)) {
        throw { status: 400, message: "Enter a valid email address" };
      }
      fields.email = email;
    }
  }

  if (body.address !== undefined && body.address !== null) {
    const address = readText(body.address, "address", { max: LIMITS.customerAddress });
    if (address) fields.address = address;
  }

  if (body.notes !== undefined && body.notes !== null) {
    const notes = readText(body.notes, "notes", { max: LIMITS.customerNotes });
    if (notes) fields.notes = notes;
  }

  return fields;
};

const buildCustomerUpdate = (body) => {
  const fields = {};

  if (body.name !== undefined) {
    fields.name = readText(body.name, "name", { max: LIMITS.customerName, required: true });
  }

  if (body.phone !== undefined && body.phone !== null) {
    fields.phone = readText(body.phone, "phone", { max: LIMITS.phone }) || "";
  }

  if (body.email !== undefined && body.email !== null) {
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (email && !isValidEmail(email)) {
      throw { status: 400, message: "Enter a valid email address" };
    }
    fields.email = email;
  }

  if (body.address !== undefined && body.address !== null) {
    fields.address = readText(body.address, "address", { max: LIMITS.customerAddress }) || "";
  }

  if (body.notes !== undefined && body.notes !== null) {
    fields.notes = readText(body.notes, "notes", { max: LIMITS.customerNotes }) || "";
  }

  if (body.isActive !== undefined) {
    if (typeof body.isActive !== "boolean") {
      throw { status: 400, message: "isActive must be true or false" };
    }
    fields.isActive = body.isActive;
  }

  return fields;
};

const handleCustomerError = (error, res, action) => {
  if (error?.status) {
    return res.status(error.status).json({ success: false, message: error.message });
  }

  if (error?.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      message: Object.values(error.errors).map((item) => item.message).join(", ")
    });
  }

  console.error(`${action} error:`, error);
  return res.status(500).json({ success: false, message: "Something went wrong" });
};

/** POST /api/customers */
export const createCustomer = async (req, res) => {
  try {
    const businessId = getBusinessId(req, res);
    if (!businessId) return;

    const fields = buildCustomerFields(req.body || {});

    if (fields.phone) {
      const duplicate = await Customer.exists({ businessId, phone: fields.phone });
      if (duplicate) {
        return res.status(409).json({
          success: false,
          message: "A customer with this phone already exists"
        });
      }
    }

    const customer = await Customer.create({ ...fields, businessId });

    return res.status(201).json({ success: true, message: "Customer created", customer });
  } catch (error) {
    return handleCustomerError(error, res, "Create customer");
  }
};

/** PUT /api/customers/:id — tenant-scoped update. */
export const updateCustomer = async (req, res) => {
  try {
    const businessId = getBusinessId(req, res);
    if (!businessId) return;

    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid customer id" });
    }

    const fields = buildCustomerUpdate(req.body || {});
    if (!Object.keys(fields).length) {
      return res.status(400).json({ success: false, message: "No fields to update" });
    }

    if (fields.phone) {
      const duplicate = await Customer.exists({
        businessId,
        phone: fields.phone,
        _id: { $ne: id }
      });
      if (duplicate) {
        return res.status(409).json({
          success: false,
          message: "A customer with this phone already exists"
        });
      }
    }

    const customer = await Customer.findOneAndUpdate(
      { _id: id, businessId },
      { $set: fields },
      { returnDocument: "after", runValidators: true }
    );

    if (!customer) {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }

    return res.status(200).json({ success: true, message: "Customer updated", customer });
  } catch (error) {
    return handleCustomerError(error, res, "Update customer");
  }
};

/**
 * DELETE /api/customers/:id
 * Archived rather than erased so historical orders and conversations keep
 * pointing at the real customer record.
 */
export const deleteCustomer = async (req, res) => {
  try {
    const businessId = getBusinessId(req, res);
    if (!businessId) return;

    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid customer id" });
    }

    const customer = await Customer.findOneAndUpdate(
      { _id: id, businessId },
      { $set: { isActive: false } },
      { returnDocument: "after" }
    );

    if (!customer) {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Customer archived",
      customer
    });
  } catch (error) {
    return handleCustomerError(error, res, "Delete customer");
  }
};
