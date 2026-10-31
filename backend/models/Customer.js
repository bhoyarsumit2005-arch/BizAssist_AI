import mongoose from "mongoose";

const customerSchema = new mongoose.Schema({
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Business",
    required: true,
    index: true
  },

  name: {
    type: String,
    required: true,
    trim: true
  },

  phone: {
    type: String,
    trim: true
  },

  email: {
    type: String,
    lowercase: true,
    trim: true
  },

  address: String,

  notes: String,

  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

customerSchema.index({ businessId: 1, phone: 1 });

export default mongoose.model("Customer", customerSchema);
