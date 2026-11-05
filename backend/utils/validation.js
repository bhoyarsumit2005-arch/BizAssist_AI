/**
 * Shared input limits. Every value that can reach a model is bounded here so
 * the API never accepts an unbounded string or a fractional quantity.
 *
 * Limits are intentionally generous for real businesses but small enough that
 * a single request cannot be used to exhaust memory or the database.
 */
export const LIMITS = Object.freeze({
  // Accounts
  userName: 80,
  email: 254,
  passwordMin: 8,
  passwordMax: 72,

  // Business profile
  businessName: 100,
  businessCategory: 60,
  phone: 32,
  address: 300,

  // Customers
  customerName: 120,
  customerAddress: 300,
  customerNotes: 1000,

  // Products
  productName: 120,
  productDescription: 2000,
  productUnit: 20,
  productImage: 500,
  productPriceMax: 10000000,
  productStockMax: 1000000,

  // Orders
  orderItems: 50,
  orderQuantityMax: 10000,
  orderTotalMax: 100000000,

  // Messaging
  messageText: 4096
});

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const normalizeEmail = (value) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

export const isValidEmail = (value) =>
  Boolean(value) && value.length <= LIMITS.email && EMAIL_PATTERN.test(value);

/** Throw a controller-friendly error with an HTTP status attached. */
export const fail = (status, message) => {
  const error = new Error(message);
  error.status = status;
  throw error;
};

/**
 * Read a bounded string. Returns `undefined` when the value was not supplied,
 * which lets update handlers tell "field absent" apart from "field emptied".
 */
export const readText = (
  value,
  field,
  { max, min = 0, required = false } = {}
) => {
  if (value === undefined || value === null) {
    if (required) fail(400, `${field} is required`);
    return undefined;
  }

  if (typeof value !== "string") {
    fail(400, `${field} must be a string`);
  }

  const text = value.trim();

  if (required && !text) {
    fail(400, `${field} is required`);
  }

  if (text.length > max) {
    fail(400, `${field} must be ${max} characters or fewer`);
  }

  if (text.length > 0 && text.length < min) {
    fail(400, `${field} must be at least ${min} characters`);
  }

  return text;
};

/** Read an integer, rejecting fractional or out-of-range values. */
export const readInteger = (value, field, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) => {
  const number = Number(value);

  if (!Number.isInteger(number)) {
    fail(400, `${field} must be a whole number`);
  }

  if (number < min || number > max) {
    fail(400, `${field} must be between ${min} and ${max}`);
  }

  return number;
};

export const readBoolean = (value, field) => {
  if (typeof value !== "boolean") {
    fail(400, `${field} must be true or false`);
  }
  return value;
};
