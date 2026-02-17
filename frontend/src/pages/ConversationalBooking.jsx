import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import ChatInterface from '../components/ChatInterface';
import BookingPreview from '../components/BookingPreview';
import toast from '../utils/toast';

const API = import.meta.env.VITE_API_BASE ||
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD
    ? "https://solennia.up.railway.app/api"
    : "/api");

const STORAGE_KEY = 'solennia_chat_history';
const DATA_KEY = 'solennia_chat_data';
const STAGE_KEY = 'solennia_chat_stage';
const VENDORS_KEY = 'solennia_chat_vendors';

const DEFAULT_WELCOME = {
  role: 'assistant',
  content: "Welcome to the Solennia Booking Assistant.\n\nI can help you find and book event vendors and venues registered on the Solennia platform.\n\nWhat type of event are you planning?"
};

const DEFAULT_DATA = {
  event_type: null,
  date: null,
  time: null,
  location: null,
  budget: null,
  guests: null,
  venue_id: null,
  vendor_id: null,
  preferences: []
};

function loadSaved(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

const getCurrentUserId = () => {
  try {
    const profile = JSON.parse(localStorage.getItem('solennia_profile'));
    return profile?.id;
  } catch {
    return null;
  }
};

export default function ConversationalBooking() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const hasProcessedInitial = useRef(false);

  // Get current user ID to scope localStorage keys
  const userId = getCurrentUserId();
  const userSuffix = userId ? `_${userId}` : '';

  const storageKey = `${STORAGE_KEY}${userSuffix}`;
  const dataKey = `${DATA_KEY}${userSuffix}`;
  const stageKey = `${STAGE_KEY}${userSuffix}`;
  const vendorsKey = `${VENDORS_KEY}${userSuffix}`;

  // ── Hydrate from localStorage ────────────────────────────────────────────
  const [messages, setMessages] = useState(() =>
    loadSaved(storageKey, [DEFAULT_WELCOME])
  );
  const [extractedData, setExtractedData] = useState(() =>
    loadSaved(dataKey, DEFAULT_DATA)
  );
  const [bookingStage, setBookingStage] = useState(() =>
    loadSaved(stageKey, 'discovery')
  );
  // FIX: persist suggestedVendors across turns so backend can validate IDs
  const [suggestedVendors, setSuggestedVendors] = useState(() =>
    loadSaved(vendorsKey, [])
  );

  const [isProcessing, setIsProcessing] = useState(false);
  const [bookingCreated, setBookingCreated] = useState(false);

  // ── Persist to localStorage whenever state changes ───────────────────────
  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(messages)); } catch { }
  }, [messages, storageKey]);
  useEffect(() => {
    try { localStorage.setItem(dataKey, JSON.stringify(extractedData)); } catch { }
  }, [extractedData, dataKey]);
  useEffect(() => {
    try { localStorage.setItem(stageKey, JSON.stringify(bookingStage)); } catch { }
  }, [bookingStage, stageKey]);
  useEffect(() => {
    try { localStorage.setItem(vendorsKey, JSON.stringify(suggestedVendors)); } catch { }
  }, [suggestedVendors, vendorsKey]);

  // ── Clear chat ───────────────────────────────────────────────────────────
  const handleClearChat = () => {
    setMessages([DEFAULT_WELCOME]);
    setExtractedData(DEFAULT_DATA);
    setBookingStage('discovery');
    setSuggestedVendors([]);
    try {
      localStorage.removeItem(storageKey);
      localStorage.removeItem(dataKey);
      localStorage.removeItem(stageKey);
      localStorage.removeItem(vendorsKey);
    } catch { }
  };

  useEffect(() => {
    const token = localStorage.getItem('solennia_token');
    if (!token) {
      toast.error('Please log in to create a booking');
      navigate('/');
      return;
    }

    if (!hasProcessedInitial.current) {
      const urlMsg = searchParams.get('ai_message');
      const sessionMsg = sessionStorage.getItem("pending_ai_query");
      const messageToProcess = urlMsg || sessionMsg;

      if (messageToProcess) {
        hasProcessedInitial.current = true;
        if (sessionMsg) sessionStorage.removeItem("pending_ai_query");
        setTimeout(() => handleSendMessage(messageToProcess), 500);
      }
    }

    if (location.state?.initialMessage) {
      if (location.state.venueContext) {
        const venue = location.state.venueContext;
        setMessages([{
          role: 'assistant',
          content: `I see you are interested in booking ${venue.venueName}.\n\nI will help you complete this booking. What type of event are you planning?`
        }]);
      } else if (location.state.vendorContext) {
        const vendor = location.state.vendorContext;
        setMessages([{
          role: 'assistant',
          content: `I see you are interested in booking ${vendor.vendorName} for ${vendor.category}.\n\nI will help you complete this booking. Tell me about your event.`
        }]);
      }
    }
  }, [navigate]);

  const handleSendMessage = async (userMessage) => {
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsProcessing(true);

    try {
      const token = localStorage.getItem('solennia_token');

      // Build conversation history (exclude the welcome message's vendors to keep payload lean)
      const historyForApi = messages.slice(1).map(m => ({
        role: m.role,
        content: m.content
      }));

      const response = await fetch(`${API}/ai/conversational-booking`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: userMessage,
          currentData: extractedData,
          stage: bookingStage,
          history: historyForApi,
          // FIX: send persisted vendor list so backend can resolve IDs across turns
          suggestedVendors: suggestedVendors
        })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to process message');
      }

      if (data.extractedInfo && Object.keys(data.extractedInfo).length > 0) {
        setExtractedData(prev => ({ ...prev, ...data.extractedInfo }));
      }

      if (data.stage) {
        setBookingStage(data.stage);
      }

      // FIX: merge new vendors with existing ones so IDs are never lost between turns
      if (data.suggestedVendors && data.suggestedVendors.length > 0) {
        setSuggestedVendors(prev => {
          const existingIds = new Set(prev.map(v => `${v.type ?? 'supplier'}_${v.vendor_id ?? v.venue_id ?? v.id}`));
          const incoming = data.suggestedVendors.filter(v => {
            const key = `${v.type ?? 'supplier'}_${v.vendor_id ?? v.venue_id ?? v.id}`;
            return !existingIds.has(key);
          });
          return [...prev, ...incoming];
        });
      }

      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: data.aiResponse,
          vendors: data.currentRecommendations || []
        }
      ]);

      if (data.bookingCreated && data.bookingId) {
        setBookingCreated(true);
        // Clear persisted chat after a successful booking
        handleClearChat();
        toast.success('Booking created successfully.');
        setTimeout(() => navigate('/my-bookings'), 3000);
      }

    } catch (error) {
      console.error('Error:', error);
      toast.error(error.message || 'Failed to send message');
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: "An error occurred while processing your request. Please try again." }
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div style={pageStyles.page}>
      <div style={pageStyles.wrapper}>
        <div style={pageStyles.headerSection}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h1 style={pageStyles.title}>Lenni</h1>
              <p style={pageStyles.subtitle}>
                Hi, I'm Lenni, your AI booking assistant. How can I help you plan your event?
              </p>
            </div>
            {/* Clear chat button */}
            <button
              onClick={handleClearChat}
              disabled={isProcessing}
              style={pageStyles.clearBtn}
              title="Start a new conversation"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <polyline points="1 4 1 10 7 10" />
                <path d="M3.51 15a9 9 0 1 0 .49-3.88" />
              </svg>
              Clear
            </button>
          </div>
        </div>

        <div style={pageStyles.grid}>
          <div style={pageStyles.chatColumn}>
            <ChatInterface
              messages={messages}
              onSendMessage={handleSendMessage}
              isProcessing={isProcessing}
            />
          </div>

          <div style={pageStyles.previewColumn}>
            <BookingPreview data={extractedData} stage={bookingStage} />
          </div>
        </div>

        {bookingCreated && (
          <div style={pageStyles.overlay}>
            <div style={pageStyles.successModal}>
              <div style={pageStyles.successIcon}>
                <svg viewBox="0 0 48 48" width="48" height="48" fill="none" stroke="#4A8C5C" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="24" cy="24" r="20" />
                  <polyline points="14 24 21 31 34 18" />
                </svg>
              </div>
              <h2 style={pageStyles.successTitle}>Booking Created</h2>
              <p style={pageStyles.successText}>
                Your booking request has been submitted. Redirecting to your bookings...
              </p>
              <div style={pageStyles.spinner} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const pageStyles = {
  page: {
    minHeight: '100vh',
    background: '#F6F0E8',
    paddingTop: '32px',
    paddingBottom: '32px',
  },
  wrapper: {
    maxWidth: '1280px',
    margin: '0 auto',
    padding: '0 16px',
  },
  headerSection: {
    marginBottom: '24px',
  },
  title: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#3D2E1F',
    margin: '0 0 6px 0',
    fontFamily: "'Georgia', serif",
  },
  subtitle: {
    fontSize: '14px',
    color: '#8C7A68',
    margin: 0,
    letterSpacing: '0.2px',
  },
  clearBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    background: '#FFFFFF',
    border: '1.5px solid #D4C5A9',
    borderRadius: '8px',
    color: '#7A5D47',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
    letterSpacing: '0.2px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr',
    gap: '24px',
    alignItems: 'stretch',
    height: 'calc(100vh - 180px)',
  },
  chatColumn: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  previewColumn: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(29, 22, 15, 0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
    backdropFilter: 'blur(4px)',
  },
  successModal: {
    background: '#FFFFFF',
    borderRadius: '16px',
    padding: '40px',
    maxWidth: '420px',
    textAlign: 'center',
    boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
    border: '1px solid #E8DCC8',
  },
  successIcon: { marginBottom: '16px' },
  successTitle: {
    fontSize: '22px',
    fontWeight: '700',
    color: '#3D2E1F',
    margin: '0 0 8px 0',
  },
  successText: {
    fontSize: '14px',
    color: '#6B5E50',
    margin: '0 0 20px 0',
    lineHeight: '1.5',
  },
  spinner: {
    width: '28px',
    height: '28px',
    border: '3px solid #E8DCC8',
    borderTopColor: '#7A5D47',
    borderRadius: '50%',
    margin: '0 auto',
    animation: 'spin 0.8s linear infinite',
  },
};