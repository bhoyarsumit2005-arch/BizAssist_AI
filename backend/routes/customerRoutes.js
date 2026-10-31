import express from "express";

import { listCustomers } from "../controllers/customerController.js";
import protect from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", protect, listCustomers);

export default router;
