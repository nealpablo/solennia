import { useEffect, useRef, useState } from "react";
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

  useEffect(() => {
    async function boot() {
      await initChat();
      meUid.current = currentUserUid();

      const t = await listThreadsForCurrentUser();
      setThreads(t || []);

      const to = new URLSearchParams(location.search).get("to");
      if (to) {
        openThreadByOtherUid(to, (info) => {
          if (!info) return;
          openThread(info.threadId, info.otherUid, info.otherMeta);
        });
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

  return (
    <main className="chat-shell">
      <aside className="chat-sidebar">
        <div className="chat-sidebar-header">Conversations</div>
        <div className="chat-contact-list">
          {threads.map((t) => (
            <button
              key={t.threadId}
              className={`chat-contact ${
                active?.threadId === t.threadId ? "active" : ""
              }`}
              onClick={() =>
                openThread(t.threadId, t.otherUid, {
                  displayName: t.otherName
                })
              }
            >
              <div className="chat-contact-avatar">
                {(t.otherName || t.otherUid || "U")[0]}
              </div>
              <div className="chat-contact-main">
                <div className="chat-contact-name">
                  {t.otherName || t.otherUid.slice(0, 8)}
                </div>
                <div className="chat-contact-status">
                  {t.lastMessageSnippet || ""}
                </div>
              </div>
            </button>
          ))}
        </div>
      </aside>

      <section className="chat-main">
        <header className="chat-main-header">
          {active ? active.meta.displayName || "Chat" : "Select a contact"}
        </header>

        <div className="chat-main-body" ref={messagesRef}>
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
          />
          <button className="chat-send-btn" onClick={send}>
            Send
          </button>
        </footer>
      </section>
    </main>
  );
}
