import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, Mail, Sparkles } from "lucide-react";

import AuthBrandPanel from "../components/AuthBrandPanel";
import api, { getErrorMessage } from "../services/api";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [resetToken, setResetToken] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Enter the email address you signed up with.");
      return;
    }

    setSubmitting(true);

    try {
      const { data } = await api.post("/auth/forgot-password", { email: email.trim() });
      setSent(true);
      setResetToken(data?.resetToken || "");
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Could not send the reset email. Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-shell">
      <AuthBrandPanel />

      <section className="auth-panel">
        <div className="auth-panel__inner">
          <div className="auth-mobile-brand">
            <span className="brand-mark">
              <Sparkles size={18} />
            </span>
            <strong>BizAssist AI</strong>
          </div>

          <header className="auth-head">
            <span className="chip chip--soft">Account recovery</span>
            <h2>Reset your password</h2>
            <p>We&apos;ll email you a link that is valid for 30 minutes.</p>
          </header>

          {error ? (
            <div className="alert alert--error" role="alert">
              <AlertCircle size={17} />
              <span>{error}</span>
            </div>
          ) : null}

          {sent ? (
            <div className="alert alert--success" role="status">
              <CheckCircle2 size={17} />
              <span>
                If an account exists for {email.trim()}, a reset link is on its way. Check your inbox and spam
                folder.
              </span>
            </div>
          ) : null}

          {resetToken ? (
            <div className="alert alert--info" role="status">
              <Mail size={17} />
              <span>
                Email is not configured on this server, so use the local reset link below.
                <br />
                <Link to={`/reset-password?token=${encodeURIComponent(resetToken)}`}>
                  Open password reset form
                </Link>
              </span>
            </div>
          ) : null}

          {!sent ? (
            <form className="auth-form" onSubmit={handleSubmit} noValidate>
              <div className="field">
                <label htmlFor="resetEmail">Email address</label>
                <div className="input-affix">
                  <Mail size={17} />
                  <input
                    id="resetEmail"
                    type="email"
                    autoComplete="email"
                    placeholder="you@business.com"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      if (error) setError("");
                    }}
                    autoFocus
                  />
                </div>
              </div>

              <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 size={18} className="spin" /> Sending…
                  </>
                ) : (
                  "Send reset link"
                )}
              </button>
            </form>
          ) : null}

          <p className="auth-switch">
            <Link to="/login">
              <ArrowLeft size={14} /> Back to sign in
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
