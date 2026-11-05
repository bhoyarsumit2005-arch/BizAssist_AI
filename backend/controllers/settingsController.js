import crypto from "crypto";

import Business, {
  AI_LANGUAGES,
  AI_TONES,
  DEFAULT_AI_SETTINGS
} from "../models/Business.js";
import { isWhatsAppConfigured, whatsappProvider } from "../services/whatsappService.js";
import { getBusinessId } from "../utils/businessScope.js";

const MAX_INSTRUCTIONS = 2000;
const MAX_MESSAGE = 500;
const MAX_PHONE = 32;
const MAX_NAME = 100;
const MAX_PHONE_NUMBER_ID = 64;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const requireBusiness = async (businessId) => {
  const business = await Business.findById(businessId);
  if (!business) {
    throw { status: 404, message: "Business not found" };
  }
  return business;
};

const ensureVerifyToken = async (business) => {
  if (business.whatsappSettings?.verifyToken) return business.whatsappSettings.verifyToken;

  const token = crypto.randomBytes(24).toString("hex");
  await Business.updateOne(
    { _id: business._id },
    { $set: { "whatsappSettings.verifyToken": token } }
  );
  return token;
};

const publicAiSettings = (business) => ({
  ...DEFAULT_AI_SETTINGS,
  ...(business.aiSettings?.toObject ? business.aiSettings.toObject() : business.aiSettings || {})
});

const publicWhatsAppSettings = (req, business, verifyToken) => {
  const settings = business.whatsappSettings?.toObject
    ? business.whatsappSettings.toObject()
    : business.whatsappSettings || {};

  const provider = whatsappProvider(settings);
  const baseUrl = `${req.protocol}://${req.get("host")}`;

  return {
    ...settings,
    provider,
    // Fall back to the deployment defaults so a single-number setup shows
    // its number and instance before the owner saves anything.
    phone: settings.phone || process.env.WHATSAPP_PHONE || "",
    waapiInstanceId: settings.waapiInstanceId || process.env.WAAPI_INSTANCE_ID || "",
    verifyToken,
    configured: isWhatsAppConfigured(settings),
    webhookUrl:
      provider === "waapi"
        ? process.env.WAAPI_WEBHOOK_URL ||
          `${baseUrl}/api/whatsapp/waapi/${process.env.WAAPI_WEBHOOK_SECRET || ""}`
        : process.env.WHATSAPP_WEBHOOK_URL ||
          `${baseUrl}/api/whatsapp/webhook`
  };
};

const readString = (value, field, maxLength) => {
  if (typeof value !== "string") {
    throw { status: 400, message: `${field} must be a string` };
  }
  const text = value.trim();
  if (text.length > maxLength) {
    throw { status: 400, message: `${field} must be ${maxLength} characters or fewer` };
  }
  return text;
};

const readBoolean = (value, field) => {
  if (typeof value !== "boolean") {
    throw { status: 400, message: `${field} must be true or false` };
  }
  return value;
};

const readTime = (value, field) => {
  const text = readString(value, field, 5);
  if (!TIME_PATTERN.test(text)) {
    throw { status: 400, message: `${field} must use HH:MM (24-hour) format` };
  }
  return text;
};

const buildAiPatch = (body) => {
  const patch = {};

  if (body.instructions !== undefined) {
    patch.instructions = readString(body.instructions, "instructions", MAX_INSTRUCTIONS);
  }

  if (body.tone !== undefined) {
    if (!AI_TONES.includes(body.tone)) {
      throw { status: 400, message: `tone must be one of: ${AI_TONES.join(", ")}` };
    }
    patch.tone = body.tone;
  }

  if (body.language !== undefined) {
    if (!AI_LANGUAGES.includes(body.language)) {
      throw { status: 400, message: `language must be one of: ${AI_LANGUAGES.join(", ")}` };
    }
    patch.language = body.language;
  }

  if (body.greeting !== undefined) {
    patch.greeting = readString(body.greeting, "greeting", MAX_MESSAGE);
  }

  if (body.fallback !== undefined) {
    patch.fallback = readString(body.fallback, "fallback", MAX_MESSAGE);
  }

  for (const field of ["autoReply", "handoff", "takeOrders", "afterHours"]) {
    if (body[field] !== undefined) {
      patch[field] = readBoolean(body[field], field);
    }
  }

  if (body.hoursStart !== undefined) {
    patch.hoursStart = readTime(body.hoursStart, "hoursStart");
  }

  if (body.hoursEnd !== undefined) {
    patch.hoursEnd = readTime(body.hoursEnd, "hoursEnd");
  }

  return patch;
};

