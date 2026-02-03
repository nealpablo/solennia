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

//  Format message time in user's local timezone with context
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

// ✅ Clean SVG icons — no emoji rendering issues
const IconPaperclip = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.44 11.05l-9.19 9.19a4.5 4.5 0 0 1-6.36-6.36l9.19-9.19a3 3 0 0 1 4.24 4.24l-9.2 9.19a1.5 1.5 0 0 1-2.12-2.12l8.49-8.48"/>
  </svg>
);

const IconX = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M18 6L6 18M6 6l12 12"/>
  </svg>
);

const IconSend = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"/>
    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
);

// ✅ AI Assistant Contact Object
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
  
  // ✅ AI Chat State - Initially empty, will load after user ID is known
  const [aiMessages, setAiMessages] = useState([{
    id: 'welcome',
    role: 'assistant',
    text: "Hello! 👋 I'm Solennia AI, your event planning assistant.\n\nI can help with:\n• Finding vendors\n• Event planning tips\n• Budget advice\n• Creating bookings\n\nHow can I help you today?",
    ts: Date.now()
  }]);
  const [aiLoading, setAiLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);

  // ✅ Recommendation Form State
  const [showRecForm, setShowRecForm] = useState(false);
  const [recForm, setRecForm] = useState({
    event_type: '',
    event_date: '',
    location: '',
    budget: '',
    guests: '',
    category: '',
    requirements: ''
  });
  const [categories] = useState([
    'Photography & Videography',
    'Catering',
    'Venue',
    'Coordination & Hosting',
    'Decoration',
    'Entertainment',
    'Others'
  ]);
  const [recLoading, setRecLoading] = useState(false);

  // ✅ Image upload state
  const [imagePreview, setImagePreview] = useState(null);
  const fileInputRef = useRef(null);
  
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const meUid = useRef(null);
  const messagesRef = useRef(null);
  const unsubscribeRef = useRef(null);
  const threadsUnsubscribeRef = useRef(null); 
  const hasAutoOpened = useRef(false);
  const hasProcessedAiMessage = useRef(false);
  const textareaRef = useRef(null);

  // ✅ Save AI chat history to localStorage with user-specific key
  useEffect(() => {
    if (!currentUserId) return; // Don't save if no user ID yet
    
    try {
      const key = `ai_chat_history_${currentUserId}`;
      localStorage.setItem(key, JSON.stringify(aiMessages));
    } catch (e) {
      console.error('Failed to save AI chat history:', e);
    }
  }, [aiMessages, currentUserId]);

  // ✅ Load AI chat history when user ID changes
  useEffect(() => {
    if (!meUid.current) return;
    
    const userId = meUid.current;
    setCurrentUserId(userId);
    
    // Load user-specific AI chat history
    try {
      const key = `ai_chat_history_${userId}`;
      const saved = localStorage.getItem(key);
      
      if (saved) {
        const parsed = JSON.parse(saved);
        setAiMessages(parsed);
      } else {
        // No saved history, use welcome message
        setAiMessages([{
          id: 'welcome',
          role: 'assistant',
          text: "Hello! 👋 I'm Solennia AI, your event planning assistant.\n\nI can help with:\n• Finding vendors\n• Event planning tips\n• Budget advice\n• Creating bookings\n\nHow can I help you today?",
          ts: Date.now()
        }]);
      }
    } catch (e) {
      console.error('Failed to load AI chat history:', e);
      // On error, reset to welcome message
      setAiMessages([{
        id: 'welcome',
        role: 'assistant',
        text: "Hello! 👋 I'm Solennia AI, your event planning assistant.\n\nI can help with:\n• Finding vendors\n• Event planning tips\n• Budget advice\n• Creating bookings\n\nHow can I help you today?",
        ts: Date.now()
      }]);
    }
  }, [loading]); // Run when loading completes (when meUid is set)

  // ✅ Handle ai_message from URL (from HomePage search)
  useEffect(() => {
    const aiMessage = searchParams.get('ai_message');
    if (aiMessage && !hasProcessedAiMessage.current && !loading) {
      hasProcessedAiMessage.current = true;
      // Auto-open AI chat
      setActive(AI_CONTACT);
      // Clear the URL param
      searchParams.delete('ai_message');
      setSearchParams(searchParams, { replace: true });
      // Send the message after a short delay
      setTimeout(() => {
        sendAIMessageDirect(aiMessage);
      }, 500);
    }
  }, [searchParams, loading]);

  // ✅ Direct AI message sender (for URL param messages)
  async function sendAIMessageDirect(message) {
    const userMsg = {
      id: 'user-' + Date.now(),
      role: 'user',
      text: message,
      ts: Date.now()
    };
    setAiMessages(prev => [...prev, userMsg]);
    setAiLoading(true);

    try {
      const history = aiMessages.slice(-10).map(msg => ({
        role: msg.role,
        content: msg.text
      }));

      const response = await apiPost('/ai/chat', {
        message: message,
        history: history
      });

      if (response.success && response.response) {
        setAiMessages(prev => [...prev, {
          id: 'assistant-' + Date.now(),
          role: 'assistant',
          text: response.response,
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
    }
  }

  // ✅ Get Recommendations from form
  async function handleGetRecommendations(e) {
    e.preventDefault();
    if (!recForm.event_type) {
      toast.error('Please select an event type');
      return;
    }

    setRecLoading(true);

    try {
      const response = await apiPost('/ai/recommendations', recForm);

      if (response.success) {
        let recMessage = `🎯 **Vendor Recommendations for your ${recForm.event_type}**\n\n`;
        
        if (response.summary) {
          recMessage += response.summary + '\n\n';
        }
        
        if (response.recommendations?.length > 0) {
          response.recommendations.forEach((rec, idx) => {
            recMessage += `**${idx + 1}. ${rec.business_name || rec.vendor_name}** (Match: ${rec.match_score}%)\n`;
            if (rec.highlights) recMessage += `   ${rec.highlights}\n`;
            if (rec.reasons?.length > 0) {
              recMessage += `   ✓ ${rec.reasons.slice(0, 2).join('\n   ✓ ')}\n`;
            }
            recMessage += '\n';
          });
        } else {
          recMessage += 'No vendors found matching your criteria. Try broadening your search.';
        }

        if (response.tips?.length > 0) {
          recMessage += '\n💡 **Tips:**\n';
          response.tips.forEach(tip => {
            recMessage += `• ${tip}\n`;
          });
        }

        setAiMessages(prev => [...prev, {
          id: 'rec-' + Date.now(),
          role: 'assistant',
          text: recMessage,
          ts: Date.now()
        }]);

        setShowRecForm(false);
        toast.success('Recommendations generated!');
      } else {
        throw new Error(response.error);
      }
    } catch (error) {
      toast.error('Failed to get recommendations');
    } finally {
      setRecLoading(false);
    }
  }

  // ✅ Clear AI Chat History
  function clearAIChat() {
    setAiMessages([{
      id: 'welcome',
      role: 'assistant',
      text: "Hello! 👋 I'm Solennia AI, your event planning assistant.\n\nI can help with:\n• Finding vendors\n• Event planning tips\n• Budget advice\n• Creating bookings\n\nHow can I help you today?",
      ts: Date.now()
    }]);
    localStorage.removeItem('ai_chat_history');
    toast.success('Chat cleared');
  }

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
        
        //  Set up real-time listener for thread updates
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

  //  Fetch user info and add to contacts
  async function fetchAndAddContact(firebaseUid, lastMessage, lastTs) {
    try {
      const token = localStorage.getItem("solennia_token");
      const userRes = await fetch(`${API}/users/${firebaseUid}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!userRes.ok) {
        // User not found or error - silently skip, don't show error
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

      // Use Map with firebase_uid as key to prevent duplicates
      const contactMap = new Map();
      const userIdSet = new Set();

      for (const contact of mysqlContacts) {
        if (contact.firebase_uid && contact.id) {
          userIdSet.add(contact.id);
          
          let displayName = `${contact.first_name} ${contact.last_name}`;
          let avatar = contact.avatar;
          
          // If vendor, fetch business name even for MySQL contacts
          if (contact.role === 1) {
            try {
              const vendorRes = await fetch(`${API}/vendor/public/${contact.id}`);
              if (vendorRes.ok) {
                const vendorData = await vendorRes.json();
                displayName = vendorData.vendor?.business_name || displayName;
                avatar = vendorData.vendor?.vendor_logo || avatar;
              }
            } catch (e) {
              console.log("Could not fetch vendor info for MySQL contact");
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
        
        //  Always fetch user info to get latest data and vendor info
        try {
          const userRes = await fetch(`${API}/users/${otherUid}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          if (!userRes.ok) {
            // User not found - silently skip
            console.log(`Thread user ${otherUid} not found in database (404)`);
            continue;
          }
          
          if (userRes.ok) {
            const userData = await userRes.json();
            const user = userData.user;
            
            // Skip if this user ID was already added from MySQL
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
                console.log("Could not fetch vendor info");
              }
            }
            
            // Set/update contact with complete info including vendor data
            userIdSet.add(user.id); // Track this user ID
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
    
    if (toUid && !hasAutoOpened.current && meUid.current && !loading) {
      hasAutoOpened.current = true;
      
      let contact = contacts.find(c => c.firebase_uid === toUid);
      
      if (contact) {
        openChat(contact);
        navigate('/chat', { replace: true });
      } else {
        fetchUserAndOpenChat(toUid);
      }
    }
  }, [searchParams, contacts, loading]);

  async function fetchUserAndOpenChat(firebaseUid) {
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
        } catch (e) {}
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
      
      //  Check for duplicates before adding
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

  // Mark thread as seen (update last seen timestamp)
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

  // Properly unsubscribe from old messages when switching contacts
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

      // Store the actual unsubscribe function and filter messages
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
          
          //  Mark thread as seen when new message arrives in active conversation
          markThreadAsSeen(threadId);
          
          return [...prev, msg];
        });
      });

      //  Store the real unsubscribe function (not empty function!)
      unsubscribeRef.current = unsubscribe;
    });
  }

  // ✅ Image upload handlers
  function handleImageSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
  }

  function removeImage() {
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  // ✅ FIXED: allows send when there is an image even if text is empty
  async function handleSend() {
    const hasText = input.trim().length > 0;
    const hasImage = !!imagePreview;
    if ((!hasText && !hasImage) || !active) return;

    if (active.isAI) {
      await handleAiMessage();
      return;
    }

    // Regular Firebase message
    const threadId = (active.firebase_uid < meUid.current)
      ? `${active.firebase_uid}__${meUid.current}`
      : `${meUid.current}__${active.firebase_uid}`;

    try {
      await sendMessageToThread(threadId, { text: input });
      setInput("");
      removeImage();
      
      setTimeout(() => {
        if (messagesRef.current) {
          messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
        }
      }, 100);
      
      //  Real-time listener will update contacts automatically
      
    } catch (err) {
      console.error("Send failed:", err);
      toast.error("Failed to send message");
    }
  }

  // ✅ FIXED: AI message handler — captures image, attaches it to the message object
  async function handleAiMessage() {
    const userMessage = input.trim();
    const capturedImage = imagePreview; // grab before clearing

    if (!userMessage && !capturedImage) return;

    const userMsg = {
      id: 'user-' + Date.now(),
      role: 'user',
      text: userMessage || '',
      image: capturedImage || null,
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
        message: userMessage || (capturedImage ? '[User sent an image]' : ''),
        history: history
      });

      if (response.success && response.response) {
        setAiMessages(prev => [...prev, {
          id: 'assistant-' + Date.now(),
          role: 'assistant',
          text: response.response,
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
      }, 200);
    }
  }

  // ✅ Textarea auto-resize helper
  function autoResize(e) {
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  }

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages, aiMessages, imagePreview]);

  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
      // Cleanup threads listener
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

  const displayMessages = active?.isAI ? aiMessages : messages;

  return (
    <div className="chat-shell">
      <aside className="chat-sidebar">
        <div className="chat-sidebar-header">
          <span>CONVERSATIONS</span>
        </div>

        <div className="chat-contact-list">
          {/* ✅ AI Assistant - Always show first */}
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
              
              {/* ✅ AI Action Buttons */}
              {active.isAI && (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => setShowRecForm(!showRecForm)}
                    style={{
                      padding: '0.5rem 1rem',
                      background: showRecForm ? '#f59e0b' : 'white',
                      color: showRecForm ? 'white' : '#f59e0b',
                      border: '1px solid #f59e0b',
                      borderRadius: '0.5rem',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    🎯 Get Recommendations
                  </button>
                  <button
                    onClick={clearAIChat}
                    style={{
                      padding: '0.5rem 1rem',
                      background: 'white',
                      color: '#666',
                      border: '1px solid #ddd',
                      borderRadius: '0.5rem',
                      fontSize: '0.75rem',
                      cursor: 'pointer'
                    }}
                  >
                    🗑️ Clear
                  </button>
                </div>
              )}
            </div>

            {/* ✅ Recommendation Form */}
            {showRecForm && active.isAI && (
              <div style={{ padding: '1rem', background: '#fef9e7', borderBottom: '1px solid #f0e6c8' }}>
                <h4 style={{ marginBottom: '1rem', color: '#92400e', fontWeight: '600' }}>🎯 Get Vendor Recommendations</h4>
                <form onSubmit={handleGetRecommendations} style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: '#666', display: 'block', marginBottom: '0.25rem' }}>Event Type *</label>
                    <select
                      value={recForm.event_type}
                      onChange={(e) => setRecForm({ ...recForm, event_type: e.target.value })}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '0.375rem', fontSize: '0.875rem' }}
                      required
                    >
                      <option value="">Select...</option>
                      <option value="Wedding">Wedding</option>
                      <option value="Birthday">Birthday</option>
                      <option value="Corporate">Corporate Event</option>
                      <option value="Debut">Debut</option>
                      <option value="Anniversary">Anniversary</option>
                      <option value="Baptism">Baptism</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  
                  <div>
                    <label style={{ fontSize: '0.75rem', color: '#666', display: 'block', marginBottom: '0.25rem' }}>Event Date</label>
                    <input
                      type="date"
                      value={recForm.event_date}
                      onChange={(e) => setRecForm({ ...recForm, event_date: e.target.value })}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '0.375rem', fontSize: '0.875rem' }}
                    />
                  </div>
                  
                  <div>
                    <label style={{ fontSize: '0.75rem', color: '#666', display: 'block', marginBottom: '0.25rem' }}>Location</label>
                    <input
                      type="text"
                      placeholder="e.g., Manila"
                      value={recForm.location}
                      onChange={(e) => setRecForm({ ...recForm, location: e.target.value })}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '0.375rem', fontSize: '0.875rem' }}
                    />
                  </div>
                  
                  <div>
                    <label style={{ fontSize: '0.75rem', color: '#666', display: 'block', marginBottom: '0.25rem' }}>Budget Range</label>
                    <select
                      value={recForm.budget}
                      onChange={(e) => setRecForm({ ...recForm, budget: e.target.value })}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '0.375rem', fontSize: '0.875rem' }}
                    >
                      <option value="">Select...</option>
                      <option value="Under ₱50,000">Under ₱50,000</option>
                      <option value="₱50,000 - ₱100,000">₱50,000 - ₱100,000</option>
                      <option value="₱100,000 - ₱250,000">₱100,000 - ₱250,000</option>
                      <option value="₱250,000 - ₱500,000">₱250,000 - ₱500,000</option>
                      <option value="Over ₱500,000">Over ₱500,000</option>
                    </select>
                  </div>
                  
                  <div>
                    <label style={{ fontSize: '0.75rem', color: '#666', display: 'block', marginBottom: '0.25rem' }}>Number of Guests</label>
                    <input
                      type="number"
                      placeholder="e.g., 100"
                      value={recForm.guests}
                      onChange={(e) => setRecForm({ ...recForm, guests: e.target.value })}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '0.375rem', fontSize: '0.875rem' }}
                    />
                  </div>
                  
                  <div>
                    <label style={{ fontSize: '0.75rem', color: '#666', display: 'block', marginBottom: '0.25rem' }}>Vendor Category</label>
                    <select
                      value={recForm.category}
                      onChange={(e) => setRecForm({ ...recForm, category: e.target.value })}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '0.375rem', fontSize: '0.875rem' }}
                    >
                      <option value="">Any category</option>
                      {categories.map((cat, idx) => (
                        <option key={idx} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div style={{ gridColumn: 'span 2', display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => setShowRecForm(false)}
                      style={{ flex: 1, padding: '0.5rem', background: '#f3f4f6', border: 'none', borderRadius: '0.375rem', cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={recLoading}
                      style={{
                        flex: 1, padding: '0.5rem',
                        background: recLoading ? '#ccc' : 'linear-gradient(135deg, #f59e0b, #ea580c)',
                        color: 'white', border: 'none', borderRadius: '0.375rem',
                        fontWeight: '600', cursor: recLoading ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {recLoading ? 'Finding...' : 'Get Recommendations'}
                    </button>
                  </div>
                </form>
              </div>
            )}

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
                      {/* ✅ Render attached image if present */}
                      {msg.image && (
                        <div className="message-image-wrapper">
                          <img src={msg.image} alt="attachment" className="message-image" />
                        </div>
                      )}
                      {/* Only render text block when there is actual text */}
                      {msg.text && (
                        <div className="message-text" style={msg.isError ? { color: '#dc2626' } : {}}>
                          {msg.text}
                        </div>
                      )}
                      <div className="chat-meta">
                        {formatMessageTime(msg.ts)}
                      </div>
                    </div>
                  );
                })
              )}
              
              {/* ✅ Thinking indicator */}
              {aiLoading && active?.isAI && (
                <div className="chat-message them">
                  <div className="thinking-row">
                    <span className="thinking-dot"></span>
                    <span className="thinking-dot"></span>
                    <span className="thinking-dot"></span>
                    <span className="thinking-label">Thinking...</span>
                  </div>
                </div>
              )}
            </div>

            {/* ✅ Input area */}
            <div className="chat-input-bar">
              {/* Image preview strip sits inside the bar, above the textarea row */}
              {imagePreview && (
                <div className="image-preview-strip">
                  <div className="image-preview-thumb">
                    <img src={imagePreview} alt="preview" />
                    <button className="image-preview-remove" onClick={removeImage} type="button">
                      <IconX />
                    </button>
                  </div>
                </div>
              )}

              <div className="chat-input-row">
                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  style={{ display: 'none' }}
                />

                {/* Paperclip button — only in AI chat */}
                {active.isAI && (
                  <button
                    className="attach-btn"
                    onClick={() => fileInputRef.current?.click()}
                    type="button"
                    title="Attach image"
                  >
                    <IconPaperclip />
                  </button>
                )}

                {/* ✅ FIXED: textarea replaces input so Shift+Enter works */}
                <textarea
                  ref={textareaRef}
                  className="chat-input"
                  rows={1}
                  placeholder={active.isAI ? "Ask me anything about event planning..." : "Type a message..."}
                  value={input}
                  onChange={(e) => { setInput(e.target.value); autoResize(e); }}
                  onInput={autoResize}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                    // Shift+Enter: do nothing extra, browser inserts newline naturally
                  }}
                  disabled={aiLoading}
                />

                {/* Send button */}
                <button
                  className="chat-send-btn"
                  onClick={handleSend}
                  disabled={(!input.trim() && !imagePreview) || aiLoading}
                  style={active.isAI ? { 
                    background: ((!input.trim() && !imagePreview) || aiLoading) 
                      ? undefined 
                      : 'linear-gradient(135deg, #f59e0b, #ea580c)' 
                  } : {}}
                >
                  {aiLoading ? '...' : <IconSend />}
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
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-5px); }
        }
      `}</style>
    </div>
  );
}