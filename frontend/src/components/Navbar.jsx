import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowUpRight,
  Bell,
  Brain,
  CheckCheck,
  ChevronDown,
  LogOut,
  Menu,
  ShoppingCart,
  Sparkles
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { formatDate, initials } from "../utils/format";

const titles = {
  "/dashboard": { eyebrow: "Workspace", title: "Dashboard" },
  "/products": { eyebrow: "Workspace", title: "Products" },
  "/orders": { eyebrow: "Workspace", title: "Orders" },
  "/customers": { eyebrow: "Workspace", title: "Customers" },
  "/conversations": { eyebrow: "Workspace", title: "Conversations" },
  "/analytics": { eyebrow: "Workspace", title: "Analytics" },
  "/settings/ai": { eyebrow: "Configuration", title: "AI Settings" }
};

const notifications = [
  { icon: ShoppingCart, title: "New order received", detail: "Order #1042 · ₹1,298", time: "4m ago", tone: "emerald" },
  { icon: AlertTriangle, title: "Low stock alert", detail: "Masala Chai Blend · 5 left", time: "26m ago", tone: "amber" }
];

export default function Navbar({ onMenuOpen }) {
  const { user, business, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [userMenu, setUserMenu] = useState(false);
  const [bellMenu, setBellMenu] = useState(false);
  const [unread, setUnread] = useState(true);
  const userRef = useRef(null);
  const bellRef = useRef(null);

  const meta = titles[location.pathname] || { eyebrow: "Workspace", title: "BizAssist" };

  useEffect(() => {
    const onClick = (event) => {
      if (userRef.current && !userRef.current.contains(event.target)) setUserMenu(false);
      if (bellRef.current && !bellRef.current.contains(event.target)) setBellMenu(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    setUserMenu(false);
    setBellMenu(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <header className="topbar">
      <div className="topbar__left">
        <button type="button" className="icon-btn topbar__menu" onClick={onMenuOpen} aria-label="Open navigation">
          <Menu size={20} />
        </button>
        <div className="topbar__title">
          <span>{meta.eyebrow}</span>
          <h1>{meta.title}</h1>
        </div>
      </div>

      <div className="topbar__right">
        <span className="desk-date">{formatDate(new Date(), { weekday: "short" })}</span>

        <span className="live-pill">
          AI assistant
        </span>

        <div className="popover-wrap" ref={bellRef}>
          <button
            type="button"
            className={`icon-btn ${bellMenu ? "is-active" : ""}`}
            onClick={() => setBellMenu((value) => !value)}
            aria-label="Notifications"
            aria-expanded={bellMenu}
          >
            <Bell size={19} />
            {unread ? <span className="notif-dot" /> : null}
          </button>
          {bellMenu ? (
            <div className="popover popover--notifications">
              <div className="popover__head">
                <strong>Notifications</strong>
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => setUnread(false)}
                  disabled={!unread}
                >
                  <CheckCheck size={14} /> Mark read
                </button>
              </div>
              <div className="notif-list">
                {notifications.map(({ icon: Icon, title, detail, time, tone }) => (
                  <div className="notif-item" key={title}>
                    <span className={`notif-icon notif-icon--${tone}`}>
                      <Icon size={16} />
                    </span>
                    <div>
                      <strong>{title}</strong>
                      <p>{detail}</p>
                    </div>
                    <time>{time}</time>
                  </div>
                ))}
              </div>
              <Link className="popover__footer" to="/conversations">
                Open inbox <ArrowUpRight size={14} />
              </Link>
            </div>
          ) : null}
        </div>

        <div className="topbar__divider" />

        <div className="popover-wrap" ref={userRef}>
          <button
            type="button"
            className="user-trigger"
            onClick={() => setUserMenu((value) => !value)}
            aria-expanded={userMenu}
          >
            <span className="avatar">{initials(user?.name || "Owner")}</span>
            <span className="user-trigger__copy">
              <strong>{user?.name || "Owner"}</strong>
              <small>{business?.name || "Your business"}</small>
            </span>
            <ChevronDown size={15} />
          </button>

          {userMenu ? (
            <div className="popover popover--user">
              <div className="popover__profile">
                <span className="avatar avatar--lg">{initials(user?.name || "Owner")}</span>
                <div>
                  <strong>{user?.name || "Owner"}</strong>
                  <span>{user?.email || "owner@store.com"}</span>
                  <em>{user?.role === "owner" ? "Business owner" : "Team member"}</em>
                </div>
              </div>
              <Link to="/settings/ai" className="popover__item">
                <Brain size={16} /> AI settings
              </Link>
              <button type="button" className="popover__item popover__item--danger" onClick={handleLogout}>
                <LogOut size={16} /> Sign out
              </button>
              <div className="popover__brand">
                <Sparkles size={13} /> BizAssist AI · Growth plan
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
