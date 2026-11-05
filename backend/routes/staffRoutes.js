import express from "express";

import {
  createStaff,
  deleteStaff,
  listStaff,
  updateStaff
} from "../controllers/staffController.js";
import protect from "../middleware/authMiddleware.js";
import { requireOwner } from "../middleware/authorize.js";

const router = express.Router();

// Team management is always owner-only.
router.use(protect, requireOwner);

router.get("/", listStaff);
router.post("/", createStaff);
router.put("/:id", updateStaff);
router.delete("/:id", deleteStaff);

export default router;
