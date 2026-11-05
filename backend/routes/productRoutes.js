import express from "express";

import {
  createProduct,
  deleteProduct,
  listProducts,
  updateProduct
} from "../controllers/productController.js";
import protect from "../middleware/authMiddleware.js";
import { requireOwner } from "../middleware/authorize.js";

const router = express.Router();

// Staff can read the catalogue while fulfilling orders, but only owners
// change prices, stock, or delete products.
router.get("/", protect, listProducts);
router.post("/", protect, requireOwner, createProduct);
router.put("/:id", protect, requireOwner, updateProduct);
router.delete("/:id", protect, requireOwner, deleteProduct);

export default router;
