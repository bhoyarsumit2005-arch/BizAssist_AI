import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCheck,
  ChevronRight,
  CircleDot,
  Copy,
  Eye,
  EyeOff,
  Link2,
  Loader2,
  MessageCircle,
  PlugZap,
  Power,
  QrCode,
  RefreshCw,
  Save,
  ShieldCheck,
  Smartphone,
  Unplug,
  Wifi
} from "lucide-react";

import { useToast } from "../context/ToastContext";
import { defaultWhatsAppSettings } from "../services/demo";

const STORAGE_KEY = "bizassist:whatsapp-settings";

const loadSettings = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    return { ...defaultWhatsAppSettings, ...(stored || {}) };
  } catch {
    return { ...defaultWhatsAppSettings };
  }
};

const persist = (settings) => localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));

const finder = (row, col) => {
  const inTopLeft = row < 7 && col < 7;
  const inTopRight = row < 7 && col >= 18;
  const inBottomLeft = row >= 18 && col < 7;

  const pattern = (r, c) => {
    const ring = r === 0 || r === 6 || c === 0 || c === 6;
    const center = r >= 2 && r <= 4 && c >= 2 && c <= 4;
    return ring || center;
  };

  if (inTopLeft) return pattern(row, col);
  if (inTopRight) return pattern(row, col - 18);
  if (inBottomLeft) return pattern(row - 18, col);
  return null;
};

const makeQrMatrix = (seed) => {
  let state = seed * 9301 + 49297;

  return Array.from({ length: 25 }, (_, row) =>
    Array.from({ length: 25 }, (_, col) => {
      const fixed = finder(row, col);
      if (fixed !== null) return fixed;
      state = (state * 9301 + 49297) % 233280;
      return state / 233280 > 0.52;
    })
  );
};

