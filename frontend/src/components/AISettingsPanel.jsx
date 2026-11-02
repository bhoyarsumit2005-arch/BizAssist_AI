import { useEffect, useRef, useState } from "react";
import {
  Bot,
  Check,
  Clock,
  Languages,
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
import { defaultAiSettings } from "../services/demo";
import { formatTime } from "../utils/format";

const STORAGE_KEY = "bizassist:ai-settings";

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

const loadSettings = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    return { ...defaultAiSettings, ...(stored || {}) };
  } catch {
    return { ...defaultAiSettings };
  }
};

const testReply = (text) => {
  const message = text.toLowerCase();
  if (/price|cost|how much|rate/.test(message)) return "Our scented candle is ₹649 and the tote is ₹499. Both are in stock — would you like me to reserve them for you?";
  if (/deliver|shipping|ship|time/.test(message)) return "We deliver across India in 2–3 working days. Orders above ₹999 ship free. Where should I send your order?";
  if (/refund|return|damaged/.test(message)) return "I'm sorry to hear that. I've handed this conversation to the owner, who will arrange a replacement or refund for you right away.";
  if (/order/.test(message)) return "I'd be happy to help with your order! Could you share your order number so I can check the latest status?";
  return "Thanks for asking! I've noted your question and our team will follow up with the details shortly. Is there anything else I can help with?";
};

export default function AISettingsPanel() {
  const { toast } = useToast();
  const [settings, setSettings] = useState(loadSettings);
  const [savedAt, setSavedAt] = useState(null);
  const [testInput, setTestInput] = useState("");
  const [testMessages, setTestMessages] = useState(() => [
    { id: "greeting", role: "ai", text: loadSettings().greeting, time: new Date().toISOString() }
  ]);
  const [testTyping, setTestTyping] = useState(false);
  const timers = useRef([]);
  const testScrollRef = useRef(null);

  useEffect(
    () => () => {
      timers.current.forEach((timer) => clearTimeout(timer));
    },
    []
  );

  useEffect(() => {
    const node = testScrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [testMessages.length, testTyping]);

  const update = (field, value) => setSettings((current) => ({ ...current, [field]: value }));

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    setSavedAt(new Date());
    toast("AI instructions saved. New conversations will use them.");
  };

  const handleReset = () => {
    setSettings({ ...defaultAiSettings });
    localStorage.removeItem(STORAGE_KEY);
    setSavedAt(null);
    toast("AI settings reset to the recommended defaults.", "info");
  };

  const sendTest = (event) => {
    event.preventDefault();
    const text = testInput.trim();
    if (!text) return;

    setTestMessages((current) => [
      ...current,
      { id: `user-${Date.now()}`, role: "user", text, time: new Date().toISOString() }
    ]);
    setTestInput("");
    setTestTyping(true);

    const timer = setTimeout(() => {
      setTestMessages((current) => [
        ...current,
        { id: `ai-${Date.now()}`, role: "ai", text: testReply(text), time: new Date().toISOString() }
      ]);
      setTestTyping(false);
    }, 1100);
    timers.current.push(timer);
  };

  const activeTone = tones.find((tone) => tone.value === settings.tone) || tones[0];

  return (
    <div className="settings-grid">
      <div className="settings-main">
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
                <select id="aiLanguage" value={settings.language} onChange={(event) => update("language", event.target.value)}>
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
              <textarea id="aiGreeting" rows={2} value={settings.greeting} onChange={(event) => update("greeting", event.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="aiFallback">Fallback message</label>
              <textarea id="aiFallback" rows={2} value={settings.fallback} onChange={(event) => update("fallback", event.target.value)} />
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
              onChange={(value) => update("autoReply", value)}
            />
            <ToggleRow
              icon={Clock}
              title="After-hours replies"
              description="Keep replying outside working hours with a slightly slower, more careful tone."
              checked={settings.afterHours}
              onChange={(value) => update("afterHours", value)}
            />
            <ToggleRow
              icon={Sparkle}
              title="Take orders in chat"
              description="Collect items, quantities, and delivery details, then create a pending order."
              checked={settings.takeOrders}
              onChange={(value) => update("takeOrders", value)}
            />
            <ToggleRow
              icon={ShieldCheck}
              title="Hand off to a human"
              description="Escalate refunds, complaints, and unclear requests to you right away."
              checked={settings.handoff}
              onChange={(value) => update("handoff", value)}
            />
          </div>

          <div className="hours-row">
            <div className="field">
              <label htmlFor="hoursStart">Working hours start</label>
              <input id="hoursStart" type="time" value={settings.hoursStart || "10:00"} onChange={(event) => update("hoursStart", event.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="hoursEnd">Working hours end</label>
              <input id="hoursEnd" type="time" value={settings.hoursEnd || "19:00"} onChange={(event) => update("hoursEnd", event.target.value)} />
            </div>
            <p className="hours-row__hint">Used for after-hours behaviour and response expectations.</p>
          </div>
        </section>

        <div className="settings-actions">
          <div>
            <strong>Ready to save?</strong>
            <p>{savedAt ? `Last saved at ${formatTime(savedAt)}` : "Changes are stored in this browser for now."}</p>
          </div>
          <div>
            <button type="button" className="btn btn-secondary" onClick={handleReset}>
              <RotateCcw size={15} /> Reset
            </button>
            <button type="button" className="btn btn-primary" onClick={handleSave}>
              <Save size={16} /> Save changes
            </button>
          </div>
        </div>
      </div>

      <aside className="settings-side">
        <section className="card assistant-status">
          <div className="assistant-status__head">
            <span className="assistant-orb assistant-orb--lg"><Sparkles size={20} /></span>
            <span className="chip chip--success"><span className="live-dot" /> Active</span>
          </div>
          <h3>Your assistant is live</h3>
          <p>It will use these instructions for every new conversation.</p>
          <dl className="assistant-status__list">
            <div><dt>Model</dt><dd>qwen3.5:2b</dd></div>
            <div><dt>Tone</dt><dd>{activeTone.label}</dd></div>
            <div><dt>Language</dt><dd>{settings.language}</dd></div>
            <div><dt>Auto-reply</dt><dd>{settings.autoReply ? "On" : "Off"}</dd></div>
          </dl>
        </section>

        <section className="card test-card">
          <div className="card__head">
            <div>
              <h3>Test your assistant</h3>
              <p>Try a customer question before going live.</p>
            </div>
            <span className="chip chip--soft"><Sparkles size={12} /> Sandbox</span>
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
            />
            <button type="submit" className="btn btn-primary btn-icon" disabled={!testInput.trim()} aria-label="Send test message">
              <Send size={16} />
            </button>
          </form>
          <button
            type="button"
            className="link-btn test-reset"
            onClick={() => {
              setTestMessages([{ id: "greeting", role: "ai", text: settings.greeting, time: new Date().toISOString() }]);
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

function ToggleRow({ icon: Icon, title, description, checked, onChange }) {
  return (
    <div className="toggle-row">
      <span className="toggle-row__icon"><Icon size={17} /></span>
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
      <label className="switch">
        <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
        <span className="switch__track" />
      </label>
    </div>
  );
}
