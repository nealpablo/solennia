import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import "../chat.css";
import toast from "../utils/toast";
import { apiPost } from "../utils/api";
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

// ✅ Format message time
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

// ✅ Parse AI response for supplier information and galleries
const parseSupplierInfo = (text) => {
  const suppliers = [];
  
  // Match supplier blocks (bold names followed by details)
  const supplierPattern = /\*\*([^*]+)\*\*\s*\(([^)]+)\)/g;
  let match;
  
  while ((match = supplierPattern.exec(text)) !== null) {
    const name = match[1].trim();
    const category = match[2].trim();
    
    // Extract info after the supplier name
    const startIndex = match.index + match[0].length;
    const nextSupplierMatch = supplierPattern.exec(text);
    const endIndex = nextSupplierMatch ? nextSupplierMatch.index : text.length;
    
    // Reset regex
    supplierPattern.lastIndex = match.index + match[0].length;
    
    const infoBlock = text.substring(startIndex, endIndex);
    
    suppliers.push({
      name,
      category,
      info: infoBlock.trim()
    });
  }
  
  return suppliers;
};

// ✅ AI Assistant Contact
const AI_CONTACT = {
  id: 'ai-assistant',
  firebase_uid: 'ai-assistant',
  displayName: 'Solennia AI Assistant',
  lastMessage: 'Ask me about event planning!',
  isAI: true,
  role: 'ai'
};

