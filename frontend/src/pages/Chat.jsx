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

const API = "/api";

export default function Chat() {
  const [threads, setThreads] = useState([]);
  const [availableContacts, setAvailableContacts] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const meUid = useRef(null);
  const messagesRef = useRef(null);
  const unsubscribeRef = useRef(null);

  /* =========================
     FETCH AVAILABLE CONTACTS
  ========================= */
  async function fetchAvailableContacts() {
    try {
      // Get token
      const token = localStorage.getItem("solennia_token");
      if (!token) {
        console.log("No token, skipping contacts fetch");
        return;
      }

      console.log("Fetching available contacts...");

      // Fetch vendors and admins
      const res = await fetch(`${API}/chat/contacts`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!res.ok) {
        console.error("Failed to fetch contacts:", res.status);
        return;
      }

      const json = await res.json();
      const contacts = json.contacts || [];
      
      console.log("Raw contacts:", contacts);
      
      // Enrich with vendor info
      const enriched = await Promise.all(
        contacts.map(async (contact) => {
          // If vendor, try to get business name
          if (contact.role === 1) {
            try {
              const vendorRes = await fetch(`${API}/vendor/public/${contact.id}`);
              if (vendorRes.ok) {
                const vendorJson = await vendorRes.json();
                return {
                  ...contact,
                  displayName: vendorJson.vendor?.business_name || `${contact.first_name} ${contact.last_name}`,
                  avatar: vendorJson.vendor?.vendor_logo || null,
                  isVendor: true
                };
              }
            } catch (e) {
              console.log("Could not fetch vendor info:", e);
            }
          }
          
          return {
            ...contact,
            displayName: `${contact.first_name} ${contact.last_name}`,
            isVendor: false
          };
        })
      );

      console.log("Enriched contacts:", enriched);
      setAvailableContacts(enriched);
    } catch (e) {
      console.error("Error fetching contacts:", e);
    }
  }

  /* =========================
     BOOTSTRAP CHAT
  ========================= */
  useEffect(() => {
    async function boot() {
      try {
        setLoading(true);
        
        // Initialize Firebase chat
        await initChat();
        meUid.current = currentUserUid();
        console.log("Chat initialized for user:", meUid.current);

        // Load existing threads
        const existingThreads = await listThreadsForCurrentUser();
        setThreads(existingThreads || []);

        // Load available contacts
        await fetchAvailableContacts();

        // Handle ?to= query parameter
        const params = new URLSearchParams(window.location.search);
        const toParam = params.get("to");
        
        if (toParam) {
          console.log("Opening chat with:", toParam);
          
          // Fetch user data first
          const userData = await fetchUserData(toParam);
          console.log("Fetched user data:", userData);
          
          // Open thread with proper user data
          openThreadByOtherUid(toParam, async (info) => {
            if (!info) {
              console.error("Could not open thread");
              alert("Could not open chat with this user");
              return;
            }
            
            console.log("Thread opened:", info);
            openThread(info.threadId, info.otherUid, userData);
          });
        }

        setLoading(false);
      } catch (e) {
        console.error("Chat init error:", e);
        alert("Could not initialize chat. Please make sure you're logged in.");
        setLoading(false);
      }
    }
    boot();

    // Cleanup
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, []);

  /* =========================
     FETCH USER DATA
  ========================= */
  async function fetchUserData(identifier) {
    try {
      // Try by Firebase UID first
      let res = await fetch(`${API}/users/${identifier}`);
      
      // If not found, try by MySQL ID
      if (!res.ok) {
        res = await fetch(`${API}/users/by-id/${identifier}`);
      }

      if (res.ok) {
        const json = await res.json();
        const user = json.user;
        
        // If vendor, get business info
        if (user.role === 1) {
          try {
            const vendorRes = await fetch(`${API}/vendor/public/${user.id}`);
            if (vendorRes.ok) {
              const vendorJson = await vendorRes.json();
              return {
                ...user,
                displayName: vendorJson.vendor?.business_name || `${user.first_name} ${user.last_name}`,
                avatar: vendorJson.vendor?.vendor_logo || user.avatar,
                isVendor: true
              };
            }
          } catch (e) {}
        }

        return {
          ...user,
          displayName: `${user.first_name} ${user.last_name}`,
          isVendor: false
        };
      }
    } catch (e) {
      console.error("Error fetching user:", e);
    }

    return {
      displayName: "Unknown User",
      role: 0
    };
  }

  /* =========================
     OPEN THREAD
  ========================= */
  async function openThread(threadId, otherUid, meta = {}) {
    console.log("Opening thread:", { threadId, otherUid, meta });
    
    // Clean up previous listener
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }

    // Ensure meta has at least a displayName
    if (!meta.displayName) {
      meta = await fetchUserData(otherUid);
    }

    setActive({ threadId, otherUid, meta });
    setMessages([]);

    // Listen to messages
    unsubscribeRef.current = onThreadMessages(threadId, (msg) => {
      setMessages((prev) => {
        // Avoid duplicates
        if (prev.find(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    });

    // Refresh threads list to show this new conversation
    const updatedThreads = await listThreadsForCurrentUser();
    setThreads(updatedThreads || []);
  }

  /* =========================
     START NEW CHAT
  ========================= */
  async function startChat(contact) {
    console.log("Starting chat with:", contact);
    const identifier = contact.firebase_uid || contact.id;
    
    openThreadByOtherUid(identifier, async (info) => {
      if (!info) {
        alert("Could not start chat with this user");
        return;
      }

      const userData = {
        displayName: contact.displayName || `${contact.first_name} ${contact.last_name}`,
        avatar: contact.avatar,
        role: contact.role,
        isVendor: contact.role === 1
      };

      console.log("Thread info:", info);
      console.log("User data:", userData);

      await openThread(info.threadId, info.otherUid, userData);
    });
  }

  /* =========================
     SEND MESSAGE
  ========================= */
  async function send() {
    if (!input.trim() || !active) {
      console.log("Cannot send:", { hasInput: !!input.trim(), hasActive: !!active });
      return;
    }
    
    console.log("Sending message:", input, "to thread:", active.threadId);
    
    try {
      await sendMessageToThread(active.threadId, { text: input });
      setInput("");
      console.log("Message sent successfully");
    } catch (e) {
      console.error("Error sending message:", e);
      alert("Could not send message: " + e.message);
    }
  }

  /* =========================
     AUTO-SCROLL
  ========================= */
  useEffect(() => {
    messagesRef.current?.scrollTo(0, messagesRef.current.scrollHeight);
  }, [messages]);

  /* =========================
     DEBUG ACTIVE STATE
  ========================= */
  useEffect(() => {
    console.log("Active state changed:", active);
  }, [active]);

  /* =========================
     ROLE LABEL
  ========================= */
  function getRoleLabel(role) {
    if (role === 2) return "Admin";
    if (role === 1) return "Vendor";
    return "Client";
  }

  /* =========================
     RENDER
  ========================= */
  if (loading) {
    return (
      <main role="main" style={{ padding: "2rem", textAlign: "center" }}>
        <p>Loading chat...</p>
      </main>
    );
  }

  return (
    <main role="main" aria-label="Chat interface">
      <section className="chat-shell">
        {/* =========================
            CONTACT LIST
        ========================= */}
        <aside className="chat-sidebar" aria-label="Contacts">
          <div className="chat-sidebar-header">Conversations</div>

          <div className="chat-contact-list">
            {/* Existing Threads */}
            {threads.map((t) => (
              <button
                key={`thread-${t.threadId}`}
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
                  {(t.otherName || "U")[0].toUpperCase()}
                </div>

                <div className="chat-contact-main">
                  <div className="chat-contact-name">
                    {t.otherName || "User"}
                  </div>
                  <div className="chat-contact-status">
                    {t.lastMessageSnippet || "No messages yet"}
                  </div>
                </div>
              </button>
            ))}

            {/* Available Contacts */}
            {threads.length === 0 && availableContacts.length === 0 && (
              <div className="px-3 py-4 text-[0.8rem] text-gray-600">
                No contacts available
              </div>
            )}

            {availableContacts.length > 0 && (
              <>
                {threads.length > 0 && (
                  <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase">
                    Available Contacts
                  </div>
                )}
                
                {availableContacts.map((contact) => (
                  <button
                    key={`contact-${contact.id}`}
                    className="chat-contact"
                    onClick={() => startChat(contact)}
                  >
                    <div className="chat-contact-avatar">
                      {contact.avatar ? (
                        <img 
                          src={contact.avatar}
                          alt={contact.displayName}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            borderRadius: '9999px'
                          }}
                        />
                      ) : (
                        <span>{(contact.displayName || "U")[0].toUpperCase()}</span>
                      )}
                    </div>

                    <div className="chat-contact-main">
                      <div className="chat-contact-name">
                        {contact.displayName}
                        {contact.role === 1 && (
                          <span style={{
                            fontSize: '0.65rem',
                            color: '#7a5d47',
                            marginLeft: '0.5rem',
                            fontWeight: '600'
                          }}>
                            VENDOR
                          </span>
                        )}
                        {contact.role === 2 && (
                          <span style={{
                            fontSize: '0.65rem',
                            color: '#b91c1c',
                            marginLeft: '0.5rem',
                            fontWeight: '600'
                          }}>
                            ADMIN
                          </span>
                        )}
                      </div>
                      <div className="chat-contact-status">
                        Start a conversation
                      </div>
                    </div>
                  </button>
                ))}
              </>
            )}
          </div>
        </aside>

        {/* =========================
            CHAT MAIN
        ========================= */}
        <section className="chat-main" aria-live="polite">
          <header className="chat-main-header">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {active?.meta?.avatar && (
                  <img 
                    src={active.meta.avatar}
                    alt={active.meta.displayName}
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '9999px',
                      objectFit: 'cover',
                      border: '2px solid #1c1b1a'
                    }}
                  />
                )}
                <div>
                  <div style={{ fontWeight: '600' }}>
                    {active?.meta?.displayName || (active ? "User" : "Select a contact")}
                  </div>
                  {active && active.meta?.role !== undefined && (
                    <div style={{ fontSize: ".75rem", color: "#666" }}>
                      {getRoleLabel(active.meta.role)}
                    </div>
                  )}
                </div>
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
                Choose a contact on the left to start chatting.
              </p>
            )}

            {messages.map((m, i) => (
              <div
                key={m.id || i}
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
              placeholder="Type a message…"
              aria-label="Message input"
              disabled={!active}
            />
            <button 
              className="chat-send-btn" 
              onClick={send}
              disabled={!active || !input.trim()}
            >
              Send
            </button>
          </footer>
        </section>
      </section>
    </main>
  );
}