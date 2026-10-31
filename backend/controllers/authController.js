import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

import Business from "../models/Business.js";
import User from "../models/User.js";

const SALT_ROUNDS = 10;
const TOKEN_EXPIRES_IN = "7d";

const MIN_PASSWORD_LENGTH = 6;
// bcrypt hashes at most 72 bytes; anything longer is silently truncated.
const MAX_PASSWORD_LENGTH = 72;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Gather message text from an error and everything the driver nested inside
 * it (mongoose and the Node driver wrap server errors in `originalError` /
 * `errorResponse` rather than `cause`).
 */
const collectErrorText = (error) => {
  const texts = [];
  const seen = new Set();
  let current = error;

  while (current && !seen.has(current)) {
    seen.add(current);
    texts.push(
      current.message,
      current.errmsg,
      current.errorResponse?.message,
      current.errorResponse?.errmsg
    );
    current = current.cause || current.originalError || current.errorResponse?.originalError;
  }

  return texts.filter(Boolean).join(" | ");
};

// Messages emitted when the deployment cannot run transactions or the
// retryable/transactional writes they rely on.
const NO_TRANSACTION_SUPPORT_PATTERNS = [
  /transaction numbers are only allowed/i,
  /does not support retryable writes/i,
  /does not support (?:multi-document )?transactions/i,
  /add retryWrites=false/i,
  /transactions are not supported/i
];

/**
 * True when the connected server cannot run multi-document transactions
 * (e.g. a standalone mongod, or a free/shared tier with the feature off).
 * Those failures must fall back to explicit rollback logic instead of
 * being reported to the caller as a generic 500.
 */
const isTransactionUnsupported = (error) => {
  if (!error) return false;

  const text = collectErrorText(error);
  if (!text) return false;

  if (NO_TRANSACTION_SUPPORT_PATTERNS.some((pattern) => pattern.test(text))) {
    return true;
  }

  // code 20 = IllegalOperation, the server's response to a transaction or
  // retryable write on a deployment that does not support them.
  const code = error.code ?? error.originalError?.code ?? error.errorResponse?.code;
  const illegalOperation = code === 20 || error.codeName === "IllegalOperation";

  return illegalOperation && /transaction|retryable|retryWrites/i.test(text);
};

/** Sign a JWT whose payload is the only source of identity for later requests. */
const signToken = (user) => {
  if (!process.env.JWT_SECRET) {
    const error = new Error("Server configuration error: JWT_SECRET is not set");
    error.statusCode = 500;
    throw error;
  }

  return jwt.sign(
    {
      id: user._id.toString(),
      role: user.role,
      businessId: user.businessId ? user.businessId.toString() : null
    },
    process.env.JWT_SECRET,
    { expiresIn: TOKEN_EXPIRES_IN }
  );
};

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
 * Business -> link the two -> issue JWT -> return the login response.
 * The business ID always comes from the document we just created, never
 * from the request body.
 */
export const register = async (req, res) => {
  try {
    const body = req.body || {};

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";

    const businessName =
      (typeof body.businessName === "string" ? body.businessName.trim() : "") ||
      (typeof body.business?.name === "string" ? body.business.name.trim() : "");

    const businessCategory =
      (typeof body.businessCategory === "string" ? body.businessCategory.trim() : "") ||
      (typeof body.business?.category === "string" ? body.business.category.trim() : "");

    const phone = typeof body.phone === "string" ? body.phone.trim() : undefined;
    const address = typeof body.address === "string" ? body.address.trim() : undefined;

    const missing = [];
    if (!name) missing.push("name");
    if (!email) missing.push("email");
    if (!password) missing.push("password");
    if (!businessName) missing.push("businessName");
    if (!businessCategory) missing.push("businessCategory");

    if (missing.length) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missing.join(", ")}`
      });
    }

    if (!EMAIL_PATTERN.test(email)) {
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

    const token = signToken(user);

    return res.status(201).json({
      success: true,
      message: "Registration successful",
      token,
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

    if (error?.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message
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
 * Verifies the password and issues the same JWT used by registration.
 */
export const login = async (req, res) => {
  try {
    const body = req.body || {};
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required"
      });
    }

    // password is stored with select: false, so ask for it explicitly.
    const user = await User.findOne({ email }).select("+password");

    // Same message for both cases so the endpoint cannot enumerate accounts.
    const invalidResponse = {
      success: false,
      message: "Invalid email or password"
    };

    if (!user) {
      return res.status(401).json(invalidResponse);
    }

    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      return res.status(401).json(invalidResponse);
    }

    const business = user.businessId
      ? await Business.findById(user.businessId).select("name category")
      : null;

    const token = signToken(user);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: toPublicUser(user),
      business: toPublicBusiness(business)
    });
  } catch (error) {
    if (error?.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message
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
 * GET /api/auth/me
 * The token identifies the account; the profile and business are re-read from
 * the database so the response always reflects current state.
 */
export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
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

export { isTransactionUnsupported };
