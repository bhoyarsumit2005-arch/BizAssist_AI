import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },

  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },

  password: {
    type: String,
    required: true,
    select: false
  },

  role: {
    type: String,
    enum: ["owner", "staff"],
    default: "owner"
  },

  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Business"
  }
}, {
  timestamps: true
});

export default mongoose.model("User", userSchema);