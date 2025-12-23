import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
  const [contacts, setContacts] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const meUid = useRef(null);
  const messagesRef = useRef(null);
  const unsubscribeRef = useRef(null);
  const hasAutoOpened = useRef(false);

  /* ================= FETCH CONTACTS ================= */
  async function fetchContacts() {
    try {
      const token = localStorage.getItem("solennia_token");
      if (!token) {
        setLoading(false);
        return;
      }

      const res = await fetch(`${API}/chat/contacts`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        setLoading(false);
        return;
      }

      const json = await res.json();
      const contactsList = json.contacts || [];
      
      // Enrich contacts
      const enriched = await Promise.all(
        contactsList.map(async (contact) => {
          if (contact.role === 1) {
            try {
              const vendorRes = await fetch(`${API}/vendor/public/${contact.id}`);
              if (vendorRes.ok) {
                const vendorJson = await vendorRes.json();
                return {
                  ...contact,
                  displayName: vendorJson.vendor?.business_name || `${contact.first_name} ${contact.last_name}`,
                  avatar: vendorJson.vendor?.vendor_logo || contact.avatar
                };
              }
            } catch (e) {
              // Ignore
            }
          }
          
          return {
            ...contact,
            displayName: `${contact.first_name} ${contact.last_name}`
          };
        })
      );

      setContacts(enriched);
      
    } catch (e) {
      console.error("Error fetching contacts:", e);
    } finally {
      setLoading(false);
    }
  }

  /* ================= LOAD THREAD PREVIEWS ================= */
  async function loadThreadPreviews() {
    try {
      await initChat();
      meUid.current = currentUserUid();
      
      const threads = await listThreadsForCurrentUser();
      
      setContacts(prevContacts => 
        prevContacts.map(contact => {
          const thread = threads.find(t => t.otherUid === contact.firebase_uid);
          return {
            ...contact,
            lastMessage: thread?.lastMessageSnippet || "",
            lastTs: thread?.lastTs || 0
          };
        })
      );
    } catch (err) {
      console.error("Failed to load threads:", err);
    }
  }

  /* ================= INITIAL LOAD ================= */
  useEffect(() => {
    fetchContacts();
  }, []);

  useEffect(() => {
    if (contacts.length > 0 && !meUid.current) {
      loadThreadPreviews();
    }
  }, [contacts]);

  /* ================= HANDLE ?to= PARAMETER - ✅ NEW ================= */
  useEffect(() => {
    const toUid = searchParams.get('to');
    
    if (toUid && !hasAutoOpened.current && meUid.current && contacts.length > 0) {
      hasAutoOpened.current = true;
      
      // Check if contact exists
      let contact = contacts.find(c => c.firebase_uid === toUid);
      
      if (contact) {
        // Contact exists, open chat
        openChat(contact);
        // Clear URL parameter
        navigate('/chat', { replace: true });
      } else {
        // Contact doesn't exist yet, fetch user info and create contact
        fetchUserAndOpenChat(toUid);
      }
    }
  }, [searchParams, contacts, meUid.current]);

  /* ================= FETCH USER AND OPEN CHAT - ✅ NEW ================= */
  async function fetchUserAndOpenChat(firebaseUid) {
    try {
      const token = localStorage.getItem("solennia_token");
      
      // Get user by firebase UID
      const res = await fetch(`${API}/users/${firebaseUid}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!res.ok) {
        toast.error("User not found");
        navigate('/chat', { replace: true });
        return;
      }
      
      const json = await res.json();
      const user = json.user;
      
      // Enrich if vendor
      let displayName = `${user.first_name} ${user.last_name}`;
      let avatar = user.avatar;
      
      if (user.role === 1) {
        try {
          const vendorRes = await fetch(`${API}/vendor/public/${user.id}`);
          if (vendorRes.ok) {
            const vendorJson = await vendorRes.json();
            displayName = vendorJson.vendor?.business_name || displayName;
            avatar = vendorJson.vendor?.vendor_logo || avatar;
          }
        } catch (e) {
          // Use defaults
        }
      }
      
      const newContact = {
        id: user.id,
        firebase_uid: user.firebase_uid,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        avatar: avatar,
        displayName: displayName
      };
      
      // Add to contacts
      setContacts(prev => {
        const exists = prev.find(c => c.firebase_uid === firebaseUid);
        if (exists) return prev;
        return [...prev, newContact];
      });
      
      // Open chat
      openChat(newContact);
      
      // Clear URL parameter
      navigate('/chat', { replace: true });
      
      // Refresh contacts from backend (this will persist the contact)
      setTimeout(() => fetchContacts(), 1000);
      
    } catch (err) {
      console.error("Failed to fetch user:", err);
      toast.error("Failed to start conversation");
      navigate('/chat', { replace: true });
    }
  }

  /* ================= OPEN CHAT ================= */
  function openChat(contact) {
    if (!meUid.current) {
      toast.error("Chat not initialized");
      return;
    }

    setActive(contact);
    setMessages([]);

    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    openThreadByOtherUid(contact.firebase_uid, (result) => {
      if (!result) {
        toast.error("Failed to open conversation");
        return;
      }

      const { threadId } = result;
      setMessages([]);

      onThreadMessages(threadId, (msg) => {
        setMessages((prev) => {
          const exists = prev.find((m) => m.id === msg.id);
          if (exists) return prev;
          return [...prev, msg];
        });
      });

      unsubscribeRef.current = () => {};
    });

    // Refresh contacts after opening
    setTimeout(() => fetchContacts(), 1000);
  }

  /* ================= SEND MESSAGE ================= */
  async function handleSend() {
    if (!input.trim() || !active) return;

    const threadId = (active.firebase_uid < meUid.current)
      ? `${active.firebase_uid}__${meUid.current}`
      : `${meUid.current}__${active.firebase_uid}`;

    try {
      await sendMessageToThread(threadId, { text: input });
      setInput("");
      
      setTimeout(() => {
        if (messagesRef.current) {
          messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
        }
      }, 100);
      
      setTimeout(() => fetchContacts(), 500);
    } catch (err) {
      console.error("Send failed:", err);
      toast.error("Failed to send message");
    }
  }

  /* ================= AUTO SCROLL ================= */
  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages]);

  /* ================= CLEANUP ================= */
  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, []);

  if (loading) {
    return (
      <div className="chat-shell">
        <div style={{ margin: "auto", textAlign: "center", padding: "2rem" }}>
          <div style={{
            width: '3rem',
            height: '3rem',
            border: '4px solid #e8ddae',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1rem'
          }} />
          <p>Loading chat...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-shell">
      {/* ================= SIDEBAR ================= */}
      <aside className="chat-sidebar">
        <div className="chat-sidebar-header">
          <span>CONVERSATIONS</span>
          {contacts.length > 0 && (
            <span className="unread-badge">{contacts.length}</span>
          )}
        </div>

        <div className="chat-contact-list">
          {contacts.length === 0 ? (
            <div className="empty-state">
              <p style={{ textAlign: 'center', padding: '2rem 1rem', color: '#666', fontSize: '0.875rem' }}>
                No contacts yet. Visit the Vendors page to start chatting with vendors.
              </p>
            </div>
          ) : (
            contacts.map((contact) => {
              const isActive = active?.id === contact.id;

              return (
                <button
                  key={contact.id}
                  onClick={() => openChat(contact)}
                  className={`chat-contact ${isActive ? "active" : ""}`}
                >
                  <div className="chat-contact-avatar">
                    {contact.avatar ? (
                      <img src={contact.avatar} alt="" className="contact-avatar-img" />
                    ) : (
                      contact.displayName?.charAt(0)?.toUpperCase() || "?"
                    )}
                  </div>
                  
                  <div className="chat-contact-main">
                    <div className="chat-contact-name">
                      {contact.displayName || "Unknown User"}
                      {contact.role === 2 && (
                        <span className="role-badge admin-badge">ADMIN</span>
                      )}
                      {contact.role === 1 && (
                        <span className="role-badge vendor-badge">VENDOR</span>
                      )}
                    </div>
                    
                    {contact.lastMessage && (
                      <div className="chat-contact-preview">
                        {contact.lastMessage.length > 40 
                          ? contact.lastMessage.substring(0, 40) + "..." 
                          : contact.lastMessage}
                      </div>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* ================= MAIN CHAT ================= */}
      <main className="chat-main">
        {!active ? (
          <div className="chat-empty-state">
            <div className="empty-icon">💬</div>
            <p>Select a conversation to start messaging</p>
            <p style={{ fontSize: '0.875rem', color: '#999', marginTop: '0.5rem' }}>
              Or visit the Vendors page to chat with vendors
            </p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="chat-main-header">
              <div className="header-user-info">
                {active.avatar ? (
                  <img src={active.avatar} alt="" className="header-avatar" />
                ) : (
                  <div className="header-avatar" style={{ 
                    background: '#e8ddae', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    fontWeight: 600,
                    color: '#7a5d47'
                  }}>
                    {active.displayName?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                )}
                <div>
                  <div className="header-name">{active.displayName}</div>
                  <div className="header-role">
                    {active.role === 2 ? "Admin" : active.role === 1 ? "Vendor" : "Client"}
                  </div>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="chat-main-body" ref={messagesRef}>
              {messages.length === 0 ? (
                <div style={{ 
                  textAlign: 'center', 
                  color: '#999', 
                  padding: '2rem',
                  fontSize: '0.875rem'
                }}>
                  No messages yet. Say hello! 👋
                </div>
              ) : (
                messages.map((msg) => {
                  const isMe = msg.senderUid === meUid.current;
                  return (
                    <div key={msg.id} className={`chat-message ${isMe ? "me" : "them"}`}>
                      <div className="message-text">{msg.text}</div>
                      <div className="chat-meta">
                        {new Date(msg.ts).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Input */}
            <div className="chat-input-bar">
              <input
                className="chat-input"
                placeholder="Type a message..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
              />
              <button
                className="chat-send-btn"
                onClick={handleSend}
                disabled={!input.trim()}
              >
                Send
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}