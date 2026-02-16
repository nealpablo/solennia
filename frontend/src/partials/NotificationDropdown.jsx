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
  const [activeTab, setActiveTab] = useState('all'); // 'all' or 'unread'
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

  // Load notifications
  const loadNotifications = async (showLoading = false) => {
    try {
      const token = localStorage.getItem("solennia_token");
      if (!token) return;

      if (showLoading) setLoading(true);
      const res = await fetch(`${API}/notifications`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        const json = await res.json();
        const data = json.notifications || [];
        setNotifications(data);

        // Count unread (handling both boolean and 0/1)
        const unread = data.filter(n => n.read === false || n.read === 0 || !n.read).length;
        setUnreadCount(unread);
      }
    } catch (err) {
      console.error("Failed to load notifications:", err);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  // Initial load and polling
  useEffect(() => {
    loadNotifications(true);
    const interval = setInterval(() => loadNotifications(false), 10000);
    return () => clearInterval(interval);
  }, []);

  // Reload when opening
  useEffect(() => {
    if (isOpen) loadNotifications(false);
  }, [isOpen]);

  const markAsRead = async (notificationId) => {
    try {
      const token = localStorage.getItem("solennia_token");
      if (!token) return;

      // Optimistic update
      setNotifications(prev => prev.map(n =>
        n.id === notificationId ? { ...n, read: 1 } : n
      ));
      setUnreadCount(prev => Math.max(0, prev - 1));

      await fetch(`${API}/notifications/${notificationId}/read`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (err) {
      console.error("Failed to mark as read:", err);
      loadNotifications(false); // Revert on error
    }
  };

  const handleMarkAllRead = async (e) => {
    if (e) e.stopPropagation();

    const token = localStorage.getItem("solennia_token");
    if (!token) return;

    try {
      // Optimistic update
      setNotifications(prev => prev.map(n => ({ ...n, read: 1 })));
      setUnreadCount(0);

      const res = await fetch(`${API}/notifications/mark-all-read`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) throw new Error("Failed to mark all as read");
    } catch (err) {
      console.error("Mark all read failed:", err);
      loadNotifications(false); // Revert on error
    }
  };

  const formatTime = (ts) => {
    if (!ts) return "";
    const isoTimestamp = ts.replace(' ', 'T');
    const date = new Date(isoTimestamp);
    if (isNaN(date.getTime())) return "";

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

  const filteredNotifs = notifications.filter(n =>
    activeTab === 'all' || (n.read === false || n.read === 0 || !n.read)
  );

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={toggleDropdown}
        className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-black/5 transition-colors"
        aria-label="Notifications"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5" />
          <path d="M9 17a3 3 0 0 0 6 0" />
        </svg>

        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center border-2 border-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="notification-dropdown">
          <div className="notification-dropdown-header">
            <span>Notifications</span>
            {unreadCount > 0 && (
              <button
                className="mark-all-link"
                onClick={handleMarkAllRead}
              >
                Mark all as read
              </button>
            )}
          </div>

          <div className="notification-tabs">
            <button
              className={`notification-tab ${activeTab === 'all' ? 'active' : ''}`}
              onClick={() => setActiveTab('all')}
            >
              All
            </button>
            <button
              className={`notification-tab ${activeTab === 'unread' ? 'active' : ''}`}
              onClick={() => setActiveTab('unread')}
            >
              Unread {unreadCount > 0 && <span className="tab-badge">{unreadCount}</span>}
            </button>
          </div>

          <div className="notification-dropdown-body">
            {loading && notifications.length === 0 ? (
              <div className="notification-dropdown-empty">
                <div className="spinner" />
              </div>
            ) : filteredNotifs.length === 0 ? (
              <div className="notification-dropdown-empty">
                <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.4-1.4A2 2 0 1 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0a3 3 0 1 1-6 0m6 0H9" />
                </svg>
                <p className="text-sm font-medium">{activeTab === 'unread' ? 'No unread notifications' : 'No notifications yet'}</p>
              </div>
            ) : (
              filteredNotifs.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => markAsRead(notif.id)}
                  className={`notification-dropdown-item ${(!notif.read || notif.read === 0) ? 'unread' : ''}`}
                >
                  <div className="notification-dropdown-icon">
                    {notif.type?.includes('approved') || notif.type?.includes('received') ? (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    ) : notif.type?.includes('denied') ? (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414-1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
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

                  {(!notif.read || notif.read === 0) && (
                    <div className="notification-dropdown-badge"></div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <style>{`
        .notification-dropdown {
          position: absolute;
          right: 0;
          margin-top: 0.75rem;
          width: 24rem;
          max-width: 90vw;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 1rem;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
          z-index: 100;
          overflow: hidden;
          animation: slideDown 0.2s ease-out;
        }

        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .notification-dropdown-header {
          padding: 1.25rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid #f3f4f6;
          background: #fff;
        }

        .notification-dropdown-header span {
          font-size: 1.125rem;
          font-weight: 700;
          color: #111827;
        }

        .mark-all-link {
          background: none;
          border: none;
          color: #7a5d47;
          font-size: 0.8125rem;
          font-weight: 600;
          cursor: pointer;
          padding: 0.375rem 0.625rem;
          border-radius: 0.5rem;
          transition: all 0.2s;
        }

        .mark-all-link:hover {
          background: #f8f6ef;
          color: #5a4435;
        }

        .notification-tabs {
          display: flex;
          padding: 0 1.25rem;
          gap: 1.5rem;
          border-bottom: 1px solid #f3f4f6;
          background: white;
        }

        .notification-tab {
          background: none;
          border: none;
          padding: 1rem 0;
          font-size: 0.875rem;
          font-weight: 600;
          color: #6b7280;
          cursor: pointer;
          position: relative;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          transition: color 0.2s;
        }

        .notification-tab:hover {
          color: #111827;
        }

        .notification-tab.active {
          color: #7a5d47;
        }

        .notification-tab.active::after {
          content: '';
          position: absolute;
          bottom: -1px;
          left: 0;
          right: 0;
          height: 2px;
          background: #7a5d47;
        }

        .tab-badge {
          background: #10b981;
          color: white;
          font-size: 0.7rem;
          padding: 0 0.4rem;
          border-radius: 9999px;
          min-width: 1.125rem;
          height: 1.125rem;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .notification-dropdown-body {
          max-height: 28rem;
          overflow-y: auto;
        }
        
        .notification-dropdown-empty {
          padding: 4rem 2rem;
          text-align: center;
          color: #9ca3af;
        }
        
        .notification-dropdown-item {
          display: flex;
          gap: 1rem;
          padding: 1.25rem;
          border-bottom: 1px solid #f9fafb;
          cursor: pointer;
          transition: all 0.2s;
          position: relative;
        }
        
        .notification-dropdown-item:hover {
          background: #fdfcf9;
        }
        
        .notification-dropdown-item.unread {
          background: #fcfbf6;
        }
        
        .notification-dropdown-item.unread:hover {
          background: #f8f6ef;
        }
        
        .notification-dropdown-icon {
          flex-shrink: 0;
          width: 2.75rem;
          height: 2.75rem;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: #f8f6ef;
          color: #7a5d47;
          font-size: 1.25rem;
        }
        
        .notification-dropdown-content {
          flex: 1;
          min-width: 0;
        }
        
        .notification-dropdown-title {
          font-weight: 600;
          font-size: 0.9375rem;
          margin-bottom: 0.25rem;
          color: #111827;
        }
        
        .notification-dropdown-message {
          font-size: 0.8125rem;
          color: #4b5563;
          line-height: 1.6;
          word-wrap: break-word;
          overflow-wrap: break-word;
        }
        
        .notification-dropdown-time {
          font-size: 0.75rem;
          color: #9ca3af;
          margin-top: 0.625rem;
          display: flex;
          align-items: center;
        }
        
        .notification-dropdown-badge {
          flex-shrink: 0;
          width: 0.625rem;
          height: 0.625rem;
          border-radius: 50%;
          background: #7a5d47;
          margin-top: 0.4rem;
          box-shadow: 0 0 0 2px white;
        }

        .spinner {
          width: 2rem;
          height: 2rem;
          border: 3px solid #f3f4f6;
          border-top-color: #7a5d47;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          margin: 0 auto;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}