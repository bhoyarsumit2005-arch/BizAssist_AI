import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { AlertCircle, ArrowRight, Eye, EyeOff, Loader2, Lock, Mail, Sparkles } from "lucide-react";

import AuthBrandPanel from "../components/AuthBrandPanel";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { getErrorMessage } from "../services/api";

export default function Login() {
  const { login, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  const update = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
    if (error) setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!form.email.trim() || !form.password) {
      setError("Enter your email and password to continue.");
      return;
    }

    setSubmitting(true);
    try {
      const data = await login(form.email.trim(), form.password);
      toast(`Welcome back, ${data.user?.name?.split(" ")[0] || "there"}!`);
      navigate("/dashboard", { replace: true });
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Login failed. Please check your details."));
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
            <span className="chip chip--soft">Welcome back</span>
            <h2>Sign in to your workspace</h2>
            <p>Pick up where you left off — your store, AI, and inbox are ready.</p>
          </header>

          {error ? (
            <div className="alert alert--error" role="alert">
              <AlertCircle size={17} />
              <span>{error}</span>
            </div>
          ) : null}

          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            <div className="field">
              <label htmlFor="email">Email address</label>
              <div className="input-affix">
                <Mail size={17} />
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@business.com"
                  value={form.email}
                  onChange={update("email")}
                  autoFocus
                />
              </div>
            </div>

            <div className="field">
              <div className="field__label-row">
                <label htmlFor="password">Password</label>
                <Link to="/forgot-password" className="link-btn">
                  Forgot password?
                </Link>
              </div>
              <div className="input-affix">
                <Lock size={17} />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={form.password}
                  onChange={update("password")}
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

            <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 size={18} className="spin" /> Signing in…
                </>
              ) : (
                <>
                  Sign in <ArrowRight size={17} />
                </>
              )}
            </button>
          </form>

          <p className="auth-switch">
            New to BizAssist? <Link to="/register">Create your free account</Link>
          </p>

          <div className="auth-trust">
            <span className="live-dot" /> Your data is encrypted and never shared.
          </div>
        </div>
      </section>
    </div>
  );
}
