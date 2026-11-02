import { NavLink, useLocation } from "react-router-dom";
import { Brain, Check, MessageCircle, Sparkles } from "lucide-react";

import AISettingsPanel from "../components/AISettingsPanel";
import WhatsAppSettingsPanel from "../components/WhatsAppSettingsPanel";

export default function Settings() {
  const location = useLocation();
  const isWhatsApp = location.pathname.endsWith("/whatsapp");

  return (
    <div className="page settings-page">
      <header className="page-head">
        <div>
          <div className="page-head__eyebrow">
            <span>Configuration</span>
            <span className="chip chip--soft"><Check size={12} /> Saved locally</span>
          </div>
          <h2>{isWhatsApp ? "WhatsApp Settings" : "AI Settings"}</h2>
          <p>
            {isWhatsApp
              ? "Manage your WhatsApp connection, message templates, and webhook."
              : "Teach your assistant how to speak, what to know, and when to hand over to you."}
          </p>
        </div>
        <div className="page-head__actions">
          <LinkTab />
        </div>
      </header>

      <nav className="settings-tabs" aria-label="Settings sections">
        <NavLink to="/settings/ai" className={({ isActive }) => `settings-tab ${isActive ? "is-active" : ""}`}>
          <span className="settings-tab__icon"><Brain size={17} /></span>
          <span>
            <strong>AI assistant</strong>
            <em>Instructions, language, and automation</em>
          </span>
        </NavLink>
        <NavLink to="/settings/whatsapp" className={({ isActive }) => `settings-tab ${isActive ? "is-active" : ""}`}>
          <span className="settings-tab__icon settings-tab__icon--green"><MessageCircle size={17} /></span>
          <span>
            <strong>WhatsApp</strong>
            <em>Connection, templates, and webhook</em>
          </span>
        </NavLink>
        <span className="settings-tabs__spacer" />
        <span className="settings-tabs__note">
          <Sparkles size={14} /> Changes apply to new conversations
        </span>
      </nav>

      {isWhatsApp ? <WhatsAppSettingsPanel /> : <AISettingsPanel />}
    </div>
  );
}

function LinkTab() {
  const location = useLocation();
  const isWhatsApp = location.pathname.endsWith("/whatsapp");

  return (
    <NavLink to={isWhatsApp ? "/settings/ai" : "/settings/whatsapp"} className="btn btn-secondary">
      {isWhatsApp ? <Brain size={16} /> : <MessageCircle size={16} />}
      {isWhatsApp ? "AI settings" : "WhatsApp settings"}
    </NavLink>
  );
}
