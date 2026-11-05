import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 80
  },

  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    maxlength: 254
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
  },

  isActive: {
    type: Boolean,
    default: true
  },

  // Incremented when a password changes; old access tokens stop matching.
  tokenVersion: {
    type: Number,
    default: 0,
    min: 0
  },

  lastLoginAt: Date,

  passwordChangedAt: Date,

  passwordResetTokenHash: {
    type: String,
    select: false
  },

  passwordResetExpiresAt: {
    type: Date,
    select: false
  }
}, {
  timestamps: true
});

userSchema.index(
  { passwordResetTokenHash: 1 },
  { sparse: true, partialFilterExpression: { passwordResetTokenHash: { $type: "string" } } }
);

export default mongoose.model("User", userSchema);
