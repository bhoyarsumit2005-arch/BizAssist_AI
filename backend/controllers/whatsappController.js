import crypto from "crypto";

import Business from "../models/Business.js";
import Conversation from "../models/Conversation.js";
import Customer from "../models/Customer.js";
import Message from "../models/Message.js";
import Product from "../models/Product.js";
import { generateReply, selectProducts } from "../services/aiService.js";
import {
  isWhatsAppConfigured,
  normalizePhone,
  sendTextMessage
} from "../services/whatsappService.js";
import { LIMITS } from "../utils/validation.js";

const MAX_PRODUCTS_SCAN = 200;

const verifySignature = (req) => {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return true;

  const header = req.get("x-hub-signature-256");
  if (!header || !req.rawBody) return false;

  const expected = `sha256=${crypto
    .createHmac("sha256", secret)
    .update(req.rawBody)
    .digest("hex")}`;

  const received = Buffer.from(header);
  const wanted = Buffer.from(expected);

  return received.length === wanted.length && crypto.timingSafeEqual(received, wanted);
};

/** GET /api/whatsapp/webhook — Meta verification handshake. */
export const verifyWebhook = async (req, res) => {
  try {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode !== "subscribe" || typeof token !== "string" || !token) {
      return res.sendStatus(403);
    }

    const business = await Business.findOne({
      "whatsappSettings.verifyToken": token
    }).select("_id");

    const envToken = process.env.WHATSAPP_VERIFY_TOKEN;
    const accepted = Boolean(business) || (envToken && token === envToken);

    if (!accepted) return res.sendStatus(403);

    return res.status(200).send(String(challenge ?? ""));
  } catch (error) {
    console.error("WhatsApp verification error:", error);
    return res.sendStatus(500);
  }
};

const findBusinessForWebhook = async ({ phoneNumberId, displayPhoneNumber }) => {
  if (phoneNumberId) {
    const byId = await Business.findOne({
      "whatsappSettings.phoneNumberId": phoneNumberId
    });
    if (byId) return byId;
  }

  if (process.env.WHATSAPP_BUSINESS_ID) {
    const configured = await Business.findById(process.env.WHATSAPP_BUSINESS_ID);
    if (configured) return configured;
  }

  const digits = normalizePhone(displayPhoneNumber);
  if (!digits) return null;

  const tail = digits.slice(-10);
  return Business.findOne({
    $or: [
      { "whatsappSettings.phone": displayPhoneNumber },
      { phone: displayPhoneNumber },
      { "whatsappSettings.phone": new RegExp(`${tail}$`) },
      { phone: new RegExp(`${tail}$`) }
    ]
  });
};

const findOrCreateCustomer = async ({ businessId, from, name }) => {
  const variants = [from, `+${from}`];

  let customer = await Customer.findOne({
    businessId,
    phone: { $in: variants }
  });

  if (!customer) {
    customer = await Customer.findOne({
      businessId,
      phone: new RegExp(`${from}$`)
    });
  }

  if (customer) {
    if (customer.isActive === false) {
      customer.isActive = true;
      await customer.save();
    }
    return customer;
  }

  return Customer.create({
    businessId,
    name: String(name || `WhatsApp ${from.slice(-4)}`).slice(0, LIMITS.customerName),
    phone: `+${from}`.slice(0, LIMITS.phone)
  });
};

const findOrCreateConversation = async ({ businessId, customerId }) => {
  let conversation = await Conversation.findOne({
    businessId,
    customerId,
    channel: "whatsapp"
  });

  if (!conversation) {
    return Conversation.create({
      businessId,
      customerId,
      channel: "whatsapp",
      status: "open",
      lastMessage: "",
      lastMessageAt: new Date(),
      unreadCount: 0
    });
  }

  if (conversation.status !== "open") {
    await Conversation.updateOne(
      { _id: conversation._id, businessId },
      { $set: { status: "open" } }
    );
    conversation.status = "open";
  }

  return conversation;
};

/**
 * Store one inbound text message, its customer and conversation, and return
 * the job for an AI reply when replying is allowed. Shared by every provider.
 */
