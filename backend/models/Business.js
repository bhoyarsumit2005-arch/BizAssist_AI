import mongoose from "mongoose";

const businessSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },

  category: {
    type: String,
    required: true
  },

  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  phone: String,

  address: String,

  whatsappConnected: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

export default mongoose.model("Business", businessSchema);