export default function Chat() {
  const [contacts, setContacts] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [myRole, setMyRole] = useState(0);
  
  // ✅ AI Chat State
  const [aiMessages, setAiMessages] = useState(() => {
    try {
      const saved = localStorage.getItem('ai_chat_history');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to load AI chat history:', e);
    }
    
    return [{
      id: 'welcome',
      role: 'assistant',
      text: "Hello! 👋 I'm Solennia AI, your event planning assistant.\n\nI can help with:\n• Finding vendors\n• Event planning tips\n• Budget advice\n• Checking availability\n• Creating bookings\n\nHow can I help you today?",
      ts: Date.now()
    }];
  });
  const [aiLoading, setAiLoading] = useState(false);
  
  // ✅ NEW: Image upload state
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const fileInputRef = useRef(null);
  
  // ✅ NEW: Supplier galleries state
  const [supplierGalleries, setSupplierGalleries] = useState({});
  
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const meUid = useRef(null);
  const messagesRef = useRef(null);
  const unsubscribeRef = useRef(null);
  const threadsUnsubscribeRef = useRef(null);
  const hasAutoOpened = useRef(false);
  const textareaRef = useRef(null);

  // ✅ Save AI chat history
  useEffect(() => {
    try {
      localStorage.setItem('ai_chat_history', JSON.stringify(aiMessages));
    } catch (e) {
      console.error('Failed to save AI chat history:', e);
    }
  }, [aiMessages]);

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

  async function loadContacts() {
    const token = localStorage.getItem("solennia_token");
    if (!token) return;

    const threads = await listThreadsForCurrentUser();
    const contactMap = new Map();

    for (const thread of threads) {
      const { otherUid, lastMessageSnippet, lastTs } = thread;
      
      try {
        const userRes = await fetch(`${API}/users/${otherUid}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
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
              console.log("Could not fetch vendor info");
            }
          }
          
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
        console.error('Error fetching contact:', e);
      }
    }

    const sortedContacts = Array.from(contactMap.values())
      .sort((a, b) => (b.lastTs || 0) - (a.lastTs || 0));

    setContacts(sortedContacts);

    const openUidParam = searchParams.get("open");
    if (openUidParam && !hasAutoOpened.current) {
      hasAutoOpened.current = true;
      const foundContact = sortedContacts.find(c => c.firebase_uid === openUidParam);
      if (foundContact) {
        setTimeout(() => openChat(foundContact), 500);
      }
    }
  }

  async function updateContactsFromThreads(threads) {
    const token = localStorage.getItem("solennia_token");
    if (!token) return;

    setContacts(prevContacts => {
      const contactMap = new Map();
      
      for (const contact of prevContacts) {
        if (contact.firebase_uid && !contact.isAI) {
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

  async function fetchAndAddContact(firebaseUid, lastMessage, lastTs) {
    try {
      const token = localStorage.getItem("solennia_token");
      const userRes = await fetch(`${API}/users/${firebaseUid}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
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
            console.log("Could not fetch vendor info");
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
    } catch (e) {
      console.error('Error fetching contact:', e);
    }
  }

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

  function openChat(contact) {
    if (contact.isAI) {
      setActive(contact);
      setMessages([]);
      
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      
      return;
    }

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

  // ✅ NEW: Handle image selection
  const handleImageSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB');
      return;
    }

    setSelectedImage(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  // ✅ NEW: Remove selected image
  const removeImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // ✅ NEW: Fetch supplier gallery
  const fetchSupplierGallery = async (supplierName) => {
    try {
      const token = localStorage.getItem("solennia_token");
      
      // Search for supplier by name
      const response = await fetch(`${API}/vendor/search?q=${encodeURIComponent(supplierName)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.vendors && data.vendors.length > 0) {
          const vendor = data.vendors[0];
          
          // Parse gallery JSON
          let gallery = [];
          if (vendor.gallery) {
            try {
              gallery = JSON.parse(vendor.gallery);
            } catch (e) {
              console.error('Failed to parse gallery:', e);
            }
          }
          
          return {
            vendorId: vendor.id,
            businessName: vendor.business_name,
            gallery: gallery,
            avatar: vendor.vendor_logo,
            category: vendor.category
          };
        }
      }
    } catch (error) {
      console.error('Error fetching supplier gallery:', error);
    }
    
    return null;
  };

  async function handleSend() {
    if ((!input.trim() && !selectedImage) || !active) return;

    if (active.isAI) {
      await handleAiMessage();
      return;
    }

    const threadId = (active.firebase_uid < meUid.current)
      ? `${active.firebase_uid}__${meUid.current}`
      : `${meUid.current}__${active.firebase_uid}`;

    try {
      // TODO: Handle image upload for Firebase chat if needed
      await sendMessageToThread(threadId, { text: input });
      setInput("");
      removeImage();
      
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

  // ✅ IMPROVED: AI Chat Handler with supplier gallery fetching
  async function handleAiMessage() {
    const userMessage = input.trim();
    if (!userMessage && !selectedImage) return;

    let messageText = userMessage;
    
    // If image is selected, add image context
    if (selectedImage) {
      messageText += selectedImage ? ` [Image attached: ${selectedImage.name}]` : '';
    }

    const userMsg = {
      id: 'user-' + Date.now(),
      role: 'user',
      text: messageText,
      image: imagePreview,
      ts: Date.now()
    };

    setAiMessages(prev => [...prev, userMsg]);
    setInput('');
    removeImage();
    setAiLoading(true);

    setTimeout(() => {
      if (messagesRef.current) {
        messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
      }
    }, 100);

    try {
      const history = aiMessages.slice(-10).map(msg => ({
        role: msg.role,
        content: msg.text
      }));

      const response = await apiPost('/ai/chat', {
        message: userMessage,
        history: history
      });

      if (response.success && response.response) {
        const aiResponse = response.response;
        
        // ✅ Parse for supplier information
        const suppliers = parseSupplierInfo(aiResponse);
        
        // ✅ Fetch galleries for mentioned suppliers
        const galleries = {};
        for (const supplier of suppliers) {
          const galleryData = await fetchSupplierGallery(supplier.name);
          if (galleryData) {
            galleries[supplier.name] = galleryData;
          }
        }
        
        setSupplierGalleries(prev => ({ ...prev, ...galleries }));
        
        setAiMessages(prev => [...prev, {
          id: 'assistant-' + Date.now(),
          role: 'assistant',
          text: aiResponse,
          suppliers: suppliers,
          galleries: galleries,
          ts: Date.now()
        }]);
      } else {
        throw new Error(response.error || 'Failed');
      }
    } catch (error) {
      console.error('AI chat error:', error);
      setAiMessages(prev => [...prev, {
        id: 'error-' + Date.now(),
        role: 'assistant',
        text: 'Sorry, I encountered an error. Please try again.',
        ts: Date.now(),
        isError: true
      }]);
      toast.error('Failed to get AI response');
    } finally {
      setAiLoading(false);
      
      setTimeout(() => {
        if (messagesRef.current) {
          messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
        }
      }, 300);
    }
  }

  // ✅ NEW: Handle keyboard shortcuts
  const handleKeyDown = (e) => {
    // Shift+Enter = new line
    if (e.key === 'Enter' && e.shiftKey) {
      return; // Let default behavior happen (new line)
    }
    
    // Enter alone = send
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages, aiMessages]);

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
          <div className="loading-spinner" />
          <p>Loading chat...</p>
        </div>
      </div>
    );
  }

  const displayMessages = active?.isAI ? aiMessages : messages;

  return (
    <div className="chat-shell">
      <aside className="chat-sidebar">
        <div className="chat-sidebar-header">
          <span>CONVERSATIONS</span>
        </div>

        <div className="chat-contact-list">
          {/* ✅ AI Assistant */}
          <button
            onClick={() => openChat(AI_CONTACT)}
            className={`chat-contact ${active?.isAI ? "active" : ""}`}
            style={{ 
              background: active?.isAI ? '#fff8e7' : 'linear-gradient(135deg, #fff9e6, #fff5d6)', 
              borderBottom: '2px solid #f0e6c8' 
            }}
          >
            <div className="chat-contact-avatar" style={{ 
              background: 'linear-gradient(135deg, #f59e0b, #ea580c)', 
              color: 'white', 
              fontSize: '1.2rem' 
            }}>
              ✨
            </div>
            <div className="chat-contact-main">
              <div className="chat-contact-name">
                Solennia AI Assistant
                <span className="role-badge" style={{ 
                  background: 'linear-gradient(135deg, #f59e0b, #ea580c)', 
                  color: 'white', 
                  marginLeft: '0.5rem' 
                }}>AI</span>
              </div>
              <div className="chat-contact-preview">Ask me about event planning!</div>
            </div>
          </button>

          {contacts.length === 0 ? (
            <div className="empty-state">
              <p style={{ textAlign: 'center', padding: '2rem 1rem', color: '#666', fontSize: '0.875rem' }}>
                {myRole === 0 ? "Visit Vendors/Venue pages to start chatting." : 
                 myRole === 1 ? "Clients will appear when they message you." : 
                 "Users will appear when they message you."}
              </p>
            </div>
          ) : (
            contacts.map((contact) => {
              const isActive = active?.firebase_uid === contact.firebase_uid && !active?.isAI;

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

      <main className="chat-main">
        {!active ? (
          <div className="chat-empty-state">
            <div className="empty-icon">💬</div>
            <p>Select a conversation to start messaging</p>
            <p style={{ fontSize: '0.875rem', color: '#888', marginTop: '0.5rem' }}>
              Try our AI Assistant for event planning help!
            </p>
          </div>
        ) : (
          <>
            <div className="chat-main-header" style={active.isAI ? { 
              background: 'linear-gradient(135deg, #fef3c7, #fde68a)' 
            } : {}}>
              <div className="header-user-info">
                {active.isAI ? (
                  <div className="header-avatar" style={{ 
                    background: 'linear-gradient(135deg, #f59e0b, #ea580c)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    color: 'white', 
                    fontSize: '1.5rem' 
                  }}>✨</div>
                ) : active.avatar ? (
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
                    {active.isAI ? "AI Event Planning Assistant" : 
                     active.role === 2 ? "Admin" : 
                     active.role === 1 ? "Vendor" : "Client"}
                  </div>
                </div>
              </div>
            </div>

            <div className="chat-main-body" ref={messagesRef}>
              {displayMessages.length === 0 ? (
                <div style={{ 
                  textAlign: 'center', 
                  color: '#999', 
                  padding: '2rem',
                  fontSize: '0.875rem'
                }}>
                  No messages yet. Start the conversation! 👋
                </div>
              ) : (
                displayMessages.map((msg) => {
                  const isMe = active.isAI ? msg.role === 'user' : msg.senderUid === meUid.current;
                  return (
                    <div key={msg.id} className={`chat-message ${isMe ? "me" : "them"}`}>
                      {/* ✅ Show image if present */}
                      {msg.image && (
                        <div className="message-image">
                          <img src={msg.image} alt="Attached" style={{
                            maxWidth: '100%',
                            borderRadius: '0.5rem',
                            marginBottom: '0.5rem'
                          }} />
                        </div>
                      )}
                      
                      <div className="message-text" style={msg.isError ? { color: '#dc2626' } : {}}>
                        {msg.text}
                      </div>
                      
                      {/* ✅ NEW: Display supplier galleries */}
                      {msg.galleries && Object.keys(msg.galleries).length > 0 && (
                        <div className="supplier-galleries" style={{
                          marginTop: '1rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '1rem'
                        }}>
                          {Object.values(msg.galleries).map((gallery, idx) => (
                            <div key={idx} className="supplier-gallery-card" style={{
                              background: 'rgba(0,0,0,0.03)',
                              padding: '0.75rem',
                              borderRadius: '0.5rem',
                              border: '1px solid rgba(0,0,0,0.1)'
                            }}>
                              <div style={{
                                fontWeight: 600,
                                marginBottom: '0.5rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                color: '#1c1b1a'
                              }}>
                                {gallery.avatar && (
                                  <img src={gallery.avatar} alt="" style={{
                                    width: '24px',
                                    height: '24px',
                                    borderRadius: '50%',
                                    objectFit: 'cover'
                                  }} />
                                )}
                                {gallery.businessName} Gallery
                              </div>
                              
                              {gallery.gallery && gallery.gallery.length > 0 ? (
                                <div style={{
                                  display: 'grid',
                                  gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
                                  gap: '0.5rem',
                                  marginTop: '0.5rem'
                                }}>
                                  {gallery.gallery.slice(0, 6).map((img, imgIdx) => (
                                    <div key={imgIdx} style={{
                                      aspectRatio: '1',
                                      borderRadius: '0.375rem',
                                      overflow: 'hidden',
                                      border: '2px solid white',
                                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                                    }}>
                                      <img 
                                        src={img} 
                                        alt={`${gallery.businessName} ${imgIdx + 1}`}
                                        style={{
                                          width: '100%',
                                          height: '100%',
                                          objectFit: 'cover'
                                        }}
                                        onError={(e) => {
                                          e.target.style.display = 'none';
                                        }}
                                      />
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div style={{
                                  fontSize: '0.75rem',
                                  color: '#666',
                                  fontStyle: 'italic'
                                }}>
                                  No gallery images available
                                </div>
                              )}
                              
                              {gallery.gallery && gallery.gallery.length > 6 && (
                                <div style={{
                                  fontSize: '0.75rem',
                                  color: '#666',
                                  marginTop: '0.5rem',
                                  textAlign: 'center'
                                }}>
                                  +{gallery.gallery.length - 6} more images
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      
                      <div className="chat-meta">
                        {formatMessageTime(msg.ts)}
                      </div>
                    </div>
                  );
                })
              )}
              
              {/* ✅ FIXED: Thinking animation */}
              {aiLoading && active?.isAI && (
                <div className="chat-message them">
                  <div className="message-text thinking-animation">
                    <span className="thinking-dots">
                      <span></span>
                      <span></span>
                      <span></span>
                    </span>
                    <span style={{ color: '#888', fontSize: '0.875rem', marginLeft: '0.5rem' }}>
                      Thinking...
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="chat-input-bar">
              {/* ✅ NEW: Image preview */}
              {imagePreview && (
                <div className="image-preview" style={{
                  position: 'absolute',
                  bottom: '100%',
                  left: '1rem',
                  marginBottom: '0.5rem',
                  background: 'white',
                  padding: '0.5rem',
                  borderRadius: '0.5rem',
                  border: '2px solid #d4c9b2',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}>
                  <div style={{ position: 'relative' }}>
                    <img 
                      src={imagePreview} 
                      alt="Preview" 
                      style={{
                        maxWidth: '150px',
                        maxHeight: '150px',
                        borderRadius: '0.375rem',
                        display: 'block'
                      }}
                    />
                    <button
                      onClick={removeImage}
                      style={{
                        position: 'absolute',
                        top: '-8px',
                        right: '-8px',
                        background: '#dc2626',
                        color: 'white',
                        border: 'none',
                        borderRadius: '50%',
                        width: '24px',
                        height: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        fontWeight: 'bold'
                      }}
                    >
                      ×
                    </button>
                  </div>
                </div>
              )}
              
              {/* ✅ NEW: Image upload button */}
              {active.isAI && (
                <div style={{ position: 'relative' }}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    style={{ display: 'none' }}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="image-upload-btn"
                    title="Attach image"
                    style={{
                      background: 'transparent',
                      border: '2px solid #d4c9b2',
                      borderRadius: '50%',
                      width: '40px',
                      height: '40px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      fontSize: '1.25rem'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = '#f5f5f5'}
                    onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    📎
                  </button>
                </div>
              )}
              
              {/* ✅ IMPROVED: Textarea instead of input */}
              <textarea
                ref={textareaRef}
                className="chat-input"
                placeholder={active.isAI ? "Ask me anything about event planning... (Shift+Enter for new line)" : "Type a message..."}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  // Auto-resize
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                }}
                onKeyDown={handleKeyDown}
                disabled={aiLoading}
                rows={1}
                style={{
                  resize: 'none',
                  minHeight: '44px',
                  maxHeight: '120px',
                  overflow: 'auto'
                }}
              />
              <button
                className="chat-send-btn"
                onClick={handleSend}
                disabled={(!input.trim() && !selectedImage) || aiLoading}
                style={active.isAI ? { 
                  background: aiLoading ? '#ccc' : 'linear-gradient(135deg, #f59e0b, #ea580c)' 
                } : {}}
              >
                {aiLoading ? '...' : '➤'}
              </button>
            </div>
          </>
        )}
      </main>

      <style>{`
        .loading-spinner {
          width: 3rem;
          height: 3rem;
          border: 4px solid #e8ddae;
          border-top-color: transparent;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 1rem;
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        
        .thinking-animation {
          display: flex;
          align-items: center;
        }
        
        .thinking-dots {
          display: flex;
          gap: 4px;
        }
        
        .thinking-dots span {
          width: 8px;
          height: 8px;
          background: #f59e0b;
          borderRadius: 50%;
          animation: bounce 1.4s infinite ease-in-out both;
        }
        
        .thinking-dots span:nth-child(1) {
          animation-delay: -0.32s;
        }
        
        .thinking-dots span:nth-child(2) {
          animation-delay: -0.16s;
        }
        
        @keyframes bounce {
          0%, 80%, 100% { 
            transform: scale(0);
            opacity: 0.5;
          }
          40% { 
            transform: scale(1);
            opacity: 1;
          }
        }
        
        .chat-input {
          font-family: inherit;
          line-height: 1.5;
        }
      `}</style>
    </div>
  );
}