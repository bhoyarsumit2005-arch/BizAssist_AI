import express from "express";

import {
  receiveWaapiWebhook,
  receiveWebhook,
  verifyWebhook
} from "../controllers/whatsappController.js";

const router = express.Router();

// Public by design: providers cannot send a JWT.
// Meta: verify token (GET handshake) + app-secret HMAC (POST).
router.get("/webhook", verifyWebhook);
router.post("/webhook", receiveWebhook);

// WaAPI: the secret lives in the URL path, which is what WaAPI supports.
router.post("/waapi/:secret", receiveWaapiWebhook);

export default router;
