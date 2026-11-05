import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  CircleDot,
  Copy,
  Eye,
  EyeOff,
  Link2,
  Loader2,
  MessageCircle,
  Save,
  ShieldCheck,
  Smartphone,
  Webhook
} from "lucide-react";

import { useToast } from "../context/ToastContext";
import api, { getErrorMessage } from "../services/api";
import { defaultWhatsAppSettings } from "../utils/settingsDefaults";

export default function WhatsAppSettingsPanel() {
  const { toast } = useToast();
  const [settings, setSettings] = useState({ ...defaultWhatsAppSettings });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [tokenVisible, setTokenVisible] = useState(false);

  useEffect(() => {
    let active = true;

    api
      .get("/settings")
      .then(({ data }) => {
        if (!active) return;
        setSettings({ ...defaultWhatsAppSettings, ...(data.whatsapp || {}) });
        setLoadError("");
      })
      .catch((error) => {
        if (active) setLoadError(getErrorMessage(error, "Could not load your WhatsApp settings."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const update = (field, value) => setSettings((current) => ({ ...current, [field]: value }));
  const configured = Boolean(settings.configured);
  const isWaapi = settings.provider === "waapi";

  const handleSave = async () => {
    setSaving(true);

    try {
      const { data } = await api.put("/settings/whatsapp", {
        phone: settings.phone,
        displayName: settings.displayName,
        provider: settings.provider,
        phoneNumberId: settings.phoneNumberId,
        waapiInstanceId: settings.waapiInstanceId,
        autoReply: settings.autoReply
      });
      setSettings({ ...defaultWhatsAppSettings, ...(data.whatsapp || {}) });
      toast("WhatsApp settings saved.");
    } catch (error) {
      toast(getErrorMessage(error, "Could not save your WhatsApp settings."), "error");
    } finally {
      setSaving(false);
    }
  };

  const copy = async (value, label) => {
    if (!value) {
      toast(`${label} is not available yet.`, "info");
      return;
    }

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
        {loadError ? (
          <div className="notice notice--danger">
            <AlertTriangle size={17} />
            <p>{loadError}</p>
          </div>
        ) : null}

        <section className="card wa-hero">
          <div className="wa-hero__copy">
            <div className="wa-hero__title">
              <span className={`wa-logo ${configured ? "" : "is-off"}`}>
                <MessageCircle size={24} />
              </span>
              <div>
                <h3>{isWaapi ? "WhatsApp via WaAPI" : "WhatsApp Cloud API"}</h3>
                <p>
                  {isWaapi
                    ? "Receive customer messages and reply through your WaAPI instance."
                    : "Receive customer messages and reply through Meta\u2019s official API."}
                </p>
              </div>
              <span className={`chip chip--${configured ? "success" : "warning"}`}>
                {configured ? "Credentials configured" : "Not configured"}
              </span>
            </div>

            <div className="wa-hero__meta">
              <div><span>Number</span><strong>{settings.phone || "Not set"}</strong></div>
              <div>
                <span>{isWaapi ? "Instance ID" : "Phone number ID"}</span>
                <strong>
                  {(isWaapi ? settings.waapiInstanceId : settings.phoneNumberId) || "Not set"}
                </strong>
              </div>
              <div><span>Auto-reply</span><strong>{settings.autoReply ? "On" : "Off"}</strong></div>
            </div>

            <p className="wa-hero__hint">
              <ShieldCheck size={14} />
              {configured
                ? isWaapi
                  ? "The server has a WaAPI token and an instance ID, so outgoing messages can be sent."
                  : "The server has an access token and a phone number ID, so outgoing messages can be sent."
                : isWaapi
                  ? "Add WAAPI_TOKEN on the server and save the instance ID to enable sending."
                  : "Add the server credentials below and save the phone number ID from Meta to enable sending."}
            </p>
          </div>

          <div className="wa-hero__visual">
            <div className="wa-setup">
              <span className="wa-setup__icon"><Webhook size={20} /></span>
              <h4>Webhook callback</h4>
              <div className="copy-field">
                <input
                  id="waWebhookHero"
                  type="text"
                  value={settings.webhookUrl || ""}
                  placeholder="Loading…"
                  readOnly
                />
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => copy(settings.webhookUrl, "Webhook URL")}
                  aria-label="Copy webhook URL"
                >
                  <Copy size={15} />
                </button>
              </div>
              <p>
                {isWaapi
                  ? "Paste this as the webhook URL of your WaAPI instance, then subscribe to the message event."
                  : "Paste this URL as the callback URL in your Meta app, then subscribe to the messages field."}
              </p>
            </div>
          </div>
        </section>

        <section className="card settings-card">
          <div className="settings-card__head">
            <span className="settings-card__icon settings-card__icon--green"><Smartphone size={18} /></span>
            <div>
              <h3>Profile &amp; connection</h3>
              <p>Details customers see, plus the identifiers your webhook uses.</p>
            </div>
          </div>

          <div className="form-grid">
            <div className="field">
              <label htmlFor="waName">Display name</label>
              <input
                id="waName"
                type="text"
                value={settings.displayName}
                onChange={(event) => update("displayName", event.target.value)}
                disabled={loading || saving}
              />
            </div>
            <div className="field">
              <label htmlFor="waPhone">WhatsApp number</label>
              <input
                id="waPhone"
                type="tel"
                value={settings.phone}
                onChange={(event) => update("phone", event.target.value)}
                placeholder="+91 98765 43210"
                disabled={loading || saving}
              />
            </div>
            <div className="field field--full">
              <label htmlFor="waProvider">Provider</label>
              <select
                id="waProvider"
                value={settings.provider || ""}
                onChange={(event) => update("provider", event.target.value)}
                disabled={loading || saving}
              >
                <option value="waapi">WaAPI (waapi.app)</option>
                <option value="meta">Meta WhatsApp Cloud API</option>
              </select>
              <p className="field-hint">
                Blank means auto-detect: WaAPI when the server has a WAAPI token, otherwise Meta.
              </p>
            </div>
            {isWaapi ? (
              <div className="field field--full">
                <label htmlFor="waInstanceId">WaAPI instance ID</label>
                <input
                  id="waInstanceId"
                  type="text"
                  value={settings.waapiInstanceId || ""}
                  onChange={(event) => update("waapiInstanceId", event.target.value)}
                  placeholder="From WaAPI → Instances → ID"
                  disabled={loading || saving}
                />
                <p className="field-hint">
                  Incoming webhook events are matched to this business by the instance ID, so keep it exact.
                </p>
              </div>
            ) : (
              <div className="field field--full">
                <label htmlFor="waPhoneNumberId">Phone number ID</label>
                <input
                  id="waPhoneNumberId"
                  type="text"
                  value={settings.phoneNumberId}
                  onChange={(event) => update("phoneNumberId", event.target.value)}
                  placeholder="From Meta → WhatsApp → API setup"
                  disabled={loading || saving}
                />
                <p className="field-hint">
                  Incoming webhook events are matched to this business by the phone number ID, so keep it exact.
                </p>
              </div>
            )}
            <div className="field field--full">
              <label htmlFor="waWebhook"><Link2 size={14} /> Webhook URL</label>
              <div className="copy-field">
                <input id="waWebhook" type="text" value={settings.webhookUrl || ""} placeholder="Loading…" readOnly />
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => copy(settings.webhookUrl, "Webhook URL")}
                  aria-label="Copy webhook URL"
                >
                  <Copy size={15} />
                </button>
              </div>
              <p className="field-hint">
                {isWaapi
                  ? "Paste this URL as the webhook URL of your WaAPI instance, then subscribe to the message event."
                  : "Meta posts incoming messages and delivery receipts to this endpoint."}
              </p>
            </div>
            {isWaapi ? null : (
              <div className="field field--full">
                <label htmlFor="waToken">Verify token</label>
                <div className="copy-field">
                  <input
                    id="waToken"
                    type={tokenVisible ? "text" : "password"}
                    value={settings.verifyToken || ""}
                    readOnly
                  />
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => setTokenVisible((value) => !value)}
                    aria-label={tokenVisible ? "Hide token" : "Show token"}
                  >
                    {tokenVisible ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => copy(settings.verifyToken, "Verify token")}
                    aria-label="Copy verify token"
                  >
                    <Copy size={15} />
                  </button>
                </div>
                <p className="field-hint">
                  Use this exact token in Meta&apos;s webhook setup. It is generated per business.
                </p>
              </div>
            )}
          </div>

          <div className="toggle-list toggle-list--boxed">
            <div className="toggle-row">
              <span className="toggle-row__icon"><MessageCircle size={17} /></span>
              <div>
                <strong>Automatic replies</strong>
                <p>Let the AI assistant answer incoming WhatsApp messages for this number.</p>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={settings.autoReply}
                  onChange={(event) => update("autoReply", event.target.checked)}
                  disabled={loading || saving}
                />
                <span className="switch__track" />
              </label>
            </div>
          </div>

          <div className="settings-actions settings-actions--inline">
            <div>
              <strong>Connection settings</strong>
              <p>Saved to your business. Server secrets stay in the backend environment.</p>
            </div>
            <button type="button" className="btn btn-primary" onClick={handleSave} disabled={loading || saving}>
              {saving ? <Loader2 size={16} className="spin" /> : <Save size={16} />}
              {saving ? "Saving…" : "Save settings"}
            </button>
          </div>
        </section>

        <section className="card settings-card">
          <div className="settings-card__head">
            <span className="settings-card__icon settings-card__icon--violet"><Webhook size={18} /></span>
            <div>
              <h3>Server credentials</h3>
              <p>These values live in the backend environment, never in the browser.</p>
            </div>
          </div>

          <ul className="setup-list">
            {isWaapi ? (
              <>
                <li>
                  <code>WAAPI_TOKEN</code>
                  <span>{configured ? "Detected on the server." : "Required to send messages."}</span>
                </li>
                <li>
                  <code>WAAPI_INSTANCE_ID</code>
                  <span>Instance that owns this WhatsApp number.</span>
                </li>
                <li>
                  <code>WAAPI_WEBHOOK_SECRET</code>
                  <span>Already embedded in the webhook URL above.</span>
                </li>
              </>
            ) : (
              <>
                <li>
                  <code>WHATSAPP_ACCESS_TOKEN</code>
                  <span>{configured ? "Detected on the server." : "Required to send messages."}</span>
                </li>
                <li>
                  <code>WHATSAPP_APP_SECRET</code>
                  <span>Optional. When set, webhook payload signatures are verified.</span>
                </li>
                <li>
                  <code>WHATSAPP_API_VERSION</code>
                  <span>Optional. Defaults to v20.0.</span>
                </li>
                <li>
                  <code>WHATSAPP_WEBHOOK_URL</code>
                  <span>Optional. Overrides the webhook URL shown above.</span>
                </li>
              </>
            )}
          </ul>
        </section>
      </div>

      <aside className="settings-side">
        <section className="card connection-card">
          <div className="card__head">
            <div><h3>Setup checklist</h3><p>Everything {isWaapi ? "WaAPI" : "Meta"} needs before messages flow.</p></div>
            <span className={`chip chip--${configured ? "success" : "warning"}`}>
              {configured ? "Ready to send" : "Action needed"}
            </span>
          </div>
          <ul className="connection-list">
            <li>
              <span className={`connection-dot ${(isWaapi ? settings.waapiInstanceId : settings.phoneNumberId) ? "is-on" : ""}`} />
              <div>
                <strong>{isWaapi ? "Instance ID" : "Phone number ID"}</strong>
                <span>
                  {(isWaapi ? settings.waapiInstanceId : settings.phoneNumberId)
                    ? "Saved for this business"
                    : "Add it above and save"}
                </span>
              </div>
              {(isWaapi ? settings.waapiInstanceId : settings.phoneNumberId) ? <Check size={15} /> : <CircleDot size={15} />}
            </li>
            <li>
              <span className={`connection-dot ${configured ? "is-on" : ""}`} />
              <div>
                <strong>{isWaapi ? "WaAPI token" : "Access token"}</strong>
                <span>{configured ? "Present on the server" : `Set ${isWaapi ? "WAAPI_TOKEN" : "WHATSAPP_ACCESS_TOKEN"}`}</span>
              </div>
              {configured ? <Check size={15} /> : <CircleDot size={15} />}
            </li>
            {isWaapi ? null : (
              <li>
                <span className={`connection-dot ${settings.verifyToken ? "is-on" : ""}`} />
                <div>
                  <strong>Verify token</strong>
                  <span>{settings.verifyToken ? "Ready for Meta verification" : "Loading…"}</span>
                </div>
                {settings.verifyToken ? <Check size={15} /> : <CircleDot size={15} />}
              </li>
            )}
            <li>
              <span className={`connection-dot ${settings.webhookUrl ? "is-on" : ""}`} />
              <div>
                <strong>Webhook URL</strong>
                <span>{settings.webhookUrl ? `Configure this in ${isWaapi ? "WaAPI" : "Meta"}` : "Loading…"}</span>
              </div>
              {settings.webhookUrl ? <Check size={15} /> : <CircleDot size={15} />}
            </li>
          </ul>
        </section>

        <section className="card settings-card settings-card--tight">
          <div className="settings-card__head">
            <span className="settings-card__icon settings-card__icon--emerald"><ShieldCheck size={16} /></span>
            <div><h3>How messages flow</h3><p>What happens after the provider calls your webhook.</p></div>
          </div>
          <ol className="activity-log">
            <li>
              <span className="activity-log__dot is-blue" />
              <div><strong>Incoming message</strong><span>The provider posts the event to the webhook.</span></div>
            </li>
            <li>
              <span className="activity-log__dot is-blue" />
              <div><strong>Conversation saved</strong><span>The customer and message are stored in your inbox.</span></div>
            </li>
            <li>
              <span className="activity-log__dot is-green" />
              <div><strong>AI reply</strong><span>The assistant answers if auto-reply is on and sending is configured.</span></div>
            </li>
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
          <a
            className="link-btn"
            href={isWaapi ? "https://waapi.app/docs" : "https://developers.facebook.com/docs/whatsapp/cloud-api"}
            target="_blank"
            rel="noreferrer"
          >
            {isWaapi ? "WaAPI docs" : "Meta Cloud API docs"} <ChevronRight size={14} />
          </a>
        </section>
      </aside>
    </div>
  );
}
