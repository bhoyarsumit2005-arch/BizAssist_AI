import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema({
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Business",
    required: true,
    index: true
  },

  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Customer",
    required: true,
    index: true
  },

  channel: {
    type: String,
    enum: ["web", "manual"],
    default: "manual"
  },

  status: {
    type: String,
    enum: ["open", "resolved", "archived"],
    default: "open"
  },

  lastMessage: {
    type: String,
    maxlength: 4096
  },

  lastMessageAt: Date,

  unreadCount: {
    type: Number,
    default: 0,
    min: 0
  }
}, {
  timestamps: true
});

conversationSchema.index({ businessId: 1, lastMessageAt: -1 });
conversationSchema.index({ businessId: 1, customerId: 1 });

export default mongoose.model("Conversation", conversationSchema);
