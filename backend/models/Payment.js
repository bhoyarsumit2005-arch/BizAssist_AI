import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema({
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Business",
    required: true,
    index: true
  },

  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Order",
    required: true,
    index: true
  },

  amount: {
    type: Number,
    required: true,
    min: 0,
    max: 100000000
  },

  method: {
    type: String,
    enum: ["cash", "upi", "card", "bank_transfer", "other"],
    default: "cash"
  },

  status: {
    type: String,
    enum: ["pending", "paid", "failed", "refunded"],
    default: "pending"
  },

  reference: String,

  paidAt: Date,

  notes: String
}, {
  timestamps: true
});

paymentSchema.index({ businessId: 1, createdAt: -1 });

export default mongoose.model("Payment", paymentSchema);
