import rateLimit from "express-rate-limit";

const tooMany = (message) => (req, res) =>
  res.status(429).json({ success: false, message });

const base = {
  standardHeaders: "draft-7",
  legacyHeaders: false
};

/** Failed logins only: a busy but legitimate user is not locked out. */
export const loginLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  handler: tooMany("Too many sign-in attempts. Please wait 15 minutes and try again.")
});

export const registerLimiter = rateLimit({
  ...base,
  windowMs: 60 * 60 * 1000,
  limit: 10,
  handler: tooMany("Too many accounts created from this address. Please try again later.")
});

export const passwordResetLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: 5,
  handler: tooMany("Too many password reset requests. Please wait 15 minutes and try again.")
});

export const refreshLimiter = rateLimit({
  ...base,
  windowMs: 60 * 1000,
  limit: 60,
  handler: tooMany("Too many session refreshes. Please wait a minute and try again.")
});