const recordInboundMessage = async ({
  business,
  from,
  text,
  providerMessageId,
  createdAt,
  contactName
}) => {
  if (providerMessageId) {
    const duplicate = await Message.exists({
      businessId: business._id,
      providerMessageId
    });
    if (duplicate) return null;
  }

  const digits = normalizePhone(from);
  if (!digits) return null;

  const customer = await findOrCreateCustomer({
    businessId: business._id,
    from: digits,
    name: contactName
  });
  const conversation = await findOrCreateConversation({
    businessId: business._id,
    customerId: customer._id
  });

  await Message.create({
    businessId: business._id,
    conversationId: conversation._id,
    customerId: customer._id,
    direction: "incoming",
    text,
    aiGenerated: false,
    status: "delivered",
    providerMessageId: providerMessageId || undefined
  });

  await Conversation.updateOne(
    { _id: conversation._id, businessId: business._id },
    {
      $set: {
        lastMessage: text,
        lastMessageAt: createdAt,
        status: "open"
      },
      $inc: { unreadCount: 1 }
    }
  );

  if (
    business.aiSettings?.autoReply === false ||
    business.whatsappSettings?.autoReply === false
  ) {
    return null;
  }

  // Without provider credentials the reply could never be delivered, so do not
  // generate a message that would only end up as failed.
  if (!isWhatsAppConfigured(business.whatsappSettings)) return null;

  return { business, customer, conversation, text };
};

/**
 * Persist inbound messages and status callbacks. Returns the jobs that need
 * an AI reply, which the HTTP handler runs after acknowledging Meta.
 */
export const ingestWebhookPayload = async (payload) => {
  const replies = [];

  for (const entry of payload?.entry || []) {
    for (const change of entry?.changes || []) {
      const value = change?.value || {};
      const phoneNumberId = value.metadata?.phone_number_id;
      const business = await findBusinessForWebhook({
        phoneNumberId,
        displayPhoneNumber: value.metadata?.display_phone_number
      });

      if (!business) continue;

      const contactName = value.contacts?.[0]?.profile?.name;

      for (const incoming of value.messages || []) {
        if (incoming.type !== "text") continue;

        const text = String(incoming.text?.body || "").trim().slice(0, LIMITS.messageText);
        if (!text) continue;

        const reply = await recordInboundMessage({
          business,
          from: incoming.from,
          text,
          providerMessageId: incoming.id,
          createdAt: incoming.timestamp
            ? new Date(Number(incoming.timestamp) * 1000)
            : new Date(),
          contactName
        });

        if (reply) replies.push(reply);
      }

      for (const status of value.statuses || []) {
        const next = String(status.status || "");
        if (!status.id || !["sent", "delivered", "read", "failed"].includes(next)) continue;

        await Message.updateOne(
          { businessId: business._id, providerMessageId: status.id },
          { $set: { status: next } }
        );
      }
    }
  }

  return replies;
};

const sendAutoReply = async ({ business, customer, conversation, text }) => {
  try {
    const products = await Product.find({
      businessId: business._id,
      isActive: true
    })
      .select("name description price stock unit")
      .sort({ createdAt: -1 })
      .limit(MAX_PRODUCTS_SCAN)
      .lean();

    const reply = await generateReply({
      businessName: business.name,
      products: selectProducts(products, text),
      message: text,
      settings: business.aiSettings
    });

    const replyText = String(reply || "").trim().slice(0, LIMITS.messageText);
    if (!replyText) return;

    let status = "failed";
    let providerMessageId = null;

    try {
      const result = await sendTextMessage({
        businessSettings: business.whatsappSettings,
        to: customer.phone,
        text: replyText
      });
      status = "sent";
      providerMessageId = result.messageId;
    } catch (error) {
      console.error("WhatsApp auto-reply failed:", error?.code || error?.message);
    }

    const message = await Message.create({
      businessId: business._id,
      conversationId: conversation._id,
      customerId: customer._id,
      direction: "outgoing",
      text: replyText,
      aiGenerated: true,
      status,
      providerMessageId
    });

    await Conversation.updateOne(
      { _id: conversation._id, businessId: business._id },
      {
        $set: {
          lastMessage: replyText,
          lastMessageAt: message.createdAt
        }
      }
    );
  } catch (error) {
    console.error("AI auto-reply error:", error?.code || error?.message);
  }
};

