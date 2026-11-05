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

    name: {
      type: String,
      maxlength: 120
    },
    quantity: {
      type: Number,
      min: 1,
      max: 10000,
      validate: {
        validator: Number.isInteger,
        message: "Quantity must be a whole number"
      }
    },
    price: {
      type: Number,
      min: 0,
      max: 10000000
    }
  }],

  totalAmount: {
    type: Number,
    required: true,
    min: 0,
    max: 100000000
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
  },

  // Stock bookkeeping. Orders created before these flags existed keep both
  // values false, so cancelling a legacy order never invents stock that was
  // never deducted in the first place.
  stockDeducted: {
    type: Boolean,
    default: false
  },

  // Set when cancellation has returned this order's quantities to stock, so a
  // retry or a duplicate request cannot restore the same stock twice.
  stockRestored: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Supports the startup repair of cancellations that were interrupted before
// their stock was returned (non-transaction fallback only).
orderSchema.index({ status: 1, stockDeducted: 1, stockRestored: 1 });

export default mongoose.model("Order", orderSchema);