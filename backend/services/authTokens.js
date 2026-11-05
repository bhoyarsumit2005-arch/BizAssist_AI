import crypto from "crypto";
import jwt from "jsonwebtoken";

import RefreshToken, { hashRefreshToken } from "../models/RefreshToken.js";
import User from "../models/User.js";

const DEFAULT_ACCESS_TTL = "15m";
const DEFAULT_REFRESH_DAYS = 7;
const MAX_REFRESH_DAYS = 90;
const MAX_REFRESH_TOKEN_LENGTH = 512;
const TOKEN_ISSUER = "bizassist";
const TOKEN_AUDIENCE = "bizassist-web";

export class SessionError extends Error {
  constructor(message = "Your session has expired. Please sign in again.") {
    super(message);
    this.status = 401;
  }
}

const accessTtl = () => process.env.JWT_ACCESS_TTL || DEFAULT_ACCESS_TTL;

const refreshDays = () => {
  const value = Number(process.env.JWT_REFRESH_DAYS);
  if (!Number.isFinite(value) || value < 1) return DEFAULT_REFRESH_DAYS;
  return Math.min(Math.floor(value), MAX_REFRESH_DAYS);
};

const requireSecret = () => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    const error = new Error("Server configuration error: JWT_SECRET is not set");
    error.status = 500;
    throw error;
  }

  return secret;
};

/** Short-lived access token. `ver` lets a password change revoke older tokens. */
export const signAccessToken = (user) =>
  jwt.sign(
    {
      id: user._id.toString(),
      role: user.role,
      businessId: user.businessId ? user.businessId.toString() : null,
      ver: user.tokenVersion || 0
    },
    requireSecret(),
    {
      algorithm: "HS256",
      expiresIn: accessTtl(),
      issuer: TOKEN_ISSUER,
      audience: TOKEN_AUDIENCE
    }
  );

export const verifyAccessToken = (token) =>
  jwt.verify(token, requireSecret(), {
    algorithms: ["HS256"],
    issuer: TOKEN_ISSUER,
    audience: TOKEN_AUDIENCE
  });

const createRefreshToken = async (userId, req) => {
  const token = crypto.randomBytes(48).toString("base64url");
  const days = refreshDays();

  await RefreshToken.create({
    tokenHash: hashRefreshToken(token),
    userId,
    expiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
    ip: req?.ip,
    userAgent: req?.get?.("user-agent")?.slice(0, 200)
  });

  return token;
};

/** Issue both halves of a session. The refresh token is only ever sent once. */
export const issueSession = async (user, req) => {
  const refreshToken = await createRefreshToken(user._id, req);

  return {
    token: signAccessToken(user),
    refreshToken,
    tokenType: "Bearer",
    expiresIn: accessTtl()
  };
};

const revokeAllSessions = (userId) => RefreshToken.deleteMany({ userId });

/**
 * Rotate a refresh token. Reusing an already-revoked token is treated as a
 * stolen session and clears every session for that account.
 */
export const rotateRefreshToken = async (rawToken, req) => {
  if (typeof rawToken !== "string" || rawToken.length < 20 || rawToken.length > MAX_REFRESH_TOKEN_LENGTH) {
    throw new SessionError();
  }

  const tokenHash = hashRefreshToken(rawToken);
  const stored = await RefreshToken.findOne({ tokenHash }).lean();

  if (!stored) throw new SessionError();
  if (stored.revokedAt) {
    await revokeAllSessions(stored.userId).catch(() => {});
    throw new SessionError("This session is no longer valid. Please sign in again.");
  }
  if (new Date(stored.expiresAt).getTime() <= Date.now()) {
    await RefreshToken.deleteOne({ _id: stored._id }).catch(() => {});
    throw new SessionError();
  }

  const user = await User.findById(stored.userId);
  if (!user || user.isActive === false) {
    await revokeAllSessions(stored.userId).catch(() => {});
    throw new SessionError();
  }

  // Claim the old token atomically so two parallel refreshes cannot both
  // mint a new session from the same value.
  const claimed = await RefreshToken.findOneAndUpdate(
    { _id: stored._id, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );

  if (!claimed) {
    await revokeAllSessions(stored.userId).catch(() => {});
    throw new SessionError("This session is no longer valid. Please sign in again.");
  }

  const refreshToken = await createRefreshToken(user._id, req);

  return {
    user,
    token: signAccessToken(user),
    refreshToken,
    tokenType: "Bearer",
    expiresIn: accessTtl()
  };
};

export const revokeRefreshToken = async (rawToken) => {
  if (typeof rawToken !== "string" || rawToken.length < 20 || rawToken.length > MAX_REFRESH_TOKEN_LENGTH) {
    return;
  }

  await RefreshToken.updateOne(
    { tokenHash: hashRefreshToken(rawToken), revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
};

export const revokeAllUserSessions = (userId) => revokeAllSessions(userId);
