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
    trim: true,
    maxlength: 120
  },

  phone: {
    type: String,
    trim: true,
    maxlength: 32
  },

  email: {
    type: String,
    lowercase: true,
    trim: true,
    maxlength: 254
  },

  address: {
    type: String,
    trim: true,
    maxlength: 300
  },

  notes: {
    type: String,
    trim: true,
    maxlength: 1000
  },

  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

customerSchema.index({ businessId: 1, phone: 1 });

export default mongoose.model("Customer", customerSchema);
