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
    required: true
  },

  description: String,

  price: {
    type: Number,
    required: true,
    min: 0
  },

  stock: {
    type: Number,
    default: 0,
    min: 0
  },

  unit: {
    type: String,
    default: "piece"
  },

  image: String,

  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

export default mongoose.model("Product", productSchema);