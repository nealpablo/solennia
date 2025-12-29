import React, { useState, useEffect, useRef } from "react";

const API = 
  import.meta.env.VITE_API_BASE || 
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD 
    ? "https://solennia.up.railway.app/api" : "/api");

export default function NotificationDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
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
      if (event.detail !== 'notification') {
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

  // Load notifications when dropdown opens
  useEffect(() => {
    if (isOpen) {
      loadNotifications();
    }
  }, [isOpen]);
  
  // Auto-refresh notifications every 10 seconds
  useEffect(() => {
    loadNotifications();
    
    const interval = setInterval(() => {
      loadNotifications();
    }, 10000);
    
    return () => clearInterval(interval);
  }, []);

  async function loadNotifications() {
    try {
      const token = localStorage.getItem("solennia_token");
      if (!token) {
        setLoading(false);
        return;
      }

      setLoading(true);
      const res = await fetch(`${API}/notifications`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.ok) {
        const json = await res.json();
        setNotifications(json.notifications || []);
        
        const unread = json.notifications.filter(n => !n.read).length;
        setUnreadCount(unread);
      }
    } catch (err) {
      console.error("Failed to load notifications:", err);
    } finally {
      setLoading(false);
    }
  }

  async function markAsRead(notificationId) {
    try {
      const token = localStorage.getItem("solennia_token");
      if (!token) return;

      await fetch(`${API}/notifications/${notificationId}/read`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setNotifications(notifications.map(n => 
        n.id === notificationId ? { ...n, read: true } : n
      ));
      setUnreadCount(Math.max(0, unreadCount - 1));
    } catch (err) {
      console.error("Failed to mark as read:", err);
    }
  }

  const formatTime = (ts) => {
    if (!ts) return "";
    
    // Handle MySQL datetime format (YYYY-MM-DD HH:MM:SS)
    // Replace space with 'T' to make it ISO-compatible
    const isoTimestamp = ts.replace(' ', 'T');
    const date = new Date(isoTimestamp);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      console.error('Invalid date:', ts);
      return "";
    }
    
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
    
    if (!isOpen) {
      window.dispatchEvent(new CustomEvent('closeOtherDropdowns', { detail: 'notification' }));
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={toggleDropdown}
        className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-black/5"
        aria-label="Notifications"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5" />
          <path d="M9 17a3 3 0 0 0 6 0" />
        </svg>
        
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="notification-dropdown">
          <div className="notification-dropdown-header">Notifications</div>

          <div className="notification-dropdown-body">
            {loading ? (
              <div className="notification-dropdown-empty">
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
            ) : notifications.length === 0 ? (
              <div className="notification-dropdown-empty">
                <svg className="w-16 h-16 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.4-1.4A2 2 0118 14.2V11a6 6 0 10-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0a3 3 0 11-6 0m6 0H9" />
                </svg>
                <p>No notifications yet</p>
                <p style={{ fontSize: '0.75rem', marginTop: '0.5rem', color: '#999' }}>
                  We'll notify you when something happens
                </p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => markAsRead(notif.id)}
                  className={`notification-dropdown-item ${!notif.read ? 'unread' : ''}`}
                >
                  <div className="notification-dropdown-icon">
                    {notif.type === 'application_submitted' && (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                        <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
                      </svg>
                    )}
                    {notif.type === 'application_received' && (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    )}
                    {notif.type === 'application_approved' && (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    )}
                    {notif.type === 'application_denied' && (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  
                  <div className="notification-dropdown-content">
                    <div className="notification-dropdown-title">
                      {notif.title}
                    </div>
                    <div className="notification-dropdown-message">
                      {notif.message}
                    </div>
                    <div className="notification-dropdown-time">
                      {formatTime(notif.created_at)}
                    </div>
                  </div>
                  
                  {!notif.read && (
                    <div className="notification-dropdown-badge"></div>
                  )}
                </div>
              ))
            )}
          </div>

          {notifications.length > 0 && (
            <div className="notification-dropdown-footer">
              <button 
                onClick={async () => {
                  const token = localStorage.getItem("solennia_token");
                  if (!token) return;
                  
                  try {
                    await fetch(`${API}/notifications/mark-all-read`, {
                      method: "POST",
                      headers: { Authorization: `Bearer ${token}` }
                    });
                    
                    setNotifications(notifications.map(n => ({ ...n, read: true })));
                    setUnreadCount(0);
                  } catch (err) {
                    console.error("Failed to mark all as read:", err);
                  }
                }}
              >
                Mark all as read
              </button>
            </div>
          )}
        </div>
      )}
      
      <style>{`
        .notification-dropdown {
          position: absolute;
          right: 0;
          margin-top: 0.5rem;
          width: 24rem;
          max-width: 90vw;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 1rem;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
          z-index: 50;
          overflow: hidden;
        }
        
        .notification-dropdown-header {
          padding: 1rem 1.25rem;
          font-size: 1.125rem;
          font-weight: 700;
          border-bottom: 1px solid #e5e7eb;
          background: #fafafa;
        }
        
        .notification-dropdown-body {
          max-height: 24rem;
          overflow-y: auto;
        }
        
        .notification-dropdown-empty {
          padding: 3rem 1.5rem;
          text-align: center;
          color: #6b7280;
        }
        
        .notification-dropdown-item {
          display: flex;
          gap: 0.75rem;
          padding: 1rem 1.25rem;
          border-bottom: 1px solid #f3f4f6;
          cursor: pointer;
          transition: background-color 0.2s;
          position: relative;
        }
        
        .notification-dropdown-item:hover {
          background: #f9fafb;
        }
        
        .notification-dropdown-item.unread {
          background: #f0fdf4;
        }
        
        .notification-dropdown-item.unread:hover {
          background: #dcfce7;
        }
        
        .notification-dropdown-icon {
          flex-shrink: 0;
          width: 2.5rem;
          height: 2.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: #e8ddae;
          color: #7a5d47;
        }
        
        .notification-dropdown-content {
          flex: 1;
          min-width: 0;
        }
        
        .notification-dropdown-title {
          font-weight: 600;
          font-size: 0.875rem;
          margin-bottom: 0.25rem;
          color: #111827;
        }
        
        .notification-dropdown-message {
          font-size: 0.8125rem;
          color: #6b7280;
          line-height: 1.5;
          word-wrap: break-word;
          white-space: normal;
        }
        
        .notification-dropdown-time {
          font-size: 0.75rem;
          color: #9ca3af;
          margin-top: 0.5rem;
        }
        
        .notification-dropdown-badge {
          flex-shrink: 0;
          width: 0.5rem;
          height: 0.5rem;
          border-radius: 50%;
          background: #10b981;
        }
        
        .notification-dropdown-footer {
          padding: 0.75rem 1.25rem;
          border-top: 1px solid #e5e7eb;
          background: #fafafa;
        }
        
        .notification-dropdown-footer button {
          width: 100%;
          padding: 0.5rem;
          text-align: center;
          font-size: 0.875rem;
          font-weight: 600;
          color: #7a5d47;
          background: transparent;
          border: none;
          border-radius: 0.5rem;
          cursor: pointer;
          transition: background-color 0.2s;
        }
        
        .notification-dropdown-footer button:hover {
          background: #e8ddae;
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}