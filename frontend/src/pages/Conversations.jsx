import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  CheckCheck,
  Globe,
  Info,
  MessageCircle,
  MoreHorizontal,
  Paperclip,
  Phone,
  Search,
  Send,
  Smile,
  Sparkles,
  CheckCircle2
} from "lucide-react";

import EmptyState from "../components/EmptyState";
import { useToast } from "../context/ToastContext";
import { demoConversations } from "../services/demo";
import { formatDate, formatTime, initials, isSameDay, timeAgo } from "../utils/format";

const tabs = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "resolved", label: "Resolved" },
  { value: "archived", label: "Archived" }
];

const suggestions = [
  "Thanks for reaching out! Yes, this is available and ready to ship. Would you like me to reserve one for you?",
  "We deliver in 2–3 working days, and orders above ₹999 ship free. Shall I place the order for you?",
  "Of course — I can help with that. Could you share your order number so I can take a look?"
];

const aiReplyFor = (text) => {
  const message = text.toLowerCase();
  if (/price|cost|how much|rate/.test(message)) {
    return "The current price is ₹649, and it ships within 24 hours. I can reserve one for you if you'd like?";
  }
  if (/deliver|shipping|ship|when/.test(message)) {
    return "We deliver in 2–3 working days across India. Orders above ₹999 ship free — would you like me to place this order?";
  }
  if (/order|track|status/.test(message)) {
    return "I can check that for you! Please share your order number and I'll pull up the latest status right away.";
  }
  if (/return|refund|damaged|broken/.test(message)) {
    return "I'm sorry about that. I've flagged this for the owner and we'll arrange a replacement or refund right away.";
  }
  return "Thanks for your message! I'm checking this with the team and will get back to you with the details shortly. 😊";
};

