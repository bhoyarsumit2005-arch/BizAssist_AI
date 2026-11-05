import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Business",
    required: true,
    index: true
  },

  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 120
  },

  description: {
    type: String,
    trim: true,
    maxlength: 2000
  },

  price: {
    type: Number,
    required: true,
    min: 0,
    max: 10000000
  },

  stock: {
    type: Number,
    default: 0,
    min: 0,
    max: 1000000,
    validate: {
      validator: Number.isInteger,
      message: "Stock must be a whole number"
    }
  },

  unit: {
    type: String,
    default: "piece",
    trim: true,
    maxlength: 20
  },

  image: {
    type: String,
    trim: true,
    maxlength: 500
  },

  isActive: {
    type: Boolean,
    default: true
  },

  /**
   * Only used by the non-transaction order fallback. Each ObjectId records an
   * order whose stock has already been returned to this product, so a retried
   * or recovered cancellation cannot increment the same stock twice.
   * Excluded from normal product responses.
   */
  stockRestoredFor: {
    type: [mongoose.Schema.Types.ObjectId],
    default: undefined,
    select: false
  }
}, {
  timestamps: true
});

export default mongoose.model("Product", productSchema);
