import bcrypt from "bcryptjs";
import crypto from "crypto";
import mongoose from "mongoose";

import Business from "../models/Business.js";
import User from "../models/User.js";
import {
  issueSession,
  revokeAllUserSessions,
  revokeRefreshToken,
  rotateRefreshToken,
  SessionError
} from "../services/authTokens.js";
import {
  passwordResetUrl,
  sendPasswordResetEmail
} from "../services/emailService.js";
import { isTransactionUnsupported } from "../utils/mongoTransactions.js";
import {
  isValidEmail,
  LIMITS,
  normalizeEmail,
  readText
} from "../utils/validation.js";

const SALT_ROUNDS = 10;

const MIN_PASSWORD_LENGTH = LIMITS.passwordMin;
// bcrypt hashes at most 72 bytes; anything longer is silently truncated.
const MAX_PASSWORD_LENGTH = LIMITS.passwordMax;
const RESET_TOKEN_BYTES = 32;
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

const hashResetToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

const toPublicUser = (user) => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  role: user.role
});

const toPublicBusiness = (business) =>
  business
    ? {
        id: business._id.toString(),
        name: business.name,
        category: business.category
      }
    : null;

/**
 * Best-effort compensation: remove anything a half-finished registration
 * already wrote so a failed business creation never leaves an orphaned user.
 */
const rollback = async ({ userId, businessId }) => {
  const tasks = [];

  if (businessId) tasks.push(Business.deleteOne({ _id: businessId }));
  if (userId) tasks.push(User.deleteOne({ _id: userId }));

  const results = await Promise.allSettled(tasks);

  for (const result of results) {
    if (result.status === "rejected") {
      console.error("Registration rollback failed:", result.reason);
    }
  }
};

/**
 * Registration written for servers that DO support transactions.
 * If the transaction cannot run, `catch` cleans up partial state and
 * retries through the explicit-rollback path below.
 */
const createAccountInTransaction = async (data) => {
  let userId = null;
  let businessId = null;

  let result = null;
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      // Reset in case the driver retries the callback.
      userId = null;
      businessId = null;

      const [user] = await User.create(
        [{ name: data.name, email: data.email, password: data.passwordHash, role: "owner" }],
        { session }
      );
      userId = user._id;

      const [business] = await Business.create(
        [
          {
            name: data.businessName,
            category: data.businessCategory,
            owner: user._id,
            phone: data.phone,
            address: data.address
          }
        ],
        { session }
      );
      businessId = business._id;

      user.businessId = business._id;
      await user.save({ session });

      result = { user, business };
    });
  } catch (error) {
    if (isTransactionUnsupported(error)) {
      // The server rejected the transaction, so nothing was rolled back
      // automatically — remove whatever this attempt did write.
      await rollback({ userId, businessId });
    }
    throw error;
  } finally {
    await session.endSession();
  }

  return result;
};

/**
 * Fallback for servers without transactions: create the user, create the
 * business, link them — and if any step fails, delete what was already written.
 */
const createAccountWithoutTransactions = async (data) => {
  const user = await User.create({
    name: data.name,
    email: data.email,
    password: data.passwordHash,
    role: "owner"
  });

  let business = null;

  try {
    business = await Business.create({
      name: data.businessName,
      category: data.businessCategory,
      owner: user._id,
      phone: data.phone,
      address: data.address
    });

    user.businessId = business._id;
    await user.save();
  } catch (error) {
    await rollback({ userId: user._id, businessId: business?._id });
    throw error;
  }

  return { user, business };
};

const createAccount = async (data) => {
  try {
    return await createAccountInTransaction(data);
  } catch (error) {
    if (!isTransactionUnsupported(error)) throw error;

    // Partial state (if any) was already rolled back above, so it is safe
    // to retry with the explicit-rollback implementation.
    return createAccountWithoutTransactions(data);
  }
};

/**
 * POST /api/auth/register
 * Owner registration: validate -> hash password -> create User -> create
 * Business -> link the two -> issue a session -> return the login response.
 * The business ID always comes from the document we just created, never
 * from the request body.
 */