export default function WhatsAppSettingsPanel() {
  const { toast } = useToast();
  const [settings, setSettings] = useState(loadSettings);
  const [tokenVisible, setTokenVisible] = useState(false);
  const [qrSeed, setQrSeed] = useState(7);
  const [saving, setSaving] = useState(false);

  const matrix = useMemo(() => makeQrMatrix(qrSeed), [qrSeed]);
  const connected = settings.connected;

  const update = (field, value) => setSettings((current) => ({ ...current, [field]: value }));

  const setConnected = (next) => {
    const nextSettings = { ...settings, connected: next };
    setSettings(nextSettings);
    persist(nextSettings);
    toast(next ? "WhatsApp connected. New messages will sync shortly." : "WhatsApp disconnected from this workspace.", next ? "success" : "info");
  };

  const handleSave = () => {
    setSaving(true);
    persist(settings);
    setTimeout(() => {
      setSaving(false);
      toast("WhatsApp settings saved.");
    }, 450);
  };

  const copy = async (value, label) => {
    try {
      await navigator.clipboard.writeText(value);
      toast(`${label} copied.`);
    } catch {
      toast("Could not copy automatically. Select the text and copy it manually.", "error");
    }
  };

  return (
    <div className="settings-grid">
      <div className="settings-main">
        <section className="card wa-hero">
          <div className="wa-hero__copy">
            <div className="wa-hero__title">
              <span className={`wa-logo ${connected ? "" : "is-off"}`}>
                <MessageCircle size={24} />
              </span>
              <div>
                <h3>WhatsApp Business</h3>
                <p>Connect the number your customers already message.</p>
              </div>
              <span className={`chip chip--${connected ? "success" : "warning"}`}>
                <span className="live-dot" /> {connected ? "Connected" : "Not connected"}
              </span>
            </div>

            {connected ? (
              <>
                <div className="wa-hero__meta">
                  <div><span>Number</span><strong>{settings.phone}</strong></div>
                  <div><span>Display name</span><strong>{settings.displayName}</strong></div>
                  <div><span>Webhook</span><strong className="text-success">Healthy</strong></div>
                </div>
                <div className="wa-hero__actions">
                  <button type="button" className="btn btn-secondary" onClick={() => toast("Message sync started. Latest messages will appear in your inbox.", "info")}>
                    <RefreshCw size={15} /> Sync messages
                  </button>
                  <button type="button" className="btn btn-ghost btn-ghost--danger" onClick={() => setConnected(false)}>
                    <Unplug size={15} /> Disconnect
                  </button>
                </div>
                <p className="wa-hero__hint">
                  <ShieldCheck size={14} /> Securely linked through the official WhatsApp Business API.
                </p>
              </>
            ) : (
              <div className="wa-connect">
                <p>Scan the code with WhatsApp Business on your phone to reconnect this workspace.</p>
                <div className="wa-connect__actions">
                  <button type="button" className="btn btn-primary" onClick={() => setConnected(true)}>
                    <PlugZap size={16} /> I have scanned the code
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => setQrSeed((value) => value + 1)}>
                    <RefreshCw size={15} /> Refresh QR
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="wa-hero__visual">
            {connected ? (
              <div className="wa-device">
                <div className="wa-device__top">
                  <span className="wa-device__avatar">{settings.displayName?.slice(0, 2).toUpperCase() || "BC"}</span>
                  <div><strong>{settings.displayName}</strong><span><span className="live-dot" /> Online</span></div>
                  <MessageCircle size={16} />
                </div>
                <div className="wa-device__bubble wa-device__bubble--in">Is the gift box still available?</div>
                <div className="wa-device__bubble wa-device__bubble--out">
                  Yes! It&apos;s ₹549 and ships tomorrow. Want me to reserve one?
                  <CheckCheck size={12} />
                </div>
                <div className="wa-device__bubble wa-device__bubble--in">Perfect, please do.</div>
                <div className="wa-device__typing"><span /><span /><span /></div>
              </div>
            ) : (
              <div className="wa-qr">
                <div className="wa-qr__frame">
                  <div className="qr-grid" style={{ "--qr-size": matrix.length }}>
                    {matrix.flatMap((row, rowIndex) =>
                      row.map((filled, colIndex) => (
                        <span key={`${rowIndex}-${colIndex}`} className={filled ? "is-filled" : ""} />
                      ))
                    )}
                  </div>
                  <span className="wa-qr__logo"><MessageCircle size={14} /></span>
                </div>
                <span><QrCode size={14} /> WhatsApp Business · refreshes every 60s</span>
              </div>
            )}
          </div>
        </section>

        <section className="card settings-card">
          <div className="settings-card__head">
            <span className="settings-card__icon settings-card__icon--green"><Smartphone size={18} /></span>
            <div>
              <h3>Profile &amp; connection</h3>
              <p>Details customers see, plus the technical bits for your webhook.</p>
            </div>
          </div>

          <div className="form-grid">
            <div className="field">
              <label htmlFor="waName">Display name</label>
              <input id="waName" type="text" value={settings.displayName} onChange={(event) => update("displayName", event.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="waPhone">WhatsApp number</label>
              <input id="waPhone" type="tel" value={settings.phone} onChange={(event) => update("phone", event.target.value)} />
            </div>
            <div className="field field--full">
              <label htmlFor="waWebhook"><Link2 size={14} /> Webhook URL</label>
              <div className="copy-field">
                <input id="waWebhook" type="text" value={settings.webhookUrl} readOnly />
                <button type="button" className="icon-btn" onClick={() => copy(settings.webhookUrl, "Webhook URL")} aria-label="Copy webhook URL">
                  <Copy size={15} />
                </button>
              </div>
              <p className="field-hint">Incoming messages and delivery receipts are posted here.</p>
            </div>
            <div className="field field--full">
              <label htmlFor="waToken">Verify token</label>
              <div className="copy-field">
                <input
                  id="waToken"
                  type={tokenVisible ? "text" : "password"}
                  value={settings.verifyToken}
                  readOnly
                />
                <button type="button" className="icon-btn" onClick={() => setTokenVisible((value) => !value)} aria-label={tokenVisible ? "Hide token" : "Show token"}>
                  {tokenVisible ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
                <button type="button" className="icon-btn" onClick={() => copy(settings.verifyToken, "Verify token")} aria-label="Copy verify token">
                  <Copy size={15} />
                </button>
              </div>
            </div>
          </div>

          <div className="toggle-list toggle-list--boxed">
            <div className="toggle-row">
              <span className="toggle-row__icon"><MessageCircle size={17} /></span>
              <div>
                <strong>Automatic replies</strong>
                <p>Send the AI greeting to every new WhatsApp conversation.</p>
              </div>
              <label className="switch">
                <input type="checkbox" checked={settings.autoReply} onChange={(event) => update("autoReply", event.target.checked)} />
                <span className="switch__track" />
              </label>
            </div>
            <div className="toggle-row">
              <span className="toggle-row__icon"><CheckCheck size={17} /></span>
              <div>
                <strong>Read receipts</strong>
                <p>Mark customer messages as read when your team opens them.</p>
              </div>
              <label className="switch">
                <input type="checkbox" checked={settings.readReceipts} onChange={(event) => update("readReceipts", event.target.checked)} />
                <span className="switch__track" />
              </label>
            </div>
          </div>

          <div className="settings-actions settings-actions--inline">
            <div>
              <strong>Connection settings</strong>
              <p>Saved to this browser until the settings API is connected.</p>
            </div>
            <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 size={16} className="spin" /> : <Save size={16} />}
              {saving ? "Saving…" : "Save settings"}
            </button>
          </div>
        </section>

        <section className="card settings-card">
          <div className="settings-card__head">
            <span className="settings-card__icon settings-card__icon--violet"><MessageCircle size={18} /></span>
            <div>
              <h3>Message templates</h3>
              <p>Pre-approved messages for order updates and re-engagement.</p>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm settings-card__action"
              onClick={() => toast("Template creation opens in Meta Business Suite in a later step.", "info")}
            >
              New template
            </button>
          </div>

          <ul className="template-list">
            {settings.templates.map((template) => (
              <li key={template.id}>
                <span className="template-list__icon"><MessageCircle size={15} /></span>
                <div>
                  <div className="template-list__title">
                    <strong>{template.name}</strong>
                    <span className={`chip chip--${template.status === "approved" ? "success" : "warning"}`}>{template.status}</span>
                  </div>
                  <p>{template.body}</p>
                </div>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => copy(template.body, "Template")}
                  aria-label={`Copy ${template.name} template`}
                >
                  <Copy size={15} />
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="card danger-card">
          <div className="danger-card__copy">
            <span className="danger-card__icon"><AlertTriangle size={18} /></span>
            <div>
              <h3>Disconnect WhatsApp</h3>
              <p>Messages will stop syncing and the AI assistant will not reply until you reconnect.</p>
            </div>
          </div>
          <button type="button" className="btn btn-danger btn-sm" onClick={() => setConnected(false)} disabled={!connected}>
            <Power size={15} /> Disconnect
          </button>
        </section>
      </div>

      <aside className="settings-side">
        <section className="card connection-card">
          <div className="card__head">
            <div><h3>Connection health</h3><p>Live status of your WhatsApp link.</p></div>
            <span className={`chip chip--${connected ? "success" : "warning"}`}>{connected ? "Healthy" : "Offline"}</span>
          </div>
          <ul className="connection-list">
            <li>
              <span className={`connection-dot ${connected ? "is-on" : ""}`} />
              <div><strong>Webhook</strong><span>{connected ? "Receiving events" : "Paused"}</span></div>
              {connected ? <Check size={15} /> : <Unplug size={15} />}
            </li>
            <li>
              <span className={`connection-dot ${connected ? "is-on" : ""}`} />
              <div><strong>Message sync</strong><span>{connected ? "Last sync 2 minutes ago" : "Not syncing"}</span></div>
              <Wifi size={15} />
            </li>
            <li>
              <span className="connection-dot is-on" />
              <div><strong>API quota</strong><span>8,420 / 10,000 messages</span></div>
              <CircleDot size={15} />
            </li>
          </ul>
          <div className="quota-bar"><span style={{ width: "84%" }} /></div>
          <p className="connection-card__note">Quota resets on the 1st of next month.</p>
        </section>

        <section className="card settings-card settings-card--tight">
          <div className="settings-card__head">
            <span className="settings-card__icon settings-card__icon--emerald"><RefreshCw size={16} /></span>
            <div><h3>Recent activity</h3><p>Connection events from the last 24 hours.</p></div>
          </div>
          <ol className="activity-log">
            <li><span className="activity-log__dot is-green" /><div><strong>Message delivered</strong><span>Order update to Priya Patel</span></div><time>2m</time></li>
            <li><span className="activity-log__dot is-green" /><div><strong>Webhook received</strong><span>Incoming message from Aarav</span></div><time>18m</time></li>
            <li><span className="activity-log__dot is-blue" /><div><strong>Template approved</strong><span>order_confirmation</span></div><time>3h</time></li>
            <li><span className="activity-log__dot is-amber" /><div><strong>Token refreshed</strong><span>Access token renewed</span></div><time>9h</time></li>
          </ol>
        </section>

        <section className="card tips-card">
          <span className="settings-card__icon settings-card__icon--emerald"><ShieldCheck size={16} /></span>
          <h3>Keep your number healthy</h3>
          <ul>
            <li>Reply to customer messages within 24 hours.</li>
            <li>Use approved templates for messages you start.</li>
            <li>Keep your display name consistent with your brand.</li>
          </ul>
          <button type="button" className="link-btn" onClick={() => toast("WhatsApp policy guide will open in a new tab once docs are added.", "info")}>
            Read API best practices <ChevronRight size={14} />
          </button>
        </section>
      </aside>
    </div>
  );
}
