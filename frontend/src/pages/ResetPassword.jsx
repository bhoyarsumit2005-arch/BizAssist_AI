import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AlertCircle, ArrowLeft, Eye, EyeOff, Loader2, Lock, Sparkles } from "lucide-react";

import AuthBrandPanel from "../components/AuthBrandPanel";
import { useToast } from "../context/ToastContext";
import api, { getErrorMessage } from "../services/api";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!token) {
      setError("This reset link is missing its token. Request a new email.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password.length > 72) {
      setError("Password must be 72 characters or fewer.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);

    try {
      await api.post("/auth/reset-password", { token, password });
      toast("Password updated. Sign in with your new password.");
      navigate("/login", { replace: true });
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Could not reset your password. Request a new link."));
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
            <h2>Choose a new password</h2>
            <p>Use at least 8 characters. Your other sessions will be signed out.</p>
          </header>

          {error ? (
            <div className="alert alert--error" role="alert">
              <AlertCircle size={17} />
              <span>{error}</span>
            </div>
          ) : null}

          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            <div className="field">
              <label htmlFor="newPassword">New password</label>
              <div className="input-affix">
                <Lock size={17} />
                <input
                  id="newPassword"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    if (error) setError("");
                  }}
                  autoFocus
                />
                <button
                  type="button"
                  className="input-affix__button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <div className="field">
              <label htmlFor="confirmNewPassword">Confirm password</label>
              <div className="input-affix">
                <Lock size={17} />
                <input
                  id="confirmNewPassword"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(event) => {
                    setConfirmPassword(event.target.value);
                    if (error) setError("");
                  }}
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 size={18} className="spin" /> Updating…
                </>
              ) : (
                "Update password"
              )}
            </button>
          </form>

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
