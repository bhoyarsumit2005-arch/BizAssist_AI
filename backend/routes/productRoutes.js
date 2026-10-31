import express from "express";

import {
  listProducts,
  createProduct,
  updateProduct,
  deleteProduct
} from "../controllers/productController.js";
import protect from "../middleware/authMiddleware.js";

const router = express.Router();

// Every route requires a valid JWT; controllers scope queries by
// req.user.businessId.
router.get("/", protect, listProducts);
router.post("/", protect, createProduct);
router.put("/:id", protect, updateProduct);
router.delete("/:id", protect, deleteProduct);

export default router;
