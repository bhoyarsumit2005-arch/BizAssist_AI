import express from "express";

import {
  getSettings,
  updateAiSettings,
  updateWhatsAppSettings
} from "../controllers/settingsController.js";
import protect from "../middleware/authMiddleware.js";
import { requireOwner } from "../middleware/authorize.js";

const router = express.Router();

// Settings include the WhatsApp verify token and business policy, so they are
// owner-only in both directions.
router.use(protect, requireOwner);

router.get("/", getSettings);
router.put("/ai", updateAiSettings);
router.put("/whatsapp", updateWhatsAppSettings);

export default router;
