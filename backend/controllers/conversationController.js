import mongoose from "mongoose";

import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import { getBusinessId } from "../utils/businessScope.js";

const MAX_MESSAGE_LENGTH = 4096;

const shapeConversation = (document) => {
  const object = document.toObject ? document.toObject() : document;
  const customer = object.customerId && typeof object.customerId === "object" && object.customerId.name !== undefined
    ? object.customerId
    : null;

  return {
    ...object,
    customer,
    customerId: customer?._id || object.customerId
  };
};

const handleError = (error, res, action) => {
  if (error?.status) {
    return res.status(error.status).json({ success: false, message: error.message });
  }

  if (error?.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      message: Object.values(error.errors).map((item) => item.message).join(", ")
    });
  }

  console.error(`${action} error:`, error);
  return res.status(500).json({ success: false, message: "Something went wrong" });
};

/** GET /api/conversations?status=open */
export const listConversations = async (req, res) => {
  try {
    const businessId = getBusinessId(req, res);
    if (!businessId) return;

    const filter = { businessId };
    if (req.query.status) {
      const status = String(req.query.status);
      if (!["open", "resolved", "archived"].includes(status)) {
        return res.status(400).json({ success: false, message: "Invalid conversation status" });
      }
      filter.status = status;
    }

    const conversations = await Conversation.find(filter)
      .populate("customerId", "name phone email")
      .sort({ lastMessageAt: -1, createdAt: -1 });

    return res.status(200).json({
      success: true,
      conversations: conversations.map(shapeConversation)
    });
  } catch (error) {
    return handleError(error, res, "List conversations");
  }
};

/** GET /api/conversations/:id/messages */
export const listMessages = async (req, res) => {
  try {
    const businessId = getBusinessId(req, res);
    if (!businessId) return;

    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid conversation id" });
    }

    const conversation = await Conversation.findOne({ _id: id, businessId })
      .populate("customerId", "name phone email");

    if (!conversation) {
      return res.status(404).json({ success: false, message: "Conversation not found" });
    }

    const messages = await Message.find({ businessId, conversationId: conversation._id })
      .sort({ createdAt: 1 });

    if (conversation.unreadCount) {
      await Conversation.updateOne(
        { _id: conversation._id, businessId },
        { $set: { unreadCount: 0 } }
      );
    }

    return res.status(200).json({
      success: true,
      conversation: shapeConversation(conversation),
      messages
    });
  } catch (error) {
    return handleError(error, res, "List messages");
  }
};

/** PUT /api/conversations/:id — currently status changes only. */
export const updateConversation = async (req, res) => {
  try {
    const businessId = getBusinessId(req, res);
    if (!businessId) return;

    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid conversation id" });
    }

    const { status } = req.body || {};
    if (!["open", "resolved", "archived"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be one of: open, resolved, archived"
      });
    }

    const conversation = await Conversation.findOneAndUpdate(
      { _id: id, businessId },
      { $set: { status } },
      { returnDocument: "after" }
    ).populate("customerId", "name phone email");

    if (!conversation) {
      return res.status(404).json({ success: false, message: "Conversation not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Conversation updated",
      conversation: shapeConversation(conversation)
    });
  } catch (error) {
    return handleError(error, res, "Update conversation");
  }
};

/**
 * POST /api/conversations/:id/messages
 * Persists an outgoing message on the conversation.
 */
export const sendMessage = async (req, res) => {
  try {
    const businessId = getBusinessId(req, res);
    if (!businessId) return;

    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid conversation id" });
    }

    const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
    if (!text) {
      return res.status(400).json({ success: false, message: "Message text is required" });
    }
    if (text.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer`
      });
    }

    const conversation = await Conversation.findOne({ _id: id, businessId })
      .populate("customerId", "name phone");

    if (!conversation) {
      return res.status(404).json({ success: false, message: "Conversation not found" });
    }

    const message = await Message.create({
      businessId,
      conversationId: conversation._id,
      customerId: conversation.customerId?._id,
      direction: "outgoing",
      text,
      aiGenerated: false,
      status: "sent"
    });

    await Conversation.updateOne(
      { _id: conversation._id, businessId },
      {
        $set: {
          lastMessage: text,
          lastMessageAt: message.createdAt,
          unreadCount: 0
        }
      }
    );

    return res.status(201).json({ success: true, message: "Message sent", message });
  } catch (error) {
    return handleError(error, res, "Send message");
  }
};
