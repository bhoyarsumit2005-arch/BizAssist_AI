import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Business",
    required: true,
    index: true
  },

  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Conversation",
    required: true,
    index: true
  },

  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Customer"
  },

  direction: {
    type: String,
    enum: ["incoming", "outgoing"],
    required: true
  },

  text: {
    type: String,
    required: true,
    trim: true,
    maxlength: 4096
  },

  aiGenerated: {
    type: Boolean,
    default: false
  },

  // Provider message id, used to match delivery/read status callbacks and to
  // ignore duplicate webhook deliveries.
  providerMessageId: {
    type: String,
    index: true
  },

  status: {
    type: String,
    enum: ["sent", "delivered", "read", "failed"],
    default: "sent"
  }
}, {
  timestamps: true
});

messageSchema.index({ conversationId: 1, createdAt: 1 });
messageSchema.index({ businessId: 1, providerMessageId: 1 });

export default mongoose.model("Message", messageSchema);
