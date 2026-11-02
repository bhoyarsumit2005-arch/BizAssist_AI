import { NavLink } from "react-router-dom";
import {
  BarChart3,
  Brain,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  MessagesSquare,
  Package,
  ShoppingCart,
  Sparkles,
  Users,
  X
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { initials } from "../utils/format";

const mainNav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/products", label: "Products", icon: Package },
  { to: "/orders", label: "Orders", icon: ShoppingCart },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/conversations", label: "Conversations", icon: MessagesSquare, badge: "3" },
  { to: "/analytics", label: "Analytics", icon: BarChart3 }
];

const settingsNav = [
  { to: "/settings/ai", label: "AI Settings", icon: Brain },
  { to: "/settings/whatsapp", label: "WhatsApp Settings", icon: MessageCircle }
];

export default function Sidebar({ open, onClose }) {
  const { user, business, logout } = useAuth();

  return (
    <>
      <div className={`sidebar-overlay ${open ? "is-visible" : ""}`} onClick={onClose} aria-hidden="true" />
      <aside className={`sidebar ${open ? "is-open" : ""}`}>
        <div className="sidebar__brand">
          <span className="brand-mark">
            <Sparkles size={20} />
          </span>
          <div className="brand-copy">
            <strong>BizAssist</strong>
            <span>AI business assistant</span>
          </div>
          <button type="button" className="icon-btn sidebar__close" onClick={onClose} aria-label="Close navigation">
            <X size={18} />
          </button>
        </div>

        <div className="sidebar__workspace">
          <span className="workspace-avatar">{initials(business?.name || "BizAssist")}</span>
          <div>
            <strong>{business?.name || "Your business"}</strong>
            <span>{business?.category || "Workspace"}</span>
          </div>
        </div>

        <nav className="sidebar__nav" aria-label="Main navigation">
          <p className="nav-label">Workspace</p>
          {mainNav.map(({ to, label, icon: Icon, badge }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `nav-link ${isActive ? "is-active" : ""}`}
              onClick={onClose}
            >
              <Icon size={18} />
              <span>{label}</span>
              {badge ? <em className="nav-badge">{badge}</em> : null}
            </NavLink>
          ))}

          <p className="nav-label nav-label--spaced">Configuration</p>
          {settingsNav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `nav-link ${isActive ? "is-active" : ""}`}
              onClick={onClose}
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar__spacer" />

        <div className="sidebar__assistant">
          <span className="assistant-orb">
            <Sparkles size={16} />
          </span>
          <div>
            <strong>AI assistant is live</strong>
            <p>Replying to customers automatically</p>
          </div>
        </div>

        <div className="sidebar__user">
          <span className="avatar avatar--sm">{initials(user?.name || "Owner")}</span>
          <div>
            <strong>{user?.name || "Owner"}</strong>
            <span>{user?.email || "owner@store.com"}</span>
          </div>
          <button type="button" className="icon-btn icon-btn--dark" onClick={logout} aria-label="Log out">
            <LogOut size={16} />
          </button>
        </div>
      </aside>
    </>
  );
}
