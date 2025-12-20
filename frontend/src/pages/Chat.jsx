import React, { useEffect, useRef, useState } from "react";
import "../chat.css";
import {
  initChat,
  currentUserUid,
  listThreadsForCurrentUser,
  openThreadByOtherUid,
  sendMessageToThread,
  onThreadMessages
} from "../firebase-chat";

export default function Chat() {
  const [threads, setThreads] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const meUid = useRef(null);
  const messagesRef = useRef(null);

  /* =========================
     BOOTSTRAP CHAT
  ========================= */
  useEffect(() => {
    async function boot() {
      try {
        await initChat();
        meUid.current = currentUserUid();

        const t = await listThreadsForCurrentUser();
        setThreads(t || []);

        const to = new URLSearchParams(window.location.search).get("to");
        if (to) {
          openThreadByOtherUid(to, (info) => {
            if (!info) return;
            openThread(info.threadId, info.otherUid, info.otherMeta);
          });
        }
      } catch (e) {
        console.error("Chat init error", e);
      }
    }
    boot();
  }, []);

  function openThread(threadId, otherUid, meta = {}) {
    setActive({ threadId, otherUid, meta });
    setMessages([]);

    onThreadMessages(threadId, (msg) => {
      setMessages((prev) => [...prev, msg]);
    });
  }

  async function send() {
    if (!input.trim() || !active) return;
    await sendMessageToThread(active.threadId, { text: input });
    setInput("");
  }

  useEffect(() => {
    messagesRef.current?.scrollTo(0, messagesRef.current.scrollHeight);
  }, [messages]);

  /* =========================
     RENDER
  ========================= */
  return (
    <main role="main" aria-label="Chat interface">
      <section className="chat-shell">
        {/* =========================
            CONTACT LIST
        ========================= */}
        <aside className="chat-sidebar" aria-label="Contacts">
          <div className="chat-sidebar-header">Conversations</div>

          <div className="chat-contact-list">
            {threads.length === 0 && (
              <div className="px-3 py-4 text-[0.8rem] text-gray-600">
                No conversations yet.
              </div>
            )}

            {threads.map((t) => (
              <button
                key={t.threadId}
                className={`chat-contact ${
                  active?.threadId === t.threadId ? "active" : ""
                }`}
                onClick={() =>
                  openThread(t.threadId, t.otherUid, {
                    displayName: t.otherName,
                    role: t.otherRole
                  })
                }
              >
                <div className="chat-contact-avatar">
                  {(t.otherName || t.otherUid || "U")[0]}
                </div>

                <div className="chat-contact-main">
                  <div className="chat-contact-name">
                    {t.otherName || t.otherUid?.slice(0, 8) || "User"}
                  </div>
                  <div className="chat-contact-status">
                    {t.lastMessageSnippet || ""}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </aside>

        {/* =========================
            CHAT MAIN
        ========================= */}
        <section className="chat-main" aria-live="polite">
          <header className="chat-main-header">
            <div>
              <div>
                {active
                  ? active.meta.displayName ||
                    active.meta.business_name ||
                    "Chat"
                  : "Select a contact"}
              </div>
              <div style={{ fontSize: ".75rem", color: "#444" }}>
                {active?.meta?.role === 1
                  ? "Vendor"
                  : active?.meta?.role === 2
                  ? "Admin"
                  : ""}
              </div>
            </div>

            <div style={{ fontSize: ".75rem", color: "#444" }}>
              {meUid.current ? "Connected" : "Not signed in"}
            </div>
          </header>

          <div
            className="chat-main-body"
            ref={messagesRef}
            tabIndex={0}
            aria-live="polite"
          >
            {!active && (
              <p className="chat-timestamp">
                Choose a vendor or user on the left to start chatting.
              </p>
            )}

            {messages.map((m, i) => (
              <div
                key={i}
                className={`chat-message ${
                  m.senderUid === meUid.current ? "me" : "them"
                }`}
              >
                <div>{m.text}</div>
                <div className="chat-meta">
                  {new Date(m.ts || Date.now()).toLocaleString()}
                </div>
              </div>
            ))}
          </div>

          <footer className="chat-input-bar">
            <input
              className="chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Type…"
              aria-label="Message input"
            />
            <button className="chat-send-btn" onClick={send}>
              Send
            </button>
          </footer>
        </section>
      </section>
    </main>
  );
}
