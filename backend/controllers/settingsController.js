import Business, {
  AI_LANGUAGES,
  AI_TONES,
  DEFAULT_AI_SETTINGS
} from "../models/Business.js";
import { getBusinessId } from "../utils/businessScope.js";

const MAX_INSTRUCTIONS = 2000;
const MAX_MESSAGE = 500;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const requireBusiness = async (businessId) => {
  const business = await Business.findById(businessId);
  if (!business) {
    throw { status: 404, message: "Business not found" };
  }
  return business;
};

const publicAiSettings = (business) => ({
  ...DEFAULT_AI_SETTINGS,
  ...(business.aiSettings?.toObject ? business.aiSettings.toObject() : business.aiSettings || {})
});

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

/** GET /api/settings — AI settings for the signed-in business. */
export const getSettings = async (req, res) => {
  try {
    const businessId = getBusinessId(req, res);
    if (!businessId) return;

    const business = await requireBusiness(businessId);

    return res.status(200).json({
      success: true,
      ai: publicAiSettings(business)
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