export const register = async (req, res) => {
  try {
    const body = req.body || {};

    const name = readText(body.name, "name", { max: LIMITS.userName, required: true });
    const email = normalizeEmail(body.email);
    const password = typeof body.password === "string" ? body.password : "";

    const businessName = readText(
      (typeof body.businessName === "string" && body.businessName) ||
        (typeof body.business?.name === "string" ? body.business.name : ""),
      "businessName",
      { max: LIMITS.businessName, required: true }
    );

    const businessCategory = readText(
      (typeof body.businessCategory === "string" && body.businessCategory) ||
        (typeof body.business?.category === "string" ? body.business.category : ""),
      "businessCategory",
      { max: LIMITS.businessCategory, required: true }
    );

    const phone = readText(body.phone, "phone", { max: LIMITS.phone });
    const address = readText(body.address, "address", { max: LIMITS.address });

    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid email address"
      });
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`
      });
    }

    if (password.length > MAX_PASSWORD_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `Password must be at most ${MAX_PASSWORD_LENGTH} characters`
      });
    }

    const existingUser = await User.exists({ email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists"
      });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const { user, business } = await createAccount({
      name,
      email,
      passwordHash,
      businessName,
      businessCategory,
      phone,
      address
    });

    const session = await issueSession(user, req);

    return res.status(201).json({
      success: true,
      message: "Registration successful",
      ...session,
      user: toPublicUser(user),
      business: toPublicBusiness(business)
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists"
      });
    }

    if (error?.status || error?.statusCode) {
      const status = error.status || error.statusCode;
      return res.status(status).json({
        success: false,
        message: status >= 500 ? "Registration failed. Please try again." : error.message
      });
    }

    console.error("Register error:", error);
    return res.status(500).json({
      success: false,
      message: "Registration failed. Please try again."
    });
  }
};

/**
 * POST /api/auth/login
 * Verifies the password, then issues a short-lived access token and a
 * rotating refresh token.
 */
export const login = async (req, res) => {
  try {
    const body = req.body || {};
    const email = normalizeEmail(body.email);
    const password = typeof body.password === "string" ? body.password : "";

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required"
      });
    }

    // password is stored with select: false, so ask for it explicitly.
    const user = await User.findOne({ email }).select("+password");

    // Same message for every failure so the endpoint cannot enumerate accounts.
    const invalidResponse = {
      success: false,
      message: "Invalid email or password"
    };

    if (!user || user.isActive === false) {
      return res.status(401).json(invalidResponse);
    }

    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      return res.status(401).json(invalidResponse);
    }

    const business = user.businessId
      ? await Business.findById(user.businessId).select("name category")
      : null;

    const session = await issueSession(user, req);
    await User.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });

    return res.status(200).json({
      success: true,
      message: "Login successful",
      ...session,
      user: toPublicUser(user),
      business: toPublicBusiness(business)
    });
  } catch (error) {
    if (error?.status || error?.statusCode) {
      const status = error.status || error.statusCode;
      return res.status(status).json({
        success: false,
        message: status >= 500 ? "Login failed. Please try again." : error.message
      });
    }

    console.error("Login error:", error);
    return res.status(500).json({
      success: false,
      message: "Login failed. Please try again."
    });
  }
};

/**
 * POST /api/auth/refresh
 * Rotates the refresh token and returns a fresh access token. Reusing an old
 * refresh token revokes every session for the account.
 */
export const refresh = async (req, res) => {
  try {
    const result = await rotateRefreshToken(req.body?.refreshToken, req);

    const business = result.user.businessId
      ? await Business.findById(result.user.businessId).select("name category")
      : null;

    return res.status(200).json({
      success: true,
      token: result.token,
      refreshToken: result.refreshToken,
      tokenType: result.tokenType,
      expiresIn: result.expiresIn,
      user: toPublicUser(result.user),
      business: toPublicBusiness(business)
    });
  } catch (error) {
    if (error instanceof SessionError || error?.status === 401) {
      return res.status(401).json({
        success: false,
        message: "Your session has expired. Please sign in again."
      });
    }

    console.error("Refresh error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not refresh your session"
    });
  }
};

/** POST /api/auth/logout — revoke this device's refresh token. */
export const logout = async (req, res) => {
  try {
    await revokeRefreshToken(req.body?.refreshToken);
  } catch (error) {
    // Logout is best-effort; the client clears its tokens regardless.
    console.error("Logout error:", error);
  }

  return res.status(200).json({ success: true, message: "Signed out" });
};

/**
 * POST /api/auth/forgot-password
 * Always returns the same message so an attacker cannot discover which email
 * addresses have accounts.
 */
export const forgotPassword = async (req, res) => {
  const generic = {
    success: true,
    message: "If an account exists for that email, a password reset link has been sent."
  };

  try {
    const email = normalizeEmail(req.body?.email);

    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid email address"
      });
    }

    const user = await User.findOne({ email, isActive: { $ne: false } });

    if (user) {
      const token = crypto.randomBytes(RESET_TOKEN_BYTES).toString("base64url");
      const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

      await User.updateOne(
        { _id: user._id },
        {
          $set: {
            passwordResetTokenHash: hashResetToken(token),
            passwordResetExpiresAt: expiresAt
          }
        }
      );

      const resetUrl = passwordResetUrl(token);

      sendPasswordResetEmail({ to: user.email, name: user.name, resetUrl }).catch((error) => {
        console.error("Password reset email failed:", error.message);
      });

      // Local development and the test suite can complete the flow without
      // an email provider. Never expose this in production.
      if (process.env.NODE_ENV !== "production" && process.env.AUTH_RESET_DEBUG === "true") {
        return res.status(200).json({ ...generic, resetToken: token });
      }
    }

    return res.status(200).json(generic);
  } catch (error) {
    console.error("Forgot password error:", error);
    return res.status(200).json(generic);
  }
};

/** POST /api/auth/reset-password — consume a one-time reset token. */
export const resetPassword = async (req, res) => {
  try {
    const token = typeof req.body?.token === "string" ? req.body.token.trim() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";

    if (!token || token.length < 20 || token.length > 200) {
      return res.status(400).json({
        success: false,
        message: "This reset link is invalid or has expired"
      });
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`
      });
    }

    if (password.length > MAX_PASSWORD_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `Password must be at most ${MAX_PASSWORD_LENGTH} characters`
      });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Claim the token atomically, bump the version so existing access tokens
    // stop working, and store the new password in one write.
    const user = await User.findOneAndUpdate(
      {
        passwordResetTokenHash: hashResetToken(token),
        passwordResetExpiresAt: { $gt: new Date() },
        isActive: { $ne: false }
      },
      {
        $set: { password: passwordHash, passwordChangedAt: new Date() },
        $unset: { passwordResetTokenHash: "", passwordResetExpiresAt: "" },
        $inc: { tokenVersion: 1 }
      },
      { returnDocument: "after" }
    );

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "This reset link is invalid or has expired"
      });
    }

    await revokeAllUserSessions(user._id);

    return res.status(200).json({
      success: true,
      message: "Password updated. Sign in with your new password."
    });
  } catch (error) {
    console.error("Reset password error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not reset your password. Please try again."
    });
  }
};

/**
 * GET /api/auth/me
 * The token identifies the account; the profile and business are re-read from
 * the database so the response always reflects current state.
 */
export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user || user.isActive === false) {
      return res.status(401).json({
        success: false,
        message: "Account no longer exists"
      });
    }

    const business = user.businessId
      ? await Business.findById(user.businessId).select("name category phone address")
      : null;

    return res.status(200).json({
      success: true,
      user: toPublicUser(user),
      business: toPublicBusiness(business)
    });
  } catch (error) {
    // A malformed id in the token means it was not issued by this server.
    if (error?.name === "CastError") {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired token"
      });
    }

    console.error("Get me error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not load your account"
    });
  }
};
