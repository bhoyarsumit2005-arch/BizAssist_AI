import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Bot,
  Check,
  Clock,
  Languages,
  Loader2,
  MessageSquareText,
  RotateCcw,
  Save,
  Send,
  ShieldCheck,
  Smile,
  Sparkles,
  Sparkle,
  Wand2,
  Zap
} from "lucide-react";

import { useToast } from "../context/ToastContext";
import api, { getErrorMessage } from "../services/api";
import { defaultAiSettings } from "../utils/settingsDefaults";
import { formatTime } from "../utils/format";

const tones = [
  { value: "friendly", label: "Friendly", description: "Warm and conversational", icon: Smile },
  { value: "professional", label: "Professional", description: "Clear and polished", icon: ShieldCheck },
  { value: "playful", label: "Playful", description: "Light and energetic", icon: Sparkles },
  { value: "concise", label: "Concise", description: "Short, direct answers", icon: Zap }
];

const languages = [
  "English",
  "Hindi",
  "Hinglish",
  "Marathi",
  "Tamil",
  "Telugu",
  "Bengali",
  "Gujarati",
  "Kannada",
  "Malayalam"
];

const initialMessages = (greeting) => [
  { id: "greeting", role: "ai", text: greeting, time: new Date().toISOString() }
];

export default function AISettingsPanel() {
  const { toast } = useToast();
  const [settings, setSettings] = useState({ ...defaultAiSettings });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [savedAt, setSavedAt] = useState(null);
  const [health, setHealth] = useState({ state: "checking", model: "" });
  const [testInput, setTestInput] = useState("");
  const [testMessages, setTestMessages] = useState(() => initialMessages(defaultAiSettings.greeting));
  const [testTyping, setTestTyping] = useState(false);
  const testScrollRef = useRef(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const { data } = await api.get("/settings");
        if (!active) return;
        setSettings({ ...defaultAiSettings, ...(data.ai || {}) });
        setLoadError("");
      } catch (error) {
        if (active) {
          setLoadError(getErrorMessage(error, "Could not load your AI settings."));
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    load();

    api
      .get("/ai/health")
      .then(({ data }) => {
        if (active) setHealth({ state: "ready", model: data.model || "" });
      })
      .catch(() => {
        if (active) setHealth({ state: "unavailable", model: "" });
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const node = testScrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [testMessages.length, testTyping]);

  useEffect(() => {
    setTestMessages((current) =>
      current.length ? current : initialMessages(settings.greeting)
    );
  }, [settings.greeting]);

  const update = (field, value) => setSettings((current) => ({ ...current, [field]: value }));

  const persist = async (nextSettings) => {
    const { data } = await api.put("/settings/ai", nextSettings);
    setSettings({ ...defaultAiSettings, ...(data.ai || {}) });
    setSavedAt(new Date());
  };

  const handleSave = async () => {
    setSaving(true);

    try {
      await persist(settings);
      toast("AI settings saved. New conversations will use them.");
    } catch (error) {
      toast(getErrorMessage(error, "Could not save your AI settings."), "error");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setSaving(true);
    setSettings({ ...defaultAiSettings });

    try {
      await persist(defaultAiSettings);
      toast("AI settings reset to the recommended defaults.", "info");
    } catch (error) {
      toast(getErrorMessage(error, "Could not reset your AI settings."), "error");
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async (event) => {
    event.preventDefault();
    const text = testInput.trim();
    if (!text || testTyping) return;

    setTestMessages((current) => [
      ...current,
      { id: `user-${Date.now()}`, role: "user", text, time: new Date().toISOString() }
    ]);
    setTestInput("");
    setTestTyping(true);

    try {
      // Send the current (possibly unsaved) settings so this preview matches
      // what the owner sees on screen.
      const { data } = await api.post("/ai/chat", { message: text, settings });
      setTestMessages((current) => [
        ...current,
        { id: `ai-${Date.now()}`, role: "ai", text: data.reply, time: new Date().toISOString() }
      ]);
    } catch (error) {
      setTestMessages((current) => [
        ...current,
        {
          id: `error-${Date.now()}`,
          role: "ai",
          text: getErrorMessage(error, "The assistant is unavailable right now. Please try again shortly."),
          time: new Date().toISOString()
        }
      ]);
    } finally {
      setTestTyping(false);
    }
  };

  const activeTone = tones.find((tone) => tone.value === settings.tone) || tones[0];
  const statusChip =
    health.state === "ready"
      ? { className: "chip--success", label: "Model ready" }
      : health.state === "unavailable"
        ? { className: "chip--danger", label: "Model unavailable" }
        : { className: "chip--neutral", label: "Checking model…" };

  return (
    <div className="settings-grid">
      <div className="settings-main">
        {loadError ? (
          <div className="notice notice--danger">
            <AlertTriangle size={17} />
            <p>{loadError}</p>
          </div>
        ) : null}

        <section className="card settings-card">
          <div className="settings-card__head">
            <span className="settings-card__icon"><Wand2 size={18} /></span>
            <div>
              <h3>Assistant instructions</h3>
              <p>The most important part — tell your assistant who it is and how to help.</p>
            </div>
          </div>

          <div className="field">
            <div className="field__label-row">
              <label htmlFor="aiInstructions">Business instructions</label>
              <span className="char-count">{settings.instructions.length}/2000</span>
            </div>
            <textarea
              id="aiInstructions"
              rows={7}
              maxLength={2000}
              value={settings.instructions}
              onChange={(event) => update("instructions", event.target.value)}
              placeholder="You are the friendly assistant for…"
              disabled={loading || saving}
            />
            <p className="field-hint">
              Include your delivery policy, return window, payment methods, and anything the assistant should never
              promise.
            </p>
          </div>

          <div className="prompt-suggestions">
            <span>Quick additions:</span>
            {[
              "Offer free delivery above ₹999",
              "Never confirm stock without checking",
              "Ask for a phone number before placing an order"
            ].map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => update("instructions", `${settings.instructions.trim()}\n• ${suggestion}`.slice(0, 2000))}
                disabled={loading || saving}
              >
                + {suggestion}
              </button>
            ))}
          </div>
        </section>

        <section className="card settings-card">
          <div className="settings-card__head">
            <span className="settings-card__icon settings-card__icon--violet"><Smile size={18} /></span>
            <div>
              <h3>Voice &amp; language</h3>
              <p>Choose how your assistant sounds when it represents your business.</p>
            </div>
          </div>

          <div className="tone-grid" role="radiogroup" aria-label="Assistant tone">
            {tones.map(({ value, label, description, icon: Icon }) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={settings.tone === value}
                className={`tone-card ${settings.tone === value ? "is-active" : ""}`}
                onClick={() => update("tone", value)}
                disabled={loading || saving}
              >
                <span><Icon size={17} /></span>
                <strong>{label}</strong>
                <em>{description}</em>
                {settings.tone === value ? <Check size={15} className="tone-card__check" /> : null}
              </button>
            ))}
          </div>

          <div className="form-grid form-grid--spaced">
            <div className="field">
              <label htmlFor="aiLanguage"><Languages size={14} /> Primary language</label>
              <div className="select-wrap">
                <select
                  id="aiLanguage"
                  value={settings.language}
                  onChange={(event) => update("language", event.target.value)}
                  disabled={loading || saving}
                >
                  {languages.map((language) => (
                    <option key={language} value={language}>{language}</option>
                  ))}
                </select>
              </div>
              <p className="field-hint">The assistant mirrors the customer&apos;s language when possible.</p>
            </div>

            <div className="field">
              <label htmlFor="aiTonePreview">Preview</label>
              <div className="tone-preview">
                <span className="avatar avatar--xs">AI</span>
                <p>
                  {settings.tone === "playful"
                    ? "Hey there! 👋 Great choice — want me to reserve one for you?"
                    : settings.tone === "concise"
                      ? "Yes, it's in stock. ₹649. Ships tomorrow. Reserve?"
                      : settings.tone === "professional"
                        ? "Good afternoon. The item is available at ₹649 and can ship tomorrow. Shall I reserve it?"
                        : "Hi! 😊 Yes, it's in stock at ₹649 and can ship tomorrow. Would you like me to reserve one?"}
                </p>
              </div>
            </div>
          </div>

          <div className="form-grid form-grid--spaced">
            <div className="field">
              <label htmlFor="aiGreeting">Greeting message</label>
              <textarea
                id="aiGreeting"
                rows={2}
                maxLength={500}
                value={settings.greeting}
                onChange={(event) => update("greeting", event.target.value)}
                disabled={loading || saving}
              />
            </div>
            <div className="field">
              <label htmlFor="aiFallback">Fallback message</label>
              <textarea
                id="aiFallback"
                rows={2}
                maxLength={500}
                value={settings.fallback}
                onChange={(event) => update("fallback", event.target.value)}
                disabled={loading || saving}
              />
              <p className="field-hint">Used when the assistant is unsure or a question needs a human.</p>
            </div>
          </div>
        </section>

        <section className="card settings-card">
          <div className="settings-card__head">
            <span className="settings-card__icon settings-card__icon--amber"><Bot size={18} /></span>
            <div>
              <h3>Automation</h3>
              <p>Decide what the assistant can do without asking you first.</p>
            </div>
          </div>

          <div className="toggle-list">
            <ToggleRow
              icon={MessageSquareText}
              title="Automatic replies"
              description="Let the assistant answer new WhatsApp messages instantly."
              checked={settings.autoReply}
              disabled={loading || saving}
              onChange={(value) => update("autoReply", value)}
            />
            <ToggleRow
              icon={Clock}
              title="After-hours replies"
              description="Keep replying outside working hours with a slightly slower, more careful tone."
              checked={settings.afterHours}
              disabled={loading || saving}
              onChange={(value) => update("afterHours", value)}
            />
            <ToggleRow
              icon={Sparkle}
              title="Take orders in chat"
              description="Collect items, quantities, and delivery details, then prepare the order with you."
              checked={settings.takeOrders}
              disabled={loading || saving}
              onChange={(value) => update("takeOrders", value)}
            />
            <ToggleRow
              icon={ShieldCheck}
              title="Hand off to a human"
              description="Escalate refunds, complaints, and unclear requests to you right away."
              checked={settings.handoff}
              disabled={loading || saving}
              onChange={(value) => update("handoff", value)}
            />
          </div>

          <div className="hours-row">
            <div className="field">
              <label htmlFor="hoursStart">Working hours start</label>
              <input
                id="hoursStart"
                type="time"
                value={settings.hoursStart || "10:00"}
                onChange={(event) => update("hoursStart", event.target.value)}
                disabled={loading || saving}
              />
            </div>
            <div className="field">
              <label htmlFor="hoursEnd">Working hours end</label>
              <input
                id="hoursEnd"
                type="time"
                value={settings.hoursEnd || "19:00"}
                onChange={(event) => update("hoursEnd", event.target.value)}
                disabled={loading || saving}
              />
            </div>
            <p className="hours-row__hint">Used for after-hours behaviour and response expectations.</p>
          </div>
        </section>

        <div className="settings-actions">
          <div>
            <strong>Ready to save?</strong>
            <p>
              {savedAt
                ? `Saved to your business at ${formatTime(savedAt)}.`
                : "Changes are saved to your business, not this browser."}
            </p>
          </div>
          <div>
            <button type="button" className="btn btn-secondary" onClick={handleReset} disabled={loading || saving}>
              <RotateCcw size={15} /> Reset
            </button>
            <button type="button" className="btn btn-primary" onClick={handleSave} disabled={loading || saving}>
              {saving ? <Loader2 size={16} className="spin" /> : <Save size={16} />}
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </div>

      <aside className="settings-side">
        <section className="card assistant-status">
          <div className="assistant-status__head">
            <span className="assistant-orb assistant-orb--lg"><Sparkles size={20} /></span>
            <span className={`chip ${statusChip.className}`}>{statusChip.label}</span>
          </div>
          <h3>Assistant settings</h3>
          <p>Saved per business and applied to every new conversation.</p>
          <dl className="assistant-status__list">
            <div><dt>Model</dt><dd>{health.model || "Not reported"}</dd></div>
            <div><dt>Tone</dt><dd>{activeTone.label}</dd></div>
            <div><dt>Language</dt><dd>{settings.language}</dd></div>
            <div><dt>Auto-reply</dt><dd>{settings.autoReply ? "On" : "Off"}</dd></div>
          </dl>
        </section>

        <section className="card test-card">
          <div className="card__head">
            <div>
              <h3>Test your assistant</h3>
              <p>Try a real customer question using the settings above.</p>
            </div>
            <span className="chip chip--soft"><Sparkles size={12} /> Live model</span>
          </div>

          <div className="test-chat" ref={testScrollRef}>
            {testMessages.map((message) => (
              <div key={message.id} className={`test-message test-message--${message.role}`}>
                {message.role === "ai" ? <span className="test-message__avatar"><Sparkles size={12} /></span> : null}
                <div>
                  <p>{message.text}</p>
                  <span>{formatTime(message.time)}</span>
                </div>
              </div>
            ))}
            {testTyping ? (
              <div className="test-message test-message--ai">
                <span className="test-message__avatar"><Sparkles size={12} /></span>
                <div className="typing-dots"><i /><i /><i /></div>
              </div>
            ) : null}
          </div>

          <form className="test-input" onSubmit={sendTest}>
            <input
              type="text"
              placeholder="e.g. Do you deliver to Mumbai?"
              value={testInput}
              onChange={(event) => setTestInput(event.target.value)}
              disabled={testTyping}
            />
            <button
              type="submit"
              className="btn btn-primary btn-icon"
              disabled={!testInput.trim() || testTyping}
              aria-label="Send test message"
            >
              {testTyping ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
            </button>
          </form>
          <button
            type="button"
            className="link-btn test-reset"
            onClick={() => {
              setTestMessages(initialMessages(settings.greeting));
              setTestTyping(false);
            }}
          >
            <RotateCcw size={13} /> Reset test chat
          </button>
        </section>

        <section className="card tips-card">
          <span className="settings-card__icon settings-card__icon--emerald"><Sparkles size={16} /></span>
          <h3>Make it sound like you</h3>
          <ul>
            <li>Mention your delivery timeline and free-shipping threshold.</li>
            <li>List the questions the assistant should never answer alone.</li>
            <li>Test one real conversation after every change.</li>
          </ul>
        </section>
      </aside>
    </div>
  );
}

function ToggleRow({ icon: Icon, title, description, checked, disabled, onChange }) {
  return (
    <div className="toggle-row">
      <span className="toggle-row__icon"><Icon size={17} /></span>
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
      <label className="switch">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span className="switch__track" />
      </label>
    </div>
  );
}
