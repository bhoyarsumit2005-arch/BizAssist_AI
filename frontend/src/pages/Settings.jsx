import { NavLink, useLocation } from "react-router-dom";
import { Brain, Check, MessageCircle, ShieldCheck, Sparkles, Users } from "lucide-react";

import AISettingsPanel from "../components/AISettingsPanel";
import StaffSettingsPanel from "../components/StaffSettingsPanel";
import WhatsAppSettingsPanel from "../components/WhatsAppSettingsPanel";

const copy = {
  ai: {
    title: "AI Settings",
    description: "Teach your assistant how to speak, what to know, and when to hand over to you."
  },
  whatsapp: {
    title: "WhatsApp Settings",
    description: "Connect your WhatsApp Cloud API number and manage the webhook."
  },
  team: {
    title: "Team",
    description: "Invite staff and control who can change business settings."
  }
};

export default function Settings() {
  const location = useLocation();
  const section = location.pathname.endsWith("/whatsapp")
    ? "whatsapp"
    : location.pathname.endsWith("/team")
      ? "team"
      : "ai";

  return (
    <div className="page settings-page">
      <header className="page-head">
        <div>
          <div className="page-head__eyebrow">
            <span>Configuration</span>
            <span className="chip chip--soft">
              {section === "team" ? <ShieldCheck size={12} /> : <Check size={12} />}
              {section === "team" ? "Owner access" : "Saved to your business"}
            </span>
          </div>
          <h2>{copy[section].title}</h2>
          <p>{copy[section].description}</p>
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
            <em>Connection and webhook</em>
          </span>
        </NavLink>
        <NavLink to="/settings/team" className={({ isActive }) => `settings-tab ${isActive ? "is-active" : ""}`}>
          <span className="settings-tab__icon settings-tab__icon--violet"><Users size={17} /></span>
          <span>
            <strong>Team</strong>
            <em>Staff access and roles</em>
          </span>
        </NavLink>
        <span className="settings-tabs__spacer" />
        <span className="settings-tabs__note">
          <Sparkles size={14} /> Changes apply to new conversations
        </span>
      </nav>

      {section === "whatsapp" ? (
        <WhatsAppSettingsPanel />
      ) : section === "team" ? (
        <StaffSettingsPanel />
      ) : (
        <AISettingsPanel />
      )}
    </div>
  );
}
