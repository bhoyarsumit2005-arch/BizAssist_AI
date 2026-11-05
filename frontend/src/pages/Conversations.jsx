import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  CheckCheck,
  Globe,
  Loader2,
  MessageCircle,
  Phone,
  RefreshCw,
  Search,
  Send,
  Smile,
  Sparkles,
  CheckCircle2
} from "lucide-react";

import EmptyState from "../components/EmptyState";
import { useToast } from "../context/ToastContext";
import api, { getErrorMessage } from "../services/api";
import { formatDate, formatTime, initials, isSameDay, timeAgo } from "../utils/format";

const tabs = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "resolved", label: "Resolved" },
  { value: "archived", label: "Archived" }
];

const STATUS_LABELS = {
  open: "Open",
  resolved: "Resolved",
  archived: "Archived"
};

export default function Conversations() {
  const { toast } = useToast();
  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [mobileChat, setMobileChat] = useState(false);
  const messagesRef = useRef(null);

  const selected = conversations.find((conversation) => conversation._id === selectedId) || null;

  const loadConversations = useCallback(
    async ({ quiet = false } = {}) => {
      if (!quiet) setLoadingList(true);

      try {
        const { data } = await api.get("/conversations");
        const list = data.conversations || [];
        setConversations(list);
        setSelectedId((current) => {
          if (current && list.some((item) => item._id === current)) return current;
          return list[0]?._id || null;
        });
      } catch (error) {
        if (error?.response?.status === 401) return;
        if (!quiet) toast(getErrorMessage(error, "Could not load conversations."), "error");
      } finally {
        if (!quiet) setLoadingList(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    loadConversations();
    const timer = setInterval(() => loadConversations({ quiet: true }), 30000);
    return () => clearInterval(timer);
  }, [loadConversations]);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return undefined;
    }

    let active = true;
    setMessages([]);
    setLoadingMessages(true);

    const loadMessages = async () => {
      try {
        const { data } = await api.get(`/conversations/${selectedId}/messages`);
        if (!active) return;
        setMessages(data.messages || []);

        if (data.conversation) {
          setConversations((current) =>
            current.map((conversation) =>
              conversation._id === selectedId ? data.conversation : conversation
            )
          );
        }
      } catch (error) {
        if (!active) return;
        if (error?.response?.status === 401) return;
        toast(getErrorMessage(error, "Could not load this conversation."), "error");
      } finally {
        if (active) setLoadingMessages(false);
      }
    };

    loadMessages();

    return () => {
      active = false;
    };
  }, [selectedId, toast]);

  useEffect(() => {
    const node = messagesRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages.length, sending, selectedId]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();

    return conversations
      .filter((conversation) => {
        if (filter !== "all" && conversation.status !== filter) return false;
        if (!term) return true;
        return [conversation.customer?.name, conversation.customer?.phone, conversation.lastMessage]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(term);
      })
      .sort((a, b) => new Date(b.lastMessageAt || b.createdAt) - new Date(a.lastMessageAt || a.createdAt));
  }, [conversations, filter, search]);

  const openConversation = (id) => {
    setSelectedId(id);
    setMobileChat(true);
    setConversations((current) =>
      current.map((conversation) =>
        conversation._id === id ? { ...conversation, unreadCount: 0 } : conversation
      )
    );
  };

  const handleSend = async (event) => {
    event?.preventDefault();
    const text = draft.trim();
    if (!text || !selected || sending) return;

    setSending(true);

    try {
      const { data } = await api.post(`/conversations/${selected._id}/messages`, { text });
      setMessages((current) => [...current, data.message]);
      setConversations((current) =>
        current.map((conversation) =>
          conversation._id === selected._id
            ? {
                ...conversation,
                lastMessage: text,
                lastMessageAt: data.message.createdAt,
                unreadCount: 0
              }
            : conversation
        )
      );
      setDraft("");
    } catch (error) {
      // Keep the draft so the owner can retry or copy it after a delivery
      // failure (for example when WhatsApp is not configured yet).
      toast(getErrorMessage(error, "Could not send this message."), "error");
    } finally {
      setSending(false);
    }
  };

  const draftWithAi = async () => {
    if (!selected || drafting) return;

    const lastIncoming = [...messages].reverse().find((message) => message.direction === "incoming");
    if (!lastIncoming) {
      toast("There is no customer message to draft a reply to.", "info");
      return;
    }

    setDrafting(true);

    try {
      const { data } = await api.post("/ai/chat", { message: lastIncoming.text });
      setDraft(data.reply || "");
    } catch (error) {
      toast(getErrorMessage(error, "Could not draft a reply."), "error");
    } finally {
      setDrafting(false);
    }
  };

  const toggleStatus = async () => {
    if (!selected || updatingStatus) return;

    const nextStatus = selected.status === "resolved" ? "open" : "resolved";
    setUpdatingStatus(true);

    try {
      const { data } = await api.put(`/conversations/${selected._id}`, { status: nextStatus });
      setConversations((current) =>
        current.map((conversation) =>
          conversation._id === selected._id ? data.conversation : conversation
        )
      );
      toast(nextStatus === "resolved" ? "Conversation marked as resolved." : "Conversation reopened.");
    } catch (error) {
      toast(getErrorMessage(error, "Could not update this conversation."), "error");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const openCount = conversations.filter((conversation) => conversation.status === "open").length;

  return (
    <div className="page conversations-page">
      <header className="page-head page-head--tight">
        <div>
          <div className="page-head__eyebrow">
            <span>Inbox</span>
            <span className="chip chip--soft">{openCount} open</span>
          </div>
          <h2>Conversations</h2>
          <p>WhatsApp messages your customers send, stored against their customer record.</p>
        </div>
        <div className="page-head__actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => loadConversations()}
            disabled={loadingList}
          >
            <RefreshCw size={16} className={loadingList ? "spin" : ""} /> Refresh
          </button>
          <Link to="/settings/ai" className="btn btn-secondary">AI instructions</Link>
        </div>
      </header>

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
                  {tab.value === "open" ? <span>{openCount}</span> : null}
                </button>
              ))}
            </div>
          </div>

          <div className="conversation-list">
            {loadingList && !conversations.length ? (
              <div className="skeleton-list skeleton-list--padded">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div className="skeleton skeleton--row" key={index} />
                ))}
              </div>
            ) : filtered.length ? (
              filtered.map((conversation) => (
                <button
                  type="button"
                  key={conversation._id}
                  className={`conversation ${selectedId === conversation._id ? "is-active" : ""}`}
                  onClick={() => openConversation(conversation._id)}
                >
                  <span className="avatar">{initials(conversation.customer?.name || "Guest")}</span>
                  <span className="conversation__body">
                    <span className="conversation__top">
                      <strong>{conversation.customer?.name || "Guest"}</strong>
                      <time>{timeAgo(conversation.lastMessageAt || conversation.createdAt)}</time>
                    </span>
                    <span className="conversation__bottom">
                      <em>
                        {conversation.channel === "whatsapp" ? <MessageCircle size={12} /> : <Globe size={12} />}
                        {conversation.lastMessage || "No messages yet"}
                      </em>
                      {conversation.unreadCount ? <b>{conversation.unreadCount}</b> : null}
                    </span>
                  </span>
                </button>
              ))
            ) : (
              <EmptyState
                compact
                icon={MessageCircle}
                title={conversations.length ? "No conversations found" : "No conversations yet"}
                description={
                  conversations.length
                    ? "Try another search or filter."
                    : "Messages appear here when customers contact your WhatsApp number."
                }
              />
            )}
          </div>

          <div className="inbox__list-foot">
            <span><span className="live-dot" /> {openCount} open</span>
            <span>{conversations.length} total</span>
          </div>
        </aside>

        {selected ? (
          <div className="inbox__chat">
            <header className="chat-head">
              <button
                type="button"
                className="icon-btn chat-head__back"
                onClick={() => setMobileChat(false)}
                aria-label="Back to conversations"
              >
                <ArrowLeft size={18} />
              </button>
              <span className="avatar">{initials(selected.customer?.name || "Guest")}</span>
              <div className="chat-head__person">
                <strong>{selected.customer?.name || "Guest"}</strong>
                <span>
                  {selected.customer?.phone || "No phone"} · {selected.channel || "whatsapp"}
                </span>
              </div>
              <span className={`chip chip--${selected.status === "resolved" ? "success" : "info"}`}>
                {STATUS_LABELS[selected.status] || selected.status}
              </span>
              <div className="chat-head__actions">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={toggleStatus}
                  disabled={updatingStatus}
                >
                  {updatingStatus ? <Loader2 size={15} className="spin" /> : <CheckCircle2 size={15} />}
                  {selected.status === "resolved" ? "Reopen" : "Resolve"}
                </button>
                <a className="icon-btn" href={`tel:${selected.customer?.phone || ""}`} aria-label="Call customer">
                  <Phone size={17} />
                </a>
              </div>
            </header>

            <div className="chat-body" ref={messagesRef}>
              {loadingMessages && !messages.length ? (
                <div className="chat-loading">
                  <Loader2 size={18} className="spin" /> Loading conversation…
                </div>
              ) : null}

              {messages.length ? (
                <div className="chat-day">
                  <span>{formatDate(messages[0].createdAt)}</span>
                </div>
              ) : !loadingMessages ? (
                <div className="chat-loading">No messages in this conversation yet.</div>
              ) : null}

              {messages.map((message, index) => {
                const previous = messages[index - 1];
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
                            message.status === "failed" ? (
                              <em className="message__failed">Failed</em>
                            ) : (
                              <CheckCheck
                                size={13}
                                className={`message__checks ${
                                  message.status === "delivered" || message.status === "read" ? "" : "is-sent"
                                }`}
                              />
                            )
                          ) : null}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <form className="chat-composer" onSubmit={handleSend}>
              <div className="chat-composer__tools">
                <button
                  type="button"
                  className="icon-btn"
                  onClick={draftWithAi}
                  disabled={drafting || !messages.length}
                  title="Draft a reply with AI"
                  aria-label="Draft a reply with AI"
                >
                  {drafting ? <Loader2 size={18} className="spin" /> : <Sparkles size={18} />}
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
              <button
                type="submit"
                className="chat-send"
                disabled={!draft.trim() || sending}
                aria-label="Send message"
              >
                {sending ? <Loader2 size={18} className="spin" /> : <Send size={18} />}
              </button>
            </form>
          </div>
        ) : (
          <div className="inbox__empty">
            <EmptyState
              icon={MessageCircle}
              title="Select a conversation"
              description="Choose a chat from the list to see the full history."
            />
          </div>
        )}
      </section>
    </div>
  );
}
