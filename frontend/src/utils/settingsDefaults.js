// Shape of the per-business settings returned by GET /api/settings. These are
// only fallbacks for the first render while the request is in flight; the
// backend remains the source of truth.

export const defaultAiSettings = {
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
};
