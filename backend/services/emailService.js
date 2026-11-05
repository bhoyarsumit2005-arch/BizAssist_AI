/**
 * Password-reset delivery.
 *
 * A transactional email provider is optional in development: when Resend is
 * not configured the reset link is written to the server log so the operator
 * can still complete the flow. Credentials never go to the browser.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

export const passwordResetUrl = (token) => {
  const base = (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/+$/, "");
  return `${base}/reset-password?token=${encodeURIComponent(token)}`;
};

export const sendPasswordResetEmail = async ({ to, name, resetUrl }) => {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "BizAssist AI <onboarding@resend.dev>";

  if (!apiKey) {
    console.warn(`[auth] Password reset link for ${to}: ${resetUrl}`);
    return { delivered: false, reason: "email_not_configured" };
  }

  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: "Reset your BizAssist AI password",
      text: `Hi ${name || "there"},\n\nReset your password with this link (valid for 30 minutes):\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
      html: `<p>Hi ${escapeHtml(name || "there")},</p>
<p>Reset your password with this link. It is valid for 30 minutes:</p>
<p><a href="${escapeHtml(resetUrl)}">Reset my password</a></p>
<p>If you did not request this, you can ignore this email.</p>`
    }),
    signal: AbortSignal.timeout(10000)
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Reset email failed (${response.status}): ${detail.slice(0, 200)}`);
  }

  return { delivered: true };
};
