// src/partials/ChatDropdown.jsx - Message preview dropdown for header
import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { listThreadsForCurrentUser, initChat, onAllThreadsUpdate } from "../firebase-chat";
import "../chat.css";

const API = "/api";

export default function ChatDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0); // ✅ Track unread messages
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    // Close when other dropdowns open
    function handleCloseOthers(event) {
      if (event.detail !== 'chat') {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      window.addEventListener("closeOtherDropdowns", handleCloseOthers);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        window.removeEventListener("closeOtherDropdowns", handleCloseOthers);
      };
    }
  }, [isOpen]);

  // Load conversations when dropdown opens
  useEffect(() => {
    if (isOpen) {
      loadConversations();
    }
  }, [isOpen]);
  
  // ✅ NEW: Set up real-time listener for thread updates (for unread count)
  useEffect(() => {
    let unsubscribe = null;
    
    async function setupListener() {
      try {
        const token = localStorage.getItem("solennia_token");
        if (!token) return;
        
        await initChat();
        
        unsubscribe = onAllThreadsUpdate(async (threads) => {
          // Enrich with user data for unread count calculation
          const enriched = await Promise.all(
            threads.map(async (thread) => {
              try {
                const res = await fetch(`${API}/users/${thread.otherUid}`, {
                  headers: { Authorization: `Bearer ${token}` }
                });
                
                if (res.ok) {
                  const json = await res.json();
                  const user = json.user;
                  
                  let displayName = `${user.first_name} ${user.last_name}`;
                  
                  if (user.role === 1) {
                    try {
                      const vendorRes = await fetch(`${API}/vendor/public/${user.id}`);
                      if (vendorRes.ok) {
                        const vendorJson = await vendorRes.json();
                        displayName = vendorJson.vendor?.business_name || displayName;
                      }
                    } catch (e) {}
                  }
                  
                  return {
                    ...thread,
                    displayName
                  };
                }
              } catch (e) {}
              return thread;
            })
          );
          
          calculateUnreadCount(enriched.filter(t => t.displayName));
        });
      } catch (err) {
        console.error('Error setting up thread listener:', err);
      }
    }
    
    setupListener();
    
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  async function loadConversations() {
    setLoading(true);
    try {
      const token = localStorage.getItem("solennia_token");
      if (!token) {
        setLoading(false);
        return;
      }

      // Initialize Firebase chat
      await initChat();
      
      // Get threads
      const threads = await listThreadsForCurrentUser();
      
      // Enrich with user data
      const enriched = await Promise.all(
        threads.map(async (thread) => {
          try {
            // Get user by firebase UID
            const res = await fetch(`${API}/users/${thread.otherUid}`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            
            if (res.ok) {
              const json = await res.json();
              const user = json.user;
              
              let displayName = `${user.first_name} ${user.last_name}`;
              let avatar = user.avatar;
              
              // If vendor, get business name
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
              
              return {
                ...thread,
                displayName,
                avatar,
                role: user.role
              };
            }
          } catch (e) {
            console.error("Error fetching user data:", e);
          }
          return thread;
        })
      );

      const filtered = enriched.filter(c => c.displayName);
      setConversations(filtered);
      
      // ✅ Calculate unread count
      calculateUnreadCount(filtered);
      
    } catch (err) {
      console.error("Failed to load conversations:", err);
    } finally {
      setLoading(false);
    }
  }

  // ✅ NEW: Calculate unread messages based on last seen timestamps
  function calculateUnreadCount(convs) {
    try {
      const lastSeenData = localStorage.getItem('chat_last_seen') || '{}';
      const lastSeen = JSON.parse(lastSeenData);
      
      let count = 0;
      for (const conv of convs) {
        const threadLastSeen = lastSeen[conv.threadId] || 0;
        // If conversation has a message newer than last seen, count as unread
        if (conv.lastTs && conv.lastTs > threadLastSeen) {
          count++;
        }
      }
      
      setUnreadCount(count);
    } catch (e) {
      console.error('Error calculating unread count:', e);
      setUnreadCount(0);
    }
  }

  // Format timestamp
  const formatTime = (ts) => {
    if (!ts) return "";
    const date = new Date(ts);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;
    return date.toLocaleDateString();
  };

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
    
    // Tell Header to close notification if open
    if (!isOpen) {
      window.dispatchEvent(new CustomEvent('closeOtherDropdowns', { detail: 'chat' }));
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Chat Icon Button */}
      <button
        onClick={toggleDropdown}
        className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-black/5"
        aria-label="Messages"
      >
        <svg
          className="w-5 h-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
        >
          <path d="M21 15a4 4 0 0 1-4 4H7l-4 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
        </svg>
        
        {/* Unread Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="chat-dropdown">
          <div className="chat-dropdown-header">Messages</div>

          <div className="chat-dropdown-body">
            {loading ? (
              <div className="chat-dropdown-empty">
                <div style={{
                  width: '2rem',
                  height: '2rem',
                  border: '4px solid #e8ddae',
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  margin: '0 auto'
                }} />
              </div>
            ) : conversations.length === 0 ? (
              <div className="chat-dropdown-empty">
                <svg className="w-16 h-16 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <p>No messages yet</p>
                <p style={{ fontSize: '0.75rem', marginTop: '0.5rem', color: '#999' }}>
                  Visit the Vendors page to start chatting
                </p>
              </div>
            ) : (
              conversations.map((conv) => (
                <Link
                  key={conv.threadId}
                  to="/chat"
                  onClick={() => setIsOpen(false)}
                  className="chat-dropdown-item"
                >
                  <div className="chat-dropdown-avatar">
                    {conv.avatar ? (
                      <img src={conv.avatar} alt={conv.displayName} className="w-full h-full object-cover rounded-full" />
                    ) : (
                      conv.displayName?.charAt(0)?.toUpperCase() || "?"
                    )}
                  </div>
                  
                  <div className="chat-dropdown-content">
                    <div className="chat-dropdown-name">
                      {conv.displayName || "Unknown User"}
                      {conv.role === 2 && (
                        <span className="role-badge admin-badge">ADMIN</span>
                      )}
                      {conv.role === 1 && (
                        <span className="role-badge vendor-badge">VENDOR</span>
                      )}
                    </div>
                    <div className="chat-dropdown-message">
                      {conv.lastMessageSnippet || "No messages yet"}
                    </div>
                    <div className="chat-dropdown-time">
                      {formatTime(conv.lastTs)}
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>

          <div className="chat-dropdown-footer">
            <Link to="/chat" onClick={() => setIsOpen(false)}>
              See All in Messenger
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}