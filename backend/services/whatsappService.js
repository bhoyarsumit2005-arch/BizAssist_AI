import {
  ConnectionError,
  FailedActionError,
  RateLimitError,
  WaAPI,
  AuthenticationError
} from "@waapiapp/sdk";

const DEFAULT_API_VERSION = "v20.0";
const SEND_TIMEOUT_MS = 15000;

export const PROVIDER_META = "meta";
export const PROVIDER_WAAPI = "waapi";

export class WhatsAppError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = "WhatsAppError";
    this.code = code;
  }
}

export const normalizePhone = (value) => String(value || "").replace(/\D/g, "");

/** WaAPI chat IDs need an explicit suffix; a wrong one is accepted and silently dropped. */
export const waapiChatId = (value) => {
  const digits = normalizePhone(value);
  return digits ? `${digits}@c.us` : "";
};

/**
 * Which provider this business uses. Explicit configuration wins; otherwise
 * WaAPI is picked automatically once its token is present, so an existing
 * Meta deployment keeps working unchanged.
 */
export const whatsappProvider = (businessSettings) => {
  const explicit = String(
    businessSettings?.provider || process.env.WHATSAPP_PROVIDER || ""
  )
    .trim()
    .toLowerCase();

  if (explicit === PROVIDER_WAAPI || explicit === PROVIDER_META) return explicit;

  return process.env.WAAPI_TOKEN ? PROVIDER_WAAPI : PROVIDER_META;
};

export const waapiInstanceId = (businessSettings) =>
  String(businessSettings?.waapiInstanceId || process.env.WAAPI_INSTANCE_ID || "").trim();

export const whatsappPhoneNumberId = (businessSettings) =>
  businessSettings?.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || "";

export const isWaapiConfigured = (businessSettings) =>
  Boolean(process.env.WAAPI_TOKEN && waapiInstanceId(businessSettings));

const isMetaConfigured = (businessSettings) =>
  Boolean(whatsappPhoneNumberId(businessSettings) && process.env.WHATSAPP_ACCESS_TOKEN);

export const isWhatsAppConfigured = (businessSettings) =>
  whatsappProvider(businessSettings) === PROVIDER_WAAPI
    ? isWaapiConfigured(businessSettings)
    : isMetaConfigured(businessSettings);

const clients = new Map();

const waapiClient = (instanceId) => {
  const key = `${instanceId}:${process.env.WAAPI_BASE_URL || ""}`;
  const cached = clients.get(key);
  if (cached) return cached;

  const client = new WaAPI({
    token: process.env.WAAPI_TOKEN,
    instanceId,
    // Only used by the automated tests, which point the SDK at a local stub.
    ...(process.env.WAAPI_BASE_URL ? { baseUrl: process.env.WAAPI_BASE_URL } : {})
  });

  clients.set(key, client);
  return client;
};

const waapiMessageId = (result) =>
  result?.data?.id?._serialized ||
  result?.data?.id ||
  result?.data?.messageId ||
  result?.id?._serialized ||
  result?.id ||
  null;

const sendViaWaapi = async ({ businessSettings, to, text }) => {
  const instanceId = waapiInstanceId(businessSettings);

  if (!process.env.WAAPI_TOKEN || !instanceId) {
    throw new WhatsAppError("NOT_CONFIGURED", "WhatsApp sending is not configured");
  }

  const chatId = waapiChatId(to);
  if (!chatId) {
    throw new WhatsAppError("BAD_RECIPIENT", "Customer phone number is missing");
  }

  try {
    const result = await waapiClient(instanceId).sendMessage({ chatId, message: text });
    return { messageId: waapiMessageId(result) };
  } catch (error) {
    if (error instanceof AuthenticationError) {
      console.error("WaAPI send failed: authentication rejected");
      throw new WhatsAppError("AUTH_FAILED", "WhatsApp credentials were rejected");
    }
    if (error instanceof RateLimitError) {
      console.error("WaAPI send failed: rate limited");
      throw new WhatsAppError("RATE_LIMITED", "WhatsApp is rate limiting this number");
    }
    if (error instanceof FailedActionError) {
      console.error("WaAPI accepted the request but reported an error");
      throw new WhatsAppError("SEND_FAILED", "WhatsApp rejected the message");
    }
    if (error instanceof ConnectionError) {
      console.error("WaAPI send failed: connection error");
      throw new WhatsAppError("UNAVAILABLE", "Could not reach WhatsApp");
    }
    console.error("WaAPI send failed:", error?.name || error?.message);
    throw new WhatsAppError("SEND_FAILED", "WhatsApp rejected the message");
  }
};

const sendViaMeta = async ({ businessSettings, to, text }) => {
  const phoneNumberId = whatsappPhoneNumberId(businessSettings);
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    throw new WhatsAppError("NOT_CONFIGURED", "WhatsApp sending is not configured");
  }

  const recipient = normalizePhone(to);
  if (!recipient) {
    throw new WhatsAppError("BAD_RECIPIENT", "Customer phone number is missing");
  }

  const version = process.env.WHATSAPP_API_VERSION || DEFAULT_API_VERSION;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);

  let response;

  try {
    response = await fetch(
      `https://graph.facebook.com/${version}/${encodeURIComponent(phoneNumberId)}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: recipient,
          type: "text",
          text: { preview_url: false, body: text }
        }),
        signal: controller.signal
      }
    );
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new WhatsAppError("TIMEOUT", "WhatsApp did not respond in time");
    }
    throw new WhatsAppError("UNAVAILABLE", "Could not reach WhatsApp");
  } finally {
    clearTimeout(timer);
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    // Never surface provider tokens or raw payloads to the client.
    console.error("WhatsApp send failed:", response.status, data?.error?.code || data?.error?.type);
    throw new WhatsAppError("SEND_FAILED", "WhatsApp rejected the message");
  }

  return { messageId: data?.messages?.[0]?.id || null };
};

/**
 * Send a plain text message through whichever provider this business uses.
 * Returns the provider message id when the provider accepts it.
 */
export const sendTextMessage = async ({ businessSettings, to, text }) => {
  const provider = whatsappProvider(businessSettings);
  const payload = { businessSettings, to, text };

  return provider === PROVIDER_WAAPI ? sendViaWaapi(payload) : sendViaMeta(payload);
};