const buildWhatsAppPatch = (body) => {
  const patch = {};

  if (body.phone !== undefined) {
    patch.phone = readString(body.phone, "phone", MAX_PHONE);
  }

  if (body.displayName !== undefined) {
    patch.displayName = readString(body.displayName, "displayName", MAX_NAME);
  }

  if (body.phoneNumberId !== undefined) {
    patch.phoneNumberId = readString(body.phoneNumberId, "phoneNumberId", MAX_PHONE_NUMBER_ID);
  }

  if (body.waapiInstanceId !== undefined) {
    patch.waapiInstanceId = readString(body.waapiInstanceId, "waapiInstanceId", MAX_PHONE_NUMBER_ID);
  }

  if (body.provider !== undefined) {
    const provider = readString(body.provider, "provider", 16).toLowerCase();
    if (provider && provider !== "waapi" && provider !== "meta") {
      throw { status: 400, message: "provider must be waapi or meta" };
    }
    patch.provider = provider;
  }

  for (const field of ["autoReply", "readReceipts"]) {
    if (body[field] !== undefined) {
      patch[field] = readBoolean(body[field], field);
    }
  }

  return patch;
};

/** GET /api/settings — AI and WhatsApp settings for the signed-in business. */
export const getSettings = async (req, res) => {
  try {
    const businessId = getBusinessId(req, res);
    if (!businessId) return;

    const business = await requireBusiness(businessId);
    const verifyToken = await ensureVerifyToken(business);

    return res.status(200).json({
      success: true,
      ai: publicAiSettings(business),
      whatsapp: publicWhatsAppSettings(req, business, verifyToken)
    });
  } catch (error) {
    if (error?.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    console.error("Get settings error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

/** PUT /api/settings/ai */
export const updateAiSettings = async (req, res) => {
  try {
    const businessId = getBusinessId(req, res);
    if (!businessId) return;

    const business = await requireBusiness(businessId);
    const patch = buildAiPatch(req.body || {});

    if (!Object.keys(patch).length) {
      return res.status(400).json({ success: false, message: "No AI settings to update" });
    }

    const set = Object.fromEntries(
      Object.entries(patch).map(([key, value]) => [`aiSettings.${key}`, value])
    );

    await Business.updateOne({ _id: business._id }, { $set: set });
    const updated = await requireBusiness(businessId);

    return res.status(200).json({
      success: true,
      message: "AI settings saved",
      ai: publicAiSettings(updated)
    });
  } catch (error) {
    if (error?.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    console.error("Update AI settings error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

/** PUT /api/settings/whatsapp */
export const updateWhatsAppSettings = async (req, res) => {
  try {
    const businessId = getBusinessId(req, res);
    if (!businessId) return;

    const business = await requireBusiness(businessId);
    const patch = buildWhatsAppPatch(req.body || {});

    if (!Object.keys(patch).length) {
      return res.status(400).json({ success: false, message: "No WhatsApp settings to update" });
    }

    const set = Object.fromEntries(
      Object.entries(patch).map(([key, value]) => [`whatsappSettings.${key}`, value])
    );

    await Business.updateOne({ _id: business._id }, { $set: set });
    const updated = await requireBusiness(businessId);
    const verifyToken = await ensureVerifyToken(updated);

    return res.status(200).json({
      success: true,
      message: "WhatsApp settings saved",
      whatsapp: publicWhatsAppSettings(req, updated, verifyToken)
    });
  } catch (error) {
    if (error?.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    console.error("Update WhatsApp settings error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};
