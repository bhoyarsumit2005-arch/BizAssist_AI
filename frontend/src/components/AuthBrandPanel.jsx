import { Link } from "react-router-dom";
import { Check, MessageCircle, ShieldCheck, Sparkles, TrendingUp, Zap } from "lucide-react";

const features = [
  { icon: Zap, title: "Reply in seconds", text: "Your assistant answers product and delivery questions 24/7." },
  { icon: TrendingUp, title: "Turn chats into orders", text: "Capture order details and customer context automatically." },
  { icon: ShieldCheck, title: "Always in your control", text: "Hand off to a human whenever a conversation needs you." }
];

export default function AuthBrandPanel() {
  return (
    <section className="auth-brand">
      <div className="auth-brand__orb auth-brand__orb--one" aria-hidden="true" />
      <div className="auth-brand__orb auth-brand__orb--two" aria-hidden="true" />

      <Link to="/" className="auth-brand__logo">
        <span className="brand-mark brand-mark--light">
          <Sparkles size={20} />
        </span>
        <span>
          <strong>BizAssist</strong>
          <em>AI</em>
        </span>
      </Link>

      <div className="auth-brand__content">
        <span className="auth-eyebrow">
          <span className="live-dot" /> Built for busy storefronts
        </span>
        <h1>
          Your storefront,
          <br />
          <span>on autopilot.</span>
        </h1>
        <p className="auth-brand__lede">
          One calm workspace for conversations, orders, products, and the AI teammate that keeps your business moving.
        </p>

        <ul className="auth-features">
          {features.map(({ icon: Icon, title, text }) => (
            <li key={title}>
              <span>
                <Icon size={17} />
              </span>
              <div>
                <strong>{title}</strong>
                <p>{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="auth-preview" aria-hidden="true">
        <div className="auth-chat-card">
          <div className="auth-chat-card__head">
            <span className="avatar avatar--xs">AS</span>
            <div>
              <strong>Aarav Sharma</strong>
              <span>Customer · just now</span>
            </div>
            <span className="chip chip--success">AI</span>
          </div>
          <div className="auth-bubble auth-bubble--in">Do you have the candle in a larger size?</div>
          <div className="auth-bubble auth-bubble--out">
            Yes! The 300 g jar is ₹899 and ships tomorrow. Want me to reserve one?
            <span className="auth-bubble__time">Delivered · 2s</span>
          </div>
        </div>
        <div className="auth-order-chip">
          <span className="auth-order-chip__icon">
            <MessageCircle size={15} />
          </span>
          <div>
            <span>Order captured</span>
            <strong>₹1,798 · 2 items</strong>
          </div>
          <Check size={16} />
        </div>
      </div>

      <div className="auth-brand__footer">
        <div className="auth-avatars" aria-hidden="true">
          <span>AS</span>
          <span>PP</span>
          <span>RM</span>
          <span>+2k</span>
        </div>
        <p>
          Trusted by 2,000+ growing businesses
          <br />
          <span>to run smarter conversations.</span>
        </p>
      </div>
    </section>
  );
}
