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
  onThreadMessages,
  onAllThreadsUpdate
} from "../firebase-chat";

const API =
  import.meta.env.VITE_API_BASE ||
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD
    ? "https://solennia.up.railway.app/api" : "/api");

// Format message time in user's local timezone with context
const formatMessageTime = (timestamp) => {
  const msgDate = new Date(timestamp);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDay = new Date(msgDate.getFullYear(), msgDate.getMonth(), msgDate.getDate());

  const diffDays = Math.floor((today - msgDay) / (1000 * 60 * 60 * 24));

  const timeStr = msgDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  if (diffDays === 0) {
    return timeStr;
  } else if (diffDays === 1) {
    return `Yesterday ${timeStr}`;
  } else if (diffDays < 7) {
    const dayName = msgDate.toLocaleDateString('en-US', { weekday: 'short' });
    return `${dayName} ${timeStr}`;
  } else {
    return msgDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }
};

// Clean SVG icons
const IconSend = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

export default function Chat() {
  const [contacts, setContacts] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [myRole, setMyRole] = useState(0);

  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const meUid = useRef(null);
  const messagesRef = useRef(null);
  const unsubscribeRef = useRef(null);
  const threadsUnsubscribeRef = useRef(null);
  const hasAutoOpened = useRef(false);
  const textareaRef = useRef(null);

  useEffect(() => {
    async function init() {
      try {
        const token = localStorage.getItem("solennia_token");
        if (!token) {
          setLoading(false);
          return;
        }

        const profileData = localStorage.getItem("solennia_profile");
        if (profileData) {
          const profile = JSON.parse(profileData);
          setMyRole(profile.role || 0);
        }

        await initChat();
        meUid.current = currentUserUid();
        await loadContacts();

        // Set up real-time listener for thread updates
        threadsUnsubscribeRef.current = onAllThreadsUpdate(async (threads) => {
          console.log('🔄 Threads updated:', threads.length);
          await updateContactsFromThreads(threads);
        });

      } catch (err) {
        console.error("Failed to initialize chat:", err);
        toast.error("Failed to initialize chat");
      } finally {
        setLoading(false);
      }
    }

    init();
  }, []);

  // Update contacts when threads change in real-time
  async function updateContactsFromThreads(threads) {
    const token = localStorage.getItem("solennia_token");
    if (!token) return;

    setContacts(prevContacts => {
      const contactMap = new Map();

      for (const contact of prevContacts) {
        if (contact.firebase_uid) {
          contactMap.set(contact.firebase_uid, { ...contact });
        }
      }

      for (const thread of threads) {
        const { otherUid, lastMessageSnippet, lastTs } = thread;

        if (contactMap.has(otherUid)) {
          const contact = contactMap.get(otherUid);
          contact.lastMessage = lastMessageSnippet;
          contact.lastTs = lastTs;
        } else {
          fetchAndAddContact(otherUid, lastMessageSnippet, lastTs);
        }
      }

      const updatedContacts = Array.from(contactMap.values())
        .sort((a, b) => (b.lastTs || 0) - (a.lastTs || 0));

      return updatedContacts;
    });
  }

  // Fetch user info and add to contacts
  async function fetchAndAddContact(firebaseUid, lastMessage, lastTs) {
    try {
      const token = localStorage.getItem("solennia_token");
      const userRes = await fetch(`${API}/users/${firebaseUid}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!userRes.ok) {
        console.log(`User ${firebaseUid} not found in database (404)`);
        return;
      }

      if (userRes.ok) {
        const userData = await userRes.json();
        const user = userData.user;

        let displayName = `${user.first_name} ${user.last_name}`;
        let avatar = user.avatar;

        if (user.role === 1) {
          try {
            const vendorRes = await fetch(`${API}/vendor/public/${user.id}`);
            if (vendorRes.ok) {
              const vendorData = await vendorRes.json();
              displayName = vendorData.vendor?.business_name || displayName;
              avatar = vendorData.vendor?.vendor_logo || avatar;
            }
          } catch (e) {
            console.log("Could not fetch supplier info");
          }
        }

        const newContact = {
          id: user.id,
          firebase_uid: firebaseUid,
          first_name: user.first_name,
          last_name: user.last_name,
          role: user.role,
          avatar: avatar,
          displayName: displayName,
          lastMessage: lastMessage,
          lastTs: lastTs
        };

        setContacts(prev => {
          const exists = prev.find(c => c.firebase_uid === firebaseUid);
          if (exists) return prev;
          return [newContact, ...prev].sort((a, b) => (b.lastTs || 0) - (a.lastTs || 0));
        });
      }
    } catch (err) {
      console.error("Failed to fetch contact:", err);
    }
  }

  // Prevent duplicate contacts
  async function loadContacts() {
    try {
      const token = localStorage.getItem("solennia_token");
      if (!token) return;

      const res = await fetch(`${API}/chat/contacts`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) return;

      const json = await res.json();
      let mysqlContacts = json.contacts || [];
      const threads = await listThreadsForCurrentUser();

      const contactMap = new Map();
      const userIdSet = new Set();

      for (const contact of mysqlContacts) {
        if (contact.firebase_uid && contact.id) {
          userIdSet.add(contact.id);

          let displayName = `${contact.first_name} ${contact.last_name}`;
          let avatar = contact.avatar;

          if (contact.role === 1) {
            try {
              const vendorRes = await fetch(`${API}/vendor/public/${contact.id}`);
              if (vendorRes.ok) {
                const vendorData = await vendorRes.json();
                displayName = vendorData.vendor?.business_name || displayName;
                avatar = vendorData.vendor?.vendor_logo || avatar;
              }
            } catch (e) {
              console.log("Could not fetch supplier info for MySQL contact");
            }
          }

          contactMap.set(contact.firebase_uid, {
            ...contact,
            displayName: displayName,
            avatar: avatar,
            lastMessage: "",
            lastTs: 0
          });
        }
      }

      for (const thread of threads) {
        const { otherUid, lastMessageSnippet, lastTs } = thread;

        try {
          const userRes = await fetch(`${API}/users/${otherUid}`, {
            headers: { Authorization: `Bearer ${token}` }
          });

          if (!userRes.ok) {
            console.log(`Thread user ${otherUid} not found in database (404)`);
            continue;
          }

          if (userRes.ok) {
            const userData = await userRes.json();
            const user = userData.user;

            if (userIdSet.has(user.id)) {
              const existingContact = contactMap.get(otherUid);
              if (existingContact) {
                existingContact.lastMessage = lastMessageSnippet;
                existingContact.lastTs = lastTs;
              }
              continue;
            }

            let displayName = `${user.first_name} ${user.last_name}`;
            let avatar = user.avatar;

            if (user.role === 1) {
              try {
                const vendorRes = await fetch(`${API}/vendor/public/${user.id}`);
                if (vendorRes.ok) {
                  const vendorData = await vendorRes.json();
                  displayName = vendorData.vendor?.business_name || displayName;
                  avatar = vendorData.vendor?.vendor_logo || avatar;
                }
              } catch (e) {
                console.log("Could not fetch supplier info");
              }
            }

            userIdSet.add(user.id);
            contactMap.set(otherUid, {
              id: user.id,
              firebase_uid: otherUid,
              first_name: user.first_name,
              last_name: user.last_name,
              role: user.role,
              avatar: avatar,
              displayName: displayName,
              lastMessage: lastMessageSnippet,
              lastTs: lastTs
            });
          }
        } catch (e) {
          console.error("Failed to fetch user:", e);
        }
      }

      const finalContacts = Array.from(contactMap.values())
        .sort((a, b) => (b.lastTs || 0) - (a.lastTs || 0));

      setContacts(finalContacts);

    } catch (err) {
      console.error("Failed to load contacts:", err);
    }
  }

  useEffect(() => {
    const toUid = searchParams.get('to');
    const nameOverride = searchParams.get('name');

    if (toUid && !hasAutoOpened.current && meUid.current && !loading) {
      hasAutoOpened.current = true;

      let contact = contacts.find(c => c.firebase_uid === toUid);

      if (contact) {
        // If we have a name override and it differs, update the display name temporarily for this session
        if (nameOverride && contact.displayName !== nameOverride) {
          contact = { ...contact, displayName: nameOverride };
          // Optional: Update contacts state to reflect this change
          setContacts(prev => prev.map(c => c.firebase_uid === toUid ? { ...c, displayName: nameOverride } : c));
        }

        openChat(contact);
        navigate('/chat', { replace: true });
      } else {
        fetchUserAndOpenChat(toUid, nameOverride);
      }
    }
  }, [searchParams, contacts, loading]);

  async function fetchUserAndOpenChat(firebaseUid, nameOverride = null) {
    try {
      const token = localStorage.getItem("solennia_token");

      const res = await fetch(`${API}/users/${firebaseUid}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        console.log(`User ${firebaseUid} not found in database (${res.status})`);
        toast.error("User not found in database");
        navigate('/chat', { replace: true });
        return;
      }

      const json = await res.json();
      const user = json.user;

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
        } catch (e) { }
      }

      const newContact = {
        id: user.id,
        firebase_uid: user.firebase_uid,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        avatar: avatar,
        displayName: nameOverride || displayName
      };

      setContacts(prev => {
        const exists = prev.find(c => c.firebase_uid === firebaseUid);
        if (exists) return prev;
        return [newContact, ...prev];
      });

      openChat(newContact);
      navigate('/chat', { replace: true });

    } catch (err) {
      console.error("Failed to fetch user:", err);
      toast.error("Failed to start conversation");
      navigate('/chat', { replace: true });
    }
  }

  // Mark thread as seen
  function markThreadAsSeen(threadId) {
    try {
      const lastSeenData = localStorage.getItem('chat_last_seen') || '{}';
      const lastSeen = JSON.parse(lastSeenData);
      lastSeen[threadId] = Date.now();
      localStorage.setItem('chat_last_seen', JSON.stringify(lastSeen));
    } catch (e) {
      console.error('Error marking thread as seen:', e);
    }
  }

  // Open chat conversation
  function openChat(contact) {
    if (!meUid.current) {
      toast.error("Chat not initialized");
      return;
    }

    setActive(contact);
    setMessages([]);

    // Unsubscribe from previous conversation
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

      markThreadAsSeen(threadId);

      const unsubscribe = onThreadMessages(threadId, (msg) => {
        setMessages((prev) => {
          const exists = prev.find((m) => m.id === msg.id);
          if (exists) return prev;

          const isValidSender =
            msg.senderUid === meUid.current ||
            msg.senderUid === contact.firebase_uid;

          if (!isValidSender) {
            console.warn('Message from unexpected sender:', msg.senderUid);
            return prev;
          }

          markThreadAsSeen(threadId);

          return [...prev, msg];
        });
      });

      unsubscribeRef.current = unsubscribe;
    });
  }

  // Send message
  async function handleSend() {
    const hasText = input.trim().length > 0;
    if (!hasText || !active) return;

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

    } catch (err) {
      console.error("Send failed:", err);
      toast.error("Failed to send message");
    }
  }

  // Textarea auto-resize
  function autoResize(e) {
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  }

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
      if (threadsUnsubscribeRef.current) {
        threadsUnsubscribeRef.current();
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
      <aside className="chat-sidebar">
        <div className="chat-sidebar-header">
          <span>CONVERSATIONS</span>
        </div>

        <div className="chat-contact-list">
          {contacts.length === 0 ? (
            <div className="empty-state">
              <p style={{ textAlign: 'center', padding: '2rem 1rem', color: '#666', fontSize: '0.875rem' }}>
                {myRole === 0 ? "Visit Suppliers/Venue pages to start chatting." :
                  myRole === 1 ? "Clients will appear when they message you." :
                    "Users will appear when they message you."}
              </p>
            </div>
          ) : (
            contacts.map((contact) => {
              const isActive = active?.firebase_uid === contact.firebase_uid;

              return (
                <button
                  key={contact.firebase_uid}
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
                        <span className="role-badge vendor-badge">SUPPLIER</span>
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

      <main className="chat-main">
        {!active ? (
          <div className="chat-empty-state">
            <div className="empty-icon">💬</div>
            <p>Select a conversation to start messaging</p>
            <p style={{ fontSize: '0.875rem', color: '#888', marginTop: '0.5rem' }}>
              Need help planning? Try our <a href="/ai-booking" style={{ color: '#f59e0b', fontWeight: '600' }}>🤖 AI Assistant</a>
            </p>
          </div>
        ) : (
          <>
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
                    {active.role === 2 ? "Admin" :
                      active.role === 1 ? "Vendor" : "Client"}
                  </div>
                </div>
              </div>
            </div>

            <div className="chat-main-body" ref={messagesRef}>
              {messages.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  color: '#999',
                  padding: '2rem',
                  fontSize: '0.875rem'
                }}>
                  No messages yet. Start the conversation! 👋
                </div>
              ) : (
                messages.map((msg) => {
                  const isMe = msg.senderUid === meUid.current;
                  return (
                    <div key={msg.id} className={`chat-message ${isMe ? "me" : "them"}`}>
                      <div className="message-text">{msg.text}</div>
                      <div className="chat-meta">
                        {formatMessageTime(msg.ts)}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="chat-input-bar">
              <div className="chat-input-row">
                <textarea
                  ref={textareaRef}
                  className="chat-input"
                  rows={1}
                  placeholder="Type a message..."
                  value={input}
                  onChange={(e) => { setInput(e.target.value); autoResize(e); }}
                  onInput={autoResize}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
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
                  <IconSend />
                </button>
              </div>
            </div>
          </>
        )}
      </main>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}