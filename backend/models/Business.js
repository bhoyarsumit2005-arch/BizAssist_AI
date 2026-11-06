import mongoose from "mongoose";

export const AI_TONES = ["friendly", "professional", "playful", "concise"];

export const AI_LANGUAGES = [
  "English",
  "Hindi",
  "Hinglish",
  "Marathi",
  "Tamil",
  "Telugu",
  "Bengali",
  "Gujarati",
  "Kannada",
  "Malayalam"
];

export const DEFAULT_AI_SETTINGS = Object.freeze({
  instructions:
    "You are the friendly sales assistant for our store. Answer questions about products, prices, and delivery in a warm, concise tone. Recommend related products when relevant. If a customer wants a refund, is upset, or asks something you are unsure about, hand the conversation to the owner.",
  tone: "friendly",
  language: "English",
  greeting: "Hi! 👋 Thanks for messaging us. How can I help you today?",
  fallback: "I'll check this with the team and get back to you shortly.",
  autoReply: true,
  handoff: true,
  takeOrders: true,
  afterHours: false,
  hoursStart: "10:00",
  hoursEnd: "19:00"
});

const aiSettingsSchema = new mongoose.Schema(
  {
    instructions: {
      type: String,
      default: DEFAULT_AI_SETTINGS.instructions,
      maxlength: 2000
    },
    tone: {
      type: String,
      enum: AI_TONES,
      default: DEFAULT_AI_SETTINGS.tone
    },
    language: {
      type: String,
      enum: AI_LANGUAGES,
      default: DEFAULT_AI_SETTINGS.language
    },
    greeting: {
      type: String,
      default: DEFAULT_AI_SETTINGS.greeting,
      maxlength: 500
    },
    fallback: {
      type: String,
      default: DEFAULT_AI_SETTINGS.fallback,
      maxlength: 500
    },
    autoReply: { type: Boolean, default: DEFAULT_AI_SETTINGS.autoReply },
    handoff: { type: Boolean, default: DEFAULT_AI_SETTINGS.handoff },
    takeOrders: { type: Boolean, default: DEFAULT_AI_SETTINGS.takeOrders },
    afterHours: { type: Boolean, default: DEFAULT_AI_SETTINGS.afterHours },
    hoursStart: {
      type: String,
      default: DEFAULT_AI_SETTINGS.hoursStart,
      match: /^([01]\d|2[0-3]):[0-5]\d$/
    },
    hoursEnd: {
      type: String,
      default: DEFAULT_AI_SETTINGS.hoursEnd,
      match: /^([01]\d|2[0-3]):[0-5]\d$/
    }
  },
  { _id: false }
);

const businessSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },

  category: {
    type: String,
    required: true,
    trim: true,
    maxlength: 60
  },

  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  phone: {
    type: String,
    trim: true,
    maxlength: 32
  },

  address: {
    type: String,
    trim: true,
    maxlength: 300
  },

  aiSettings: {
    type: aiSettingsSchema,
    default: () => ({})
  }
}, {
  timestamps: true
});

export default mongoose.model("Business", businessSchema);
