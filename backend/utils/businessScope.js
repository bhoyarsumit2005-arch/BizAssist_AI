/**
 * Every business-data query must be filtered by the business ID carried in
 * the *signed* JWT — never by an ID from the request body, params or query.
 *
 * Returns the ID for use in the query, or sends 403 and returns null when the
 * authenticated account has no business linked. That guard matters: an
 * undefined `businessId` would be stripped by mongoose and the query would
 * silently run unscoped.
 */
export const getBusinessId = (req, res) => {
  const businessId = req.user?.businessId;

  if (!businessId) {
    res.status(403).json({
      success: false,
      message: "Your account is not linked to a business"
    });
    return null;
  }

  return businessId;
};
