import express from "express";

import {
  listConversations,
  listMessages,
  sendMessage,
  updateConversation
} from "../controllers/conversationController.js";
import protect from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", protect, listConversations);
router.get("/:id/messages", protect, listMessages);
router.put("/:id", protect, updateConversation);
router.post("/:id/messages", protect, sendMessage);

export default router;
