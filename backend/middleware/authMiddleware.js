import mongoose from "mongoose";

import User from "../models/User.js";
import { verifyAccessToken } from "../services/authTokens.js";

/**
 * Verify the access token, then re-read the account. Re-checking matters:
 * a deactivated staff member, a deleted user, or a password change must stop
 * working immediately instead of waiting for the JWT to expire.
 */
const protect = async (req, res, next) => {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({
      success: false,
      message: "Authentication required"
    });
  }

  let decoded;
  try {
    decoded = verifyAccessToken(token);
  } catch (error) {
    if (error?.status === 500) {
      console.error(error.message);
      return res.status(500).json({ success: false, message: "Server configuration error" });
    }

    return res.status(401).json({
      success: false,
      message: "Invalid or expired token"
    });
  }

  if (!decoded?.id || !mongoose.isValidObjectId(decoded.id)) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token"
    });
  }

  try {
    const user = await User.findById(decoded.id).select(
      "role businessId isActive tokenVersion"
    );

    if (!user || user.isActive === false) {
      return res.status(401).json({
        success: false,
        message: "This account is no longer active"
      });
    }

    if ((decoded.ver || 0) !== (user.tokenVersion || 0)) {
      return res.status(401).json({
        success: false,
        message: "Your session is no longer valid. Please sign in again."
      });
    }

    // Identity always comes from the current database record, never from
    // claims that may be stale.
    req.user = {
      id: user._id.toString(),
      role: user.role,
      businessId: user.businessId ? user.businessId.toString() : null,
      tokenVersion: user.tokenVersion || 0
    };

    return next();
  } catch (error) {
    console.error("Authentication lookup failed:", error);
    return res.status(500).json({
      success: false,
      message: "Could not verify your session"
    });
  }
};

export default protect;
