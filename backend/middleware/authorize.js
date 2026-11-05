/**
 * Role gates for authenticated routes. `protect` has already loaded the user
 * from MongoDB, so the role here is current even if it changed after the JWT
 * was issued.
 */
export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: "Authentication required" });
  }

  if (!roles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: "You do not have permission to perform this action"
    });
  }

  return next();
};

export const requireOwner = requireRole("owner");
