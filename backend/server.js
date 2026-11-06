import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";

import connectDB from "./config/db.js";

import authRoutes from "./routes/authRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import customerRoutes from "./routes/customerRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";
import settingsRoutes from "./routes/settingsRoutes.js";
import conversationRoutes from "./routes/conversationRoutes.js";
import staffRoutes from "./routes/staffRoutes.js";
import { repairStockRestores } from "./controllers/orderController.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";

dotenv.config();

const NODE_ENV = process.env.NODE_ENV || "development";

const app = express();

app.disable("x-powered-by");
app.set("env", NODE_ENV);

/**
 * Behind a reverse proxy (Render, Railway, nginx) the client IP is only
 * trustworthy when Express is told how many hops to trust. Default to one hop
 * in production; set TRUST_PROXY=false when the process is directly exposed.
 */
const trustProxySetting = () => {
  const raw = process.env.TRUST_PROXY;

  if (raw && /^false$/i.test(raw)) return false;
  if (raw && /^\d+$/.test(raw)) return Number(raw);
  if (raw) return raw;

  return NODE_ENV === "production" ? 1 : false;
};

app.set("trust proxy", trustProxySetting());

const allowedOrigins = [...new Set(
  [process.env.FRONTEND_URL, ...(process.env.CORS_ORIGINS || "").split(",")]
    .map((origin) => (origin || "").trim())
    .filter(Boolean)
)];

app.use(helmet());

app.use(cors({
  origin(origin, callback) {
    // No Origin header: curl, server-to-server calls, and native mobile apps.
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) return callback(null, true);

    const error = new Error("Origin not allowed by CORS");
    error.status = 403;
    return callback(error);
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  maxAge: 600
}));

app.use(express.json({ limit: "1mb" }));

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/conversations", conversationRoutes);
app.use("/api/staff", staffRoutes);

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "BizAssist AI Backend Running"
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    database: "Check MongoDB connection logs"
  });
});

// Any unmatched route returns JSON instead of Express's HTML default.
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  if (!process.env.JWT_SECRET) {
    console.error("JWT_SECRET is not set. Refusing to start.");
    process.exit(1);
  }

  if (process.env.JWT_SECRET.length < 32) {
    console.warn("JWT_SECRET is shorter than 32 characters; use a longer random secret.");
  }

  await connectDB();

  try {
    const repaired = await repairStockRestores();
    if (repaired) {
      console.log(`Recovered stock for ${repaired} interrupted cancellation(s)`);
    }
  } catch (error) {
    console.error("Stock restore recovery failed:", error);
  }

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} (${NODE_ENV})`);
  });
};

startServer();
