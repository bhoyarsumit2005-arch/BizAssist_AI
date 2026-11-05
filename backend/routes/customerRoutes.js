import express from "express";

import {
  createCustomer,
  deleteCustomer,
  listCustomers,
  updateCustomer
} from "../controllers/customerController.js";
import protect from "../middleware/authMiddleware.js";
import { requireOwner } from "../middleware/authorize.js";

const router = express.Router();

// Staff need to add and correct customer records while serving them; only an
// owner can archive a customer, which hides them from the working list.
router.get("/", protect, listCustomers);
router.post("/", protect, createCustomer);
router.put("/:id", protect, updateCustomer);
router.delete("/:id", protect, requireOwner, deleteCustomer);

export default router;
