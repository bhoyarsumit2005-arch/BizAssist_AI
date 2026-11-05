import express from "express";

import {
  forgotPassword,
  getMe,
  login,
  logout,
  refresh,
  register,
  resetPassword
} from "../controllers/authController.js";
import protect from "../middleware/authMiddleware.js";
import {
  loginLimiter,
  passwordResetLimiter,
  refreshLimiter,
  registerLimiter
} from "../middleware/rateLimiters.js";

const router = express.Router();

router.post("/register", registerLimiter, register);
router.post("/login", loginLimiter, login);
router.post("/refresh", refreshLimiter, refresh);
router.post("/logout", logout);
router.post("/forgot-password", passwordResetLimiter, forgotPassword);
router.post("/reset-password", passwordResetLimiter, resetPassword);
router.get("/me", protect, getMe);

export default router;
