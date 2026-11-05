import Business, { AI_LANGUAGES, AI_TONES } from "../models/Business.js";
import Product from "../models/Product.js";
import {
  AiError,
  checkOllama,
  generateReply,
  selectProducts
} from "../services/aiService.js";
import { getBusinessId } from "../utils/businessScope.js";

const MAX_MESSAGE_LENGTH = 2000;
// Scan a bounded window of the catalog; the service trims it further before
// it reaches the model.
const MAX_PRODUCTS_SCAN = 200;

/**
 * Allow the Settings test chat to preview unsaved edits. Only the known,
 * non-secret AI fields are accepted, and only from the authenticated owner.
 */
const readSettingsOverrides = (raw) => {
  if (!raw || typeof raw !== "object") return {};

  const overrides = {};

  if (typeof raw.instructions === "string") {
    overrides.instructions = raw.instructions.slice(0, 2000);
  }
  if (typeof raw.greeting === "string") {
    overrides.greeting = raw.greeting.slice(0, 500);
  }
  if (typeof raw.fallback === "string") {
    overrides.fallback = raw.fallback.slice(0, 500);
  }
  if (AI_TONES.includes(raw.tone)) {
    overrides.tone = raw.tone;
  }
  if (AI_LANGUAGES.includes(raw.language)) {
    overrides.language = raw.language;
  }
  for (const field of ["handoff", "takeOrders", "afterHours", "autoReply"]) {
    if (typeof raw[field] === "boolean") overrides[field] = raw[field];
  }
  for (const field of ["hoursStart", "hoursEnd"]) {
    if (typeof raw[field] === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(raw[field])) {
      overrides[field] = raw[field];
    }
  }

  return overrides;
};

const errorResponse = (error, res, action) => {
  if (error instanceof AiError) {
    if (error.code === "AI_TIMEOUT") {
      return res.status(504).json({
        success: false,
        message: "The assistant took too long to respond. Please try again."
      });
    }

    if (error.code === "AI_UNAVAILABLE") {
      return res.status(503).json({
        success: false,
        message: "The assistant is unavailable right now. Please try again shortly."
      });
    }

    if (error.code === "AI_BAD_RESPONSE") {
      return res.status(502).json({
        success: false,
        message: "The assistant returned an empty response. Please try again."
      });
    }
  }

  // Log only the failure kind — never the customer message or product data.
  console.error(`${action} error:`, error?.code || error?.name || "unknown");
  return res.status(500).json({
    success: false,
    message: "Something went wrong"
  });
};

/** POST /api/ai/chat — authenticated, business-scoped assistant reply. */
export const chat = async (req, res) => {
  try {
    const raw = req.body?.message;
    const message = typeof raw === "string" ? raw.trim() : "";

    if (!message) {
      return res.status(400).json({
        success: false,
        message: "Message is required"
      });
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer`
      });
    }

    const businessId = getBusinessId(req, res);
    if (!businessId) return;

    const [business, products] = await Promise.all([
      Business.findById(businessId).select("name aiSettings").lean(),
      Product.find({ businessId, isActive: true })
        .select("name description price stock unit")
        .sort({ createdAt: -1 })
        .limit(MAX_PRODUCTS_SCAN)
        .lean()
    ]);

    const selected = selectProducts(products, message);
    const settings = {
      ...(business?.aiSettings || {}),
      ...readSettingsOverrides(req.body?.settings)
    };

    const reply = await generateReply({
      businessName: business?.name,
      products: selected,
      message,
      settings
    });

    return res.status(200).json({ success: true, reply });
  } catch (error) {
    return errorResponse(error, res, "AI chat");
  }
};

/** GET /api/ai/health — authenticated readiness check for Ollama + model. */
export const health = async (req, res) => {
  try {
    const status = await checkOllama();

    return res.status(status.ok ? 200 : 503).json({
      success: status.ok,
      model: status.model,
      message: status.ok ? "AI service ready" : "AI service unavailable"
    });
  } catch (error) {
    return errorResponse(error, res, "AI health");
  }
};
