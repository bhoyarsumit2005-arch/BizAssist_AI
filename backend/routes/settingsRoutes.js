import express from "express";

import {
  getSettings,
  updateAiSettings
} from "../controllers/settingsController.js";
import protect from "../middleware/authMiddleware.js";
import { requireOwner } from "../middleware/authorize.js";

const router = express.Router();

// Settings are owner-only in both directions.
router.use(protect, requireOwner);

router.get("/", getSettings);
router.put("/ai", updateAiSettings);

export default router;
