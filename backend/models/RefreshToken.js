import crypto from "crypto";
import mongoose from "mongoose";

/**
 * One row per active login session. Only the SHA-256 hash of the refresh token
 * is stored, so a database leak does not hand out usable sessions. Tokens are
 * rotated on every refresh; a replayed token is treated as compromise.
 */
const refreshTokenSchema = new mongoose.Schema(
  {
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    expiresAt: {
      type: Date,
      required: true
    },

    revokedAt: Date,

    ip: String,

    userAgent: {
      type: String,
      maxlength: 200
    }
  },
  { timestamps: true }
);

// MongoDB removes expired sessions automatically.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
refreshTokenSchema.index({ userId: 1, revokedAt: 1 });

export const hashRefreshToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

export default mongoose.model("RefreshToken", refreshTokenSchema);
