import express from "express";

import { listOrders, updateOrderStatus } from "../controllers/orderController.js";
import protect from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", protect, listOrders);
router.put("/:id/status", protect, updateOrderStatus);

export default router;
