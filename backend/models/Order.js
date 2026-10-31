import mongoose from "mongoose";

const orderSchema = new mongoose.Schema({
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },

  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Customer",
    required: true
  },

  items: [{
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product"
    },

    name: String,
    quantity: Number,
    price: Number
  }],

  totalAmount: {
    type: Number,
    required: true
  },

  status: {
    type: String,
    enum: [
      "pending",
      "confirmed",
      "processing",
      "dispatched",
      "delivered",
      "cancelled"
    ],
    default: "pending"
  },

  paymentStatus: {
    type: String,
    enum: ["unpaid", "pending", "paid", "refunded"],
    default: "unpaid"
  }
}, {
  timestamps: true
});

export default mongoose.model("Order", orderSchema);