export default function Conversations() {
  const { toast } = useToast();
  const [conversations, setConversations] = useState(() =>
    demoConversations.map((conversation) => ({ ...conversation, messages: [...conversation.messages] }))
  );
  const [selectedId, setSelectedId] = useState(demoConversations[0]._id);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [typing, setTyping] = useState(false);
  const [mobileChat, setMobileChat] = useState(false);
  const messagesRef = useRef(null);
  const timers = useRef([]);
  const fileRef = useRef(null);

  useEffect(
    () => () => {
      timers.current.forEach((timer) => clearTimeout(timer));
    },
    []
  );

  const selected = conversations.find((conversation) => conversation._id === selectedId) || conversations[0];

  useEffect(() => {
    const node = messagesRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [selected?.messages.length, typing, selectedId]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return conversations
      .filter((conversation) => {
        if (filter !== "all" && conversation.status !== filter) return false;
        if (!term) return true;
        return [conversation.customer?.name, conversation.lastMessage]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(term);
      })
      .sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));
  }, [conversations, filter, search]);

  const openConversation = (id) => {
    setSelectedId(id);
    setMobileChat(true);
    setTyping(false);
    setConversations((current) =>
      current.map((conversation) =>
        conversation._id === id ? { ...conversation, unreadCount: 0 } : conversation
      )
    );
  };

  const appendMessage = useCallback((conversationId, message) => {
    setConversations((current) =>
      current.map((conversation) =>
        conversation._id === conversationId
          ? {
              ...conversation,
              messages: [...conversation.messages, message],
              lastMessage: message.text,
              lastMessageAt: message.createdAt
            }
          : conversation
      )
    );
  }, []);

  const handleSend = (event) => {
    event?.preventDefault();
    const text = draft.trim();
    if (!text || !selected) return;

    const outgoing = {
      _id: `local-${Date.now()}`,
      direction: "outgoing",
      text,
      aiGenerated: false,
      status: "sent",
      createdAt: new Date().toISOString()
    };

    appendMessage(selected._id, outgoing);
    setDraft("");

    const timer = setTimeout(() => {
      setTyping(true);
      const replyTimer = setTimeout(() => {
        appendMessage(selected._id, {
          _id: `ai-${Date.now()}`,
          direction: "outgoing",
          text: aiReplyFor(text),
          aiGenerated: true,
          status: "delivered",
          createdAt: new Date().toISOString()
        });
        setTyping(false);
      }, 1600);
      timers.current.push(replyTimer);
    }, 500);

    timers.current.push(timer);
  };

  const handleSuggestion = () => {
    const suggestion = suggestions[Math.floor(Math.random() * suggestions.length)];
    setDraft(suggestion);
  };

  const handleFile = (event) => {
    const file = event.target.files?.[0];
    if (!file || !selected) return;

    appendMessage(selected._id, {
      _id: `file-${Date.now()}`,
      direction: "outgoing",
      text: `📎 ${file.name}`,
      aiGenerated: false,
      status: "sent",
      createdAt: new Date().toISOString()
    });
    toast("Attachment added to this preview conversation.", "info");
    event.target.value = "";
  };

  const toggleStatus = () => {
    if (!selected) return;
    const nextStatus = selected.status === "resolved" ? "open" : "resolved";
    setConversations((current) =>
      current.map((conversation) =>
        conversation._id === selected._id ? { ...conversation, status: nextStatus } : conversation
      )
    );
    toast(nextStatus === "resolved" ? "Conversation marked as resolved." : "Conversation reopened.");
  };

  const groupedMessages = useMemo(() => {
    if (!selected) return [];
    return selected.messages;
  }, [selected]);

  return (
    <div className="page conversations-page">
      <header className="page-head page-head--tight">
        <div>
          <div className="page-head__eyebrow">
            <span>Inbox</span>
            <span className="chip chip--preview">Preview</span>
          </div>
          <h2>Conversations</h2>
          <p>Your WhatsApp and web chats, with your AI assistant handling the first reply.</p>
        </div>
        <div className="page-head__actions">
          <span className="ai-status-pill">
            <Sparkles size={15} /> AI auto-reply on
          </span>
          <Link to="/settings/ai" className="btn btn-secondary">AI instructions</Link>
        </div>
      </header>

      <div className="notice notice--preview notice--slim">
        <Info size={16} />
        <p>This inbox is a design preview. Connect the messaging API to send and receive real messages.</p>
      </div>

      <section className={`inbox ${mobileChat ? "is-chat-open" : ""}`}>
        <aside className="inbox__list">
          <div className="inbox__list-head">
            <div className="search-box search-box--sm">
              <Search size={16} />
              <input
                type="search"
                placeholder="Search conversations…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                aria-label="Search conversations"
              />
            </div>
            <div className="inbox-tabs">
              {tabs.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  className={filter === tab.value ? "is-active" : ""}
                  onClick={() => setFilter(tab.value)}
                >
                  {tab.label}
                  {tab.value === "open" ? (
                    <span>{conversations.filter((item) => item.status === "open").length}</span>
                  ) : null}
                </button>
              ))}
            </div>
          </div>

          <div className="conversation-list">
            {filtered.length ? (
              filtered.map((conversation) => (
                <button
                  type="button"
                  key={conversation._id}
                  className={`conversation ${selected?._id === conversation._id ? "is-active" : ""}`}
                  onClick={() => openConversation(conversation._id)}
                >
                  <span className="avatar">{initials(conversation.customer?.name || "Guest")}</span>
                  <span className="conversation__body">
                    <span className="conversation__top">
                      <strong>{conversation.customer?.name || "Guest"}</strong>
                      <time>{timeAgo(conversation.lastMessageAt)}</time>
                    </span>
                    <span className="conversation__bottom">
                      <em>
                        {conversation.channel === "whatsapp" ? <MessageCircle size={12} /> : <Globe size={12} />}
                        {conversation.lastMessage}
                      </em>
                      {conversation.unreadCount ? <b>{conversation.unreadCount}</b> : null}
                    </span>
                  </span>
                </button>
              ))
            ) : (
              <EmptyState
                compact
                icon={Search}
                title="No conversations found"
                description="Try another search or filter."
              />
            )}
          </div>

          <div className="inbox__list-foot">
            <span><span className="live-dot" /> {conversations.filter((item) => item.status === "open").length} open</span>
            <span>{conversations.length} total</span>
          </div>
        </aside>

        {selected ? (
          <div className="inbox__chat">
            <header className="chat-head">
              <button type="button" className="icon-btn chat-head__back" onClick={() => setMobileChat(false)} aria-label="Back to conversations">
                <ArrowLeft size={18} />
              </button>
              <span className="avatar">{initials(selected.customer?.name || "Guest")}</span>
              <div className="chat-head__person">
                <strong>{selected.customer?.name || "Guest"}</strong>
                <span>
                  {selected.customer?.phone || "No phone"} ·
                  <em className="chat-head__online"><span className="live-dot" /> online</em>
                </span>
              </div>
              <span className={`chip chip--${selected.status === "resolved" ? "success" : "info"}`}>
                {selected.status === "resolved" ? "Resolved" : "Open"}
              </span>
              <div className="chat-head__actions">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={toggleStatus}
                >
                  <CheckCircle2 size={15} />
                  {selected.status === "resolved" ? "Reopen" : "Resolve"}
                </button>
                <a className="icon-btn" href={`tel:${selected.customer?.phone || ""}`} aria-label="Call customer">
                  <Phone size={17} />
                </a>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => toast("Conversation options will be available with the messaging API.", "info")}
                  aria-label="More options"
                >
                  <MoreHorizontal size={18} />
                </button>
              </div>
            </header>

            <div className="chat-body" ref={messagesRef}>
              <div className="chat-day">
                <span>{formatDate(selected.messages[0]?.createdAt || new Date())}</span>
              </div>

              {groupedMessages.map((message, index) => {
                const previous = groupedMessages[index - 1];
                const showDivider = previous && !isSameDay(previous.createdAt, message.createdAt);
                return (
                  <div key={message._id}>
                    {showDivider ? (
                      <div className="chat-day">
                        <span>{formatDate(message.createdAt)}</span>
                      </div>
                    ) : null}
                    <div className={`message ${message.direction === "outgoing" ? "message--out" : "message--in"}`}>
                      {message.direction === "incoming" ? (
                        <span className="avatar avatar--xs message__avatar">{initials(selected.customer?.name || "G")}</span>
                      ) : null}
                      <div className="message__bubble">
                        {message.aiGenerated ? (
                          <span className="message__ai"><Sparkles size={11} /> AI reply</span>
                        ) : null}
                        <p>{message.text}</p>
                        <span className="message__meta">
                          {formatTime(message.createdAt)}
                          {message.direction === "outgoing" ? (
                            message.status === "delivered" || message.status === "read" ? (
                              <CheckCheck size={13} className="message__checks" />
                            ) : (
                              <CheckCheck size={13} className="message__checks is-sent" />
                            )
                          ) : null}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {typing ? (
                <div className="message message--out">
                  <div className="message__bubble message__bubble--typing">
                    <span className="typing-dots"><i /><i /><i /></span>
                    <em>AI assistant is typing…</em>
                  </div>
                </div>
              ) : null}
            </div>

            <form className="chat-composer" onSubmit={handleSend}>
              <div className="chat-composer__tools">
                <button
                  type="button"
                  className="icon-btn"
                  onClick={handleSuggestion}
                  title="Suggest a reply"
                  aria-label="Suggest a reply"
                >
                  <Sparkles size={18} />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => fileRef.current?.click()}
                  title="Attach a file"
                  aria-label="Attach a file"
                >
                  <Paperclip size={18} />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setDraft((value) => `${value} 😊`)}
                  title="Add an emoji"
                  aria-label="Add an emoji"
                >
                  <Smile size={18} />
                </button>
                <input ref={fileRef} type="file" hidden onChange={handleFile} />
              </div>
              <div className="chat-composer__input">
                <textarea
                  rows={1}
                  placeholder={`Reply to ${selected.customer?.name?.split(" ")[0] || "customer"}…`}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      handleSend(event);
                    }
                  }}
                />
                <span className="chat-composer__hint">Enter to send · Shift + Enter for a new line</span>
              </div>
              <button type="submit" className="chat-send" disabled={!draft.trim()} aria-label="Send message">
                <Send size={18} />
              </button>
            </form>
          </div>
        ) : (
          <div className="inbox__empty">
            <EmptyState icon={MessageCircle} title="Select a conversation" description="Choose a chat from the list to see the full history." />
          </div>
        )}
      </section>
    </div>
  );
}
