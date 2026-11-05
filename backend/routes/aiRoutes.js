import express from "express";
import rateLimit from "express-rate-limit";

import { chat, health } from "../controllers/aiController.js";
import protect from "../middleware/authMiddleware.js";

const router = express.Router();

// Protect the local model from bursts. Keyed by client IP; the endpoint is
// already behind JWT auth.
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many AI requests. Please wait a minute and try again."
  }
});

router.post("/chat", protect, chatLimiter, chat);
router.get("/health", protect, health);

export default router;