/** POST /api/whatsapp/webhook — Cloud API event receiver. */
export const receiveWebhook = async (req, res) => {
  if (!verifySignature(req)) {
    return res.sendStatus(401);
  }

  let replies;

  try {
    replies = await ingestWebhookPayload(req.body);
  } catch (error) {
    console.error("WhatsApp webhook processing failed:", error);
    return res.sendStatus(500);
  }

  // Acknowledge before running the (potentially slow) local model.
  res.sendStatus(200);

  for (const reply of replies) {
    void sendAutoReply(reply);
  }
};

const timingSafeEqualString = (a, b) => {
  const left = Buffer.from(String(a || ""));
  const right = Buffer.from(String(b || ""));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};

const waapiMessageBody = (payload) => payload?.data?.message || payload?.data || null;

const waapiMessageId = (message) => {
  const id = message?.id ?? message?._data?.id ?? message?.key;
  if (typeof id === "string") return id;
  return id?._serialized || id?.id || null;
};

const waapiTimestamp = (message) => {
  const raw = message?.timestamp ?? message?.t ?? message?._data?.t;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return new Date();

  // WaAPI sends seconds in most payload versions and milliseconds in others.
  const date = new Date(value > 1e12 ? value : value * 1000);
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

const findBusinessForWaapi = async (instanceId) => {
  const id = String(instanceId || "").trim();

  if (id) {
    const byInstance = await Business.findOne({
      "whatsappSettings.waapiInstanceId": id
    });
    if (byInstance) return byInstance;
  }

  if (process.env.WHATSAPP_BUSINESS_ID) {
    const configured = await Business.findById(process.env.WHATSAPP_BUSINESS_ID);
    if (configured) return configured;
  }

  // Single-tenant deployments do not need an explicit instance mapping.
  const count = await Business.estimatedDocumentCount();
  return count === 1 ? Business.findOne() : null;
};

export const ingestWaapiEvent = async (payload) => {
  if (payload?.event !== "message") return [];

  const message = waapiMessageBody(payload);
  if (!message) return [];

  const fromMe = message.fromMe ?? message._data?.fromMe ?? message.id?.fromMe;
  if (fromMe === true) return [];

  const sender = String(message.from || message._data?.from || "");
  if (!sender || sender.endsWith("@g.us") || sender.endsWith("@newsletter")) return [];

  // Only plain text is answered; media and stickers are ignored for now.
  const type = String(message.type || "chat");
  if (type !== "chat" && type !== "text") return [];

  const text = String(message.body || "").trim().slice(0, LIMITS.messageText);
  if (!text) return [];

  const business = await findBusinessForWaapi(payload.instanceId);
  if (!business) return [];

  const reply = await recordInboundMessage({
    business,
    from: sender,
    text,
    providerMessageId: waapiMessageId(message),
    createdAt: waapiTimestamp(message),
    contactName: message.notifyName || message._data?.notifyName
  });

  return reply ? [reply] : [];
};

/** POST /api/whatsapp/waapi/:secret — WaAPI event receiver. */
export const receiveWaapiWebhook = async (req, res) => {
  const secret = process.env.WAAPI_WEBHOOK_SECRET;

  if (!secret || !timingSafeEqualString(req.params.secret, secret)) {
    return res.sendStatus(401);
  }

  let replies;

  try {
    replies = await ingestWaapiEvent(req.body);
  } catch (error) {
    console.error("WaAPI webhook processing failed:", error);
    return res.sendStatus(500);
  }

  // Acknowledge before running the (potentially slow) local model.
  res.sendStatus(200);

  for (const reply of replies) {
    void sendAutoReply(reply);
  }
};
