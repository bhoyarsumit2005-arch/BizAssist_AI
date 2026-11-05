import { useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  Check,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  MapPin,
  Phone,
  Sparkles,
  UserRound
} from "lucide-react";

import AuthBrandPanel from "../components/AuthBrandPanel";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { getErrorMessage } from "../services/api";

const categories = [
  "Retail & lifestyle",
  "Grocery & essentials",
  "Fashion & apparel",
  "Beauty & wellness",
  "Electronics",
  "Food & beverage",
  "Pharmacy",
  "Services",
  "Other"
];

const initialForm = {
  name: "",
  email: "",
  password: "",
  confirmPassword: "",
  businessName: "",
  businessCategory: "",
  phone: "",
  address: ""
};

const strengthOf = (password) => {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password) || /[^A-Za-z0-9]/.test(password)) score += 1;
  return score;
};

export default function Register() {
  const { register, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState(initialForm);
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const strength = useMemo(() => strengthOf(form.password), [form.password]);

  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  const update = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
    if (error) setError("");
  };

  const validate = () => {
    if (!form.name.trim()) return "Enter your full name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return "Enter a valid email address.";
    if (form.password.length < 8) return "Password must be at least 8 characters.";
    if (form.password.length > 72) return "Password must be 72 characters or fewer.";
    if (form.password !== form.confirmPassword) return "Passwords do not match.";
    if (!form.businessName.trim()) return "Enter your shop or business name.";
    if (!form.businessCategory) return "Choose a business category.";
    if (!agreed) return "Please accept the terms to create your account.";
    return "";
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError("");
    setSubmitting(true);

    try {
      const data = await register({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        businessName: form.businessName.trim(),
        businessCategory: form.businessCategory,
        phone: form.phone.trim(),
        address: form.address.trim()
      });
      toast(`Your workspace is ready, ${data.user?.name?.split(" ")[0] || "welcome"}!`);
      navigate("/dashboard", { replace: true });
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Registration failed. Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-shell auth-shell--register">
      <AuthBrandPanel />

      <section className="auth-panel">
        <div className="auth-panel__inner auth-panel__inner--wide">
          <div className="auth-mobile-brand">
            <span className="brand-mark">
              <Sparkles size={18} />
            </span>
            <strong>BizAssist AI</strong>
          </div>

          <header className="auth-head">
            <span className="chip chip--soft">Start free · No card required</span>
            <h2>Set up your business</h2>
            <p>Two minutes now, and your AI assistant can start helping customers today.</p>
          </header>

          {error ? (
            <div className="alert alert--error" role="alert">
              <AlertCircle size={17} />
              <span>{error}</span>
            </div>
          ) : null}

          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            <div className="form-section">
              <div className="form-section__head">
                <span className="form-step">1</span>
                <div>
                  <h3>Owner details</h3>
                  <p>Your personal login for the dashboard.</p>
                </div>
              </div>

              <div className="form-grid">
                <div className="field">
                  <label htmlFor="name">Full name</label>
                  <div className="input-affix">
                    <UserRound size={17} />
                    <input
                      id="name"
                      type="text"
                      autoComplete="name"
                      placeholder="Aarav Sharma"
                      value={form.name}
                      onChange={update("name")}
                      autoFocus
                    />
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="email">Email address</label>
                  <div className="input-affix">
                    <Mail size={17} />
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@business.com"
                      value={form.email}
                      onChange={update("email")}
                    />
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="password">Password</label>
                  <div className="input-affix">
                    <Lock size={17} />
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="At least 8 characters"
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
                  <div className={`strength strength--${strength}`}>
                    <span /><span /><span /><span />
                    <em>{form.password ? ["Too short", "Fair", "Good", "Strong", "Excellent"][strength] : ""}</em>
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="confirmPassword">Confirm password</label>
                  <div className="input-affix">
                    <Lock size={17} />
                    <input
                      id="confirmPassword"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="Re-enter password"
                      value={form.confirmPassword}
                      onChange={update("confirmPassword")}
                    />
                    {form.confirmPassword && form.confirmPassword === form.password ? (
                      <span className="input-affix__valid">
                        <Check size={16} />
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <div className="form-section">
              <div className="form-section__head">
                <span className="form-step">2</span>
                <div>
                  <h3>Shop details</h3>
                  <p>This is what customers and your assistant will know.</p>
                </div>
              </div>

              <div className="form-grid">
                <div className="field">
                  <label htmlFor="businessName">Business name</label>
                  <div className="input-affix">
                    <Building2 size={17} />
                    <input
                      id="businessName"
                      type="text"
                      autoComplete="organization"
                      placeholder="Bloom & Co."
                      value={form.businessName}
                      onChange={update("businessName")}
                    />
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="businessCategory">Business category</label>
                  <div className="select-wrap">
                    <select
                      id="businessCategory"
                      value={form.businessCategory}
                      onChange={update("businessCategory")}
                    >
                      <option value="">Select a category</option>
                      {categories.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="phone">
                    Business phone <span className="optional">optional</span>
                  </label>
                  <div className="input-affix">
                    <Phone size={17} />
                    <input
                      id="phone"
                      type="tel"
                      autoComplete="tel"
                      placeholder="+91 98765 43210"
                      value={form.phone}
                      onChange={update("phone")}
                    />
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="address">
                    Shop address <span className="optional">optional</span>
                  </label>
                  <div className="input-affix">
                    <MapPin size={17} />
                    <input
                      id="address"
                      type="text"
                      autoComplete="street-address"
                      placeholder="Indiranagar, Bengaluru"
                      value={form.address}
                      onChange={update("address")}
                    />
                  </div>
                </div>
              </div>
            </div>

            <label className="checkbox-row">
              <input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} />
              <span className="checkbox-box" aria-hidden="true">
                <Check size={13} />
              </span>
              <span>
                I agree to the <a href="#terms" onClick={(event) => event.preventDefault()}>Terms of Service</a> and{" "}
                <a href="#privacy" onClick={(event) => event.preventDefault()}>Privacy Policy</a>.
              </span>
            </label>

            <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 size={18} className="spin" /> Creating your workspace…
                </>
              ) : (
                <>
                  Create account <ArrowRight size={17} />
                </>
              )}
            </button>
          </form>

          <p className="auth-switch">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </div>
      </section>
    </div>
  );
}
