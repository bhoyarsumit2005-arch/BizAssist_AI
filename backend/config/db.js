import mongoose from "mongoose";

const MAX_ATTEMPTS = 5;
const BASE_RETRY_DELAY_MS = 3000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// These failures will not be fixed by retrying (bad credentials, etc.).
const isPermanentFailure = (message = "") =>
  /authentication failed|bad auth|not authorized|invalid (user|password)/i.test(message);

/**
 * Atlas occasionally rejects a TLS handshake (for example `SSL alert number
 * 80`) while a cluster is waking up or an IP allowlist change is propagating.
 * Retrying with a short backoff avoids crashing the API on those transients.
 */
const connectDB = async () => {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 10000
      });

      console.log("MongoDB Connected Successfully!");
      return;
    } catch (error) {
      const message = error?.message || "Unknown MongoDB error";

      console.error(
        `MongoDB Connection Failed (attempt ${attempt}/${MAX_ATTEMPTS}):`,
        message
      );

      if (isPermanentFailure(message)) {
        console.error("MongoDB credentials were rejected. Check MONGODB_URI.");
        process.exit(1);
      }

      if (/SSL alert number 80|tlsv1 alert/i.test(message)) {
        console.error(
          "TLS handshake rejected by Atlas. Check the cluster is running and this machine's public IP is in Atlas → Network Access."
        );
      }

      if (attempt === MAX_ATTEMPTS) {
        process.exit(1);
      }

      await sleep(BASE_RETRY_DELAY_MS * attempt);
    }
  }
};

export default connectDB;
