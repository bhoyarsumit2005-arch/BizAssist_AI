import express from "express";

import { createOrder, listOrders, recordPayment, updateOrderStatus } from "../controllers/orderController.js";
import protect from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", protect, listOrders);
router.post("/", protect, createOrder);
router.post("/:id/payment", protect, recordPayment);
router.put("/:id/status", protect, updateOrderStatus);

export default router;
