import mongoose from "mongoose";

import Product from "../models/Product.js";
import { getBusinessId } from "../utils/businessScope.js";
import { LIMITS, readInteger, readText } from "../utils/validation.js";

/**
 * Whitelisted upsert fields. `req.body` is never spread into the document,
 * so a client cannot set `businessId`, `_id` or any other trusted field.
 */
const buildProductFields = (body) => {
  const fields = {};

  if (body.name !== undefined) {
    const name = readText(body.name, "name", { max: LIMITS.productName, required: true });
    fields.name = name;
  }

  if (body.price !== undefined) {
    const price = Number(body.price);
    if (!Number.isFinite(price) || price < 0 || price > LIMITS.productPriceMax) {
      throw {
        status: 400,
        message: `Price must be a number between 0 and ${LIMITS.productPriceMax}`
      };
    }
    fields.price = price;
  }

  if (body.stock !== undefined) {
    fields.stock = readInteger(body.stock, "stock", { min: 0, max: LIMITS.productStockMax });
  }

  if (body.unit !== undefined) {
    fields.unit =
      readText(body.unit, "unit", { max: LIMITS.productUnit }) || "piece";
  }

  if (body.description !== undefined) {
    fields.description =
      readText(body.description, "description", { max: LIMITS.productDescription }) || "";
  }

  if (body.image !== undefined) {
    fields.image = readText(body.image, "image", { max: LIMITS.productImage }) || "";
  }

  if (body.isActive !== undefined) {
    if (typeof body.isActive !== "boolean") {
      throw { status: 400, message: "isActive must be a boolean" };
    }
    fields.isActive = body.isActive;
  }

  return fields;
};

const handleError = (error, res, action) => {
  if (error && error.status) {
    return res.status(error.status).json({ success: false, message: error.message });
  }

  if (error?.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      message: Object.values(error.errors).map((e) => e.message).join(", ")
    });
  }

  console.error(`${action} error:`, error);
  return res.status(500).json({ success: false, message: "Something went wrong" });
};

/** GET /api/products — only this business's products. */
export const listProducts = async (req, res) => {
  try {
    const businessId = getBusinessId(req, res);
    if (!businessId) return;

    const products = await Product.find({ businessId }).sort({ createdAt: -1 });

    return res.status(200).json({ success: true, products });
  } catch (error) {
    return handleError(error, res, "List products");
  }
};

/** POST /api/products */
export const createProduct = async (req, res) => {
  try {
    const businessId = getBusinessId(req, res);
    if (!businessId) return;

    const fields = buildProductFields(req.body || {});

    if (!fields.name) {
      return res.status(400).json({ success: false, message: "Product name is required" });
    }
    if (fields.price === undefined) {
      return res.status(400).json({ success: false, message: "Product price is required" });
    }

    // businessId comes from the token, not the request.
    const product = await Product.create({ ...fields, businessId });

    return res.status(201).json({ success: true, message: "Product created", product });
  } catch (error) {
    return handleError(error, res, "Create product");
  }
};

/** PUT /api/products/:id — scoped update: another tenant's id simply 404s. */
export const updateProduct = async (req, res) => {
  try {
    const businessId = getBusinessId(req, res);
    if (!businessId) return;

    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid product id" });
    }

    const fields = buildProductFields(req.body || {});
    if (Object.keys(fields).length === 0) {
      return res.status(400).json({ success: false, message: "No fields to update" });
    }

    const product = await Product.findOneAndUpdate(
      { _id: id, businessId },
      { $set: fields },
      { returnDocument: "after", runValidators: true }
    );

    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    return res.status(200).json({ success: true, message: "Product updated", product });
  } catch (error) {
    return handleError(error, res, "Update product");
  }
};

/** DELETE /api/products/:id */
export const deleteProduct = async (req, res) => {
  try {
    const businessId = getBusinessId(req, res);
    if (!businessId) return;

    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid product id" });
    }

    const product = await Product.findOneAndDelete({ _id: id, businessId });

    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    return res.status(200).json({ success: true, message: "Product deleted" });
  } catch (error) {
    return handleError(error, res, "Delete product");
  }
};
