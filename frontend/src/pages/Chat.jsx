import React, { useEffect, useRef, useState } from "react";
import "../chat.css";
import toast from "../utils/toast";
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
  const [adminContacts, setAdminContacts] = useState([]);
  const [vendorContacts, setVendorContacts] = useState([]);
  const [showVendors, setShowVendors] = useState(false);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const meUid = useRef(null);
  const messagesRef = useRef(null);
  const unsubscribeRef = useRef(null);

  /* =========================
     FETCH AVAILABLE CONTACTS
  ========================= */
  async function fetchAvailableContacts() {
    try {
      const token = localStorage.getItem("solennia_token");
      if (!token) {
        console.log("No token, skipping contacts fetch");
        return;
      }

      console.log("Fetching available contacts...");

      // Fetch all contacts (vendors and admins)
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

      // Separate admins and vendors
      const admins = enriched.filter(c => c.role === 2);
      const vendors = enriched.filter(c => c.role === 1);

      console.log("Admins:", admins);
      console.log("Vendors:", vendors);

      setAdminContacts(admins);
      setVendorContacts(vendors);
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
              toast.error("Could not open chat with this user");
              return;
            }
            
            console.log("Thread opened:", info);
            openThread(info.threadId, info.otherUid, userData);
          });
        }

        // Check for new messages every 30 seconds
        const interval = setInterval(checkForNewMessages, 30000);

        setLoading(false);
        
        return () => clearInterval(interval);
      } catch (e) {
        console.error("Chat init error:", e);
        toast.error("Could not initialize chat. Please make sure you're logged in.");
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
     CHECK FOR NEW MESSAGES
  ========================= */
  async function checkForNewMessages() {
    try {
      const currentThreads = await listThreadsForCurrentUser();
      const oldThreadCount = threads.length;
      const newThreadCount = currentThreads.length;
      
      if (newThreadCount > oldThreadCount) {
        setUnreadCount(prev => prev + (newThreadCount - oldThreadCount));
        toast.info("You have new messages!");
        
        // Play notification sound (optional)
        if (typeof Audio !== 'undefined') {
          const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiDYIFWW47OyhUQ==');
          audio.volume = 0.3;
          audio.play().catch(() => {});
        }
      }
      
      setThreads(currentThreads);
    } catch (e) {
      console.error("Error checking for new messages:", e);
    }
  }

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
        
        // Show notification if message is from other person
        if (msg.senderUid !== meUid.current) {
          toast.info(`New message from ${meta.displayName}`);
        }
        
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
        toast.error("Could not start chat with this user");
        return;
      }

      const userData = {
        displayName: contact.displayName || `${contact.first_name} ${contact.last_name}`,
        avatar: contact.avatar,
        role: contact.role,
        isVendor: contact.isVendor
      };

      openThread(info.threadId, info.otherUid, userData);
      
      toast.success(`Chat started with ${userData.displayName}`);
    });
  }

  /* =========================
     SEND MESSAGE
  ========================= */
  async function send() {
    if (!input.trim() || !active) {
      return;
    }
    
    console.log("Sending message:", input, "to thread:", active.threadId);
    
    try {
      await sendMessageToThread(active.threadId, { text: input });
      setInput("");
      console.log("Message sent successfully");
    } catch (e) {
      console.error("Error sending message:", e);
      toast.error("Could not send message: " + e.message);
    }
  }

  /* =========================
     AUTO-SCROLL
  ========================= */
  useEffect(() => {
    messagesRef.current?.scrollTo(0, messagesRef.current.scrollHeight);
  }, [messages]);

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

  // Get available contacts to show (admins always, vendors only if showVendors is true)
  const displayContacts = showVendors 
    ? [...adminContacts, ...vendorContacts]
    : adminContacts;

  // Filter out contacts that already have threads
  const threadUserIds = threads.map(t => t.otherUid);
  const availableContacts = displayContacts.filter(contact => {
    const contactUid = contact.firebase_uid;
    return !threadUserIds.includes(contactUid);
  });

  return (
    <main role="main" aria-label="Chat interface">
      <section className="chat-shell">
        {/* =========================
            CONTACT LIST
        ========================= */}
        <aside className="chat-sidebar" aria-label="Contacts">
          <div className="chat-sidebar-header">
            <span>Conversations</span>
            {unreadCount > 0 && (
              <span className="unread-badge">{unreadCount}</span>
            )}
          </div>

          <div className="chat-contact-list">
            {/* Existing Threads */}
            {threads.map((t) => (
              <button
                key={`thread-${t.threadId}`}
                className={`chat-contact ${
                  active?.threadId === t.threadId ? "active" : ""
                }`}
                onClick={() => {
                  openThread(t.threadId, t.otherUid, {
                    displayName: t.otherName,
                    role: t.otherRole
                  });
                  setUnreadCount(0);
                }}
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

            {/* Available Contacts Section */}
            {availableContacts.length > 0 && (
              <>
                <div className="contacts-divider">
                  <div className="divider-line"></div>
                  <span className="divider-text">Available Contacts</span>
                  <div className="divider-line"></div>
                </div>

                {/* Toggle Vendors Button */}
                {vendorContacts.length > 0 && (
                  <button
                    className="toggle-vendors-btn"
                    onClick={() => setShowVendors(!showVendors)}
                  >
                    {showVendors ? "Hide Vendors" : "Show Vendors"}
                    <span className="vendor-count">({vendorContacts.length})</span>
                  </button>
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
                          className="contact-avatar-img"
                        />
                      ) : (
                        <span>{(contact.displayName || "U")[0].toUpperCase()}</span>
                      )}
                    </div>

                    <div className="chat-contact-main">
                      <div className="chat-contact-name">
                        {contact.displayName}
                        {contact.role === 1 && (
                          <span className="role-badge vendor-badge">VENDOR</span>
                        )}
                        {contact.role === 2 && (
                          <span className="role-badge admin-badge">ADMIN</span>
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

            {/* Empty State */}
            {threads.length === 0 && availableContacts.length === 0 && (
              <div className="empty-state">
                <p>No contacts available</p>
                {vendorContacts.length > 0 && !showVendors && (
                  <button 
                    className="btn-show-vendors"
                    onClick={() => setShowVendors(true)}
                  >
                    Show {vendorContacts.length} Vendor{vendorContacts.length > 1 ? 's' : ''}
                  </button>
                )}
              </div>
            )}
          </div>
        </aside>

        {/* =========================
            CHAT MAIN
        ========================= */}
        <section className="chat-main" aria-live="polite">
          <header className="chat-main-header">
            <div>
              <div className="header-user-info">
                {active?.meta?.avatar && (
                  <img 
                    src={active.meta.avatar}
                    alt={active.meta.displayName}
                    className="header-avatar"
                  />
                )}
                <div>
                  <div className="header-name">
                    {active?.meta?.displayName || (active ? "User" : "Select a contact")}
                  </div>
                  {active && active.meta?.role !== undefined && (
                    <div className="header-role">
                      {getRoleLabel(active.meta.role)}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="header-status">
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
              <div className="chat-empty-state">
                <div className="empty-icon">💬</div>
                <p>Choose a contact on the left to start chatting</p>
              </div>
            )}

            {messages.map((m, i) => (
              <div
                key={m.id || i}
                className={`chat-message ${
                  m.senderUid === meUid.current ? "me" : "them"
                }`}
              >
                <div className="message-text">{m.text}</div>
                <div className="chat-meta">
                  {new Date(m.ts || Date.now()).toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
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
              placeholder={active ? "Type a message…" : "Select a contact first"}
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