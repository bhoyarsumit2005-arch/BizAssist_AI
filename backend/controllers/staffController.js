import bcrypt from "bcryptjs";
import mongoose from "mongoose";

import User from "../models/User.js";
import { revokeAllUserSessions } from "../services/authTokens.js";
import { isValidEmail, LIMITS, normalizeEmail, readText } from "../utils/validation.js";

const SALT_ROUNDS = 10;

const toPublicMember = (user) => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  role: user.role,
  isActive: user.isActive !== false,
  createdAt: user.createdAt
});

const handleError = (error, res, action) => {
  if (error?.status) {
    return res.status(error.status).json({ success: false, message: error.message });
  }

  if (error?.code === 11000) {
    return res.status(409).json({
      success: false,
      message: "An account with this email already exists"
    });
  }

  console.error(`${action} error:`, error);
  return res.status(500).json({ success: false, message: "Something went wrong" });
};

/** GET /api/staff — owner-only list of everyone in this business. */
export const listStaff = async (req, res) => {
  try {
    const members = await User.find({ businessId: req.user.businessId })
      .select("name email role isActive createdAt")
      .sort({ role: 1, createdAt: 1 });

    return res.status(200).json({
      success: true,
      members: members.map(toPublicMember)
    });
  } catch (error) {
    return handleError(error, res, "List staff");
  }
};

/** POST /api/staff — create a staff account inside the owner's business. */
export const createStaff = async (req, res) => {
  try {
    const body = req.body || {};

    const name = readText(body.name, "name", { max: LIMITS.userName, required: true });
    const email = normalizeEmail(body.email);
    const password = typeof body.password === "string" ? body.password : "";

    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, message: "Enter a valid email address" });
    }

    if (password.length < LIMITS.passwordMin) {
      return res.status(400).json({
        success: false,
        message: `Password must be at least ${LIMITS.passwordMin} characters`
      });
    }

    if (password.length > LIMITS.passwordMax) {
      return res.status(400).json({
        success: false,
        message: `Password must be at most ${LIMITS.passwordMax} characters`
      });
    }

    const existing = await User.exists({ email });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists"
      });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const member = await User.create({
      name,
      email,
      password: passwordHash,
      role: "staff",
      businessId: req.user.businessId,
      isActive: true
    });

    return res.status(201).json({
      success: true,
      message: "Staff account created",
      member: toPublicMember(member)
    });
  } catch (error) {
    return handleError(error, res, "Create staff");
  }
};

/**
 * PUT /api/staff/:id
 * Owners can rename or deactivate staff and set a new temporary password.
 * The owner account itself is intentionally not editable here.
 */
export const updateStaff = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid member id" });
    }

    const member = await User.findOne({ _id: id, businessId: req.user.businessId });

    if (!member) {
      return res.status(404).json({ success: false, message: "Team member not found" });
    }

    if (member.role === "owner") {
      return res.status(400).json({
        success: false,
        message: "The owner account cannot be changed here"
      });
    }

    const body = req.body || {};
    const updates = {};

    if (body.name !== undefined) {
      updates.name = readText(body.name, "name", { max: LIMITS.userName, required: true });
    }

    if (body.password !== undefined) {
      const password = typeof body.password === "string" ? body.password : "";

      if (password.length < LIMITS.passwordMin) {
        return res.status(400).json({
          success: false,
          message: `Password must be at least ${LIMITS.passwordMin} characters`
        });
      }

      if (password.length > LIMITS.passwordMax) {
        return res.status(400).json({
          success: false,
          message: `Password must be at most ${LIMITS.passwordMax} characters`
        });
      }

      updates.password = await bcrypt.hash(password, SALT_ROUNDS);
      updates.passwordChangedAt = new Date();
    }

    if (body.isActive !== undefined) {
      if (typeof body.isActive !== "boolean") {
        return res.status(400).json({
          success: false,
          message: "isActive must be true or false"
        });
      }
      updates.isActive = body.isActive;
    }

    if (!Object.keys(updates).length) {
      return res.status(400).json({ success: false, message: "No fields to update" });
    }

    // A password change or deactivation must invalidate existing sessions.
    const revokeSessions = updates.password !== undefined || updates.isActive === false;
    if (revokeSessions) {
      updates.tokenVersion = (member.tokenVersion || 0) + 1;
    }

    Object.assign(member, updates);
    await member.save();

    if (revokeSessions) {
      await revokeAllUserSessions(member._id);
    }

    return res.status(200).json({
      success: true,
      message: "Team member updated",
      member: toPublicMember(member)
    });
  } catch (error) {
    return handleError(error, res, "Update staff");
  }
};

/** DELETE /api/staff/:id — deactivate rather than delete, preserving history. */
export const deleteStaff = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid member id" });
    }

    const member = await User.findOne({ _id: id, businessId: req.user.businessId });

    if (!member) {
      return res.status(404).json({ success: false, message: "Team member not found" });
    }

    if (member.role === "owner") {
      return res.status(400).json({
        success: false,
        message: "The owner account cannot be deactivated here"
      });
    }

    member.isActive = false;
    member.tokenVersion = (member.tokenVersion || 0) + 1;
    await member.save();
    await revokeAllUserSessions(member._id);

    return res.status(200).json({
      success: true,
      message: "Team member deactivated",
      member: toPublicMember(member)
    });
  } catch (error) {
    return handleError(error, res, "Delete staff");
  }
};
