import { useState, useRef, useEffect } from 'react';

export default function ChatInterface({ messages, onSendMessage, isProcessing }) {
  const [inputValue, setInputValue] = useState('');
  const messageContainerRef = useRef(null);

  const scrollToBottom = () => {
    if (messageContainerRef.current) {
      const { scrollHeight, clientHeight } = messageContainerRef.current;
      messageContainerRef.current.scrollTo({
        top: scrollHeight - clientHeight,
        behavior: 'smooth'
      });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isProcessing]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (inputValue.trim() && !isProcessing) {
      onSendMessage(inputValue.trim());
      setInputValue('');
    }
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.avatarContainer}>
            <span style={styles.avatarText}>S</span>
          </div>
          <div>
            <h3 style={styles.headerTitle}>Lenni Chatbot</h3>
            <p style={styles.headerSubtitle}>Supplier and Venue Recommendations & Booking</p>
          </div>
        </div>
        <div style={styles.statusBadge}>
          <span style={styles.statusDot} />
          Active
        </div>
      </div>

      {/* Messages */}
      <div
        ref={messageContainerRef}
        style={styles.messageArea}
      >
        {messages.map((msg, index) => (
          <div
            key={index}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
              gap: '10px',
              width: '100%',
            }}
          >
            <div
              style={{
                ...styles.messageRow,
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                width: '100%',
              }}
            >
              {msg.role === 'assistant' && (
                <div style={styles.assistantAvatar}>S</div>
              )}

              <div
                style={
                  msg.role === 'user'
                    ? styles.userBubble
                    : {
                      ...styles.assistantBubble,
                      ...(msg.vendors && msg.vendors.length > 0
                        ? { maxWidth: 'calc(100% - 42px)' }
                        : {}),
                    }
                }
              >
                {msg.role === 'assistant' && (
                  <div style={styles.bubbleLabel}>Solennia Assistant</div>
                )}
                <p style={styles.messageText}>{msg.content}</p>
              </div>
            </div>

            {/* Vendor cards */}
            {msg.vendors && msg.vendors.length > 0 && (
              <div style={styles.vendorGrid}>
                {msg.vendors.map((vendor, vi) => (
                  <VendorCard key={`${vendor.ID ?? vendor.id ?? vi}`} vendor={vendor} />
                ))}
              </div>
            )}
          </div>
        ))}

        {isProcessing && (
          <div style={{ ...styles.messageRow, justifyContent: 'flex-start' }}>
            <div style={styles.assistantAvatar}>S</div>
            <div style={styles.assistantBubble}>
              <div style={styles.thinkingContainer}>
                <div style={styles.thinkingDots}>
                  <span style={{ ...styles.dot, animationDelay: '0s' }} />
                  <span style={{ ...styles.dot, animationDelay: '0.15s' }} />
                  <span style={{ ...styles.dot, animationDelay: '0.3s' }} />
                </div>
                <span style={styles.thinkingLabel}>Processing your request...</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} style={styles.inputBar}>
        <div style={styles.inputRow}>
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder="Describe your event or ask for vendor recommendations..."
            disabled={isProcessing}
            rows={1}
            style={styles.textInput}
            onInput={(e) => {
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
            }}
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isProcessing}
            style={{
              ...styles.sendButton,
              opacity: !inputValue.trim() || isProcessing ? 0.4 : 1,
              cursor: !inputValue.trim() || isProcessing ? 'not-allowed' : 'pointer',
            }}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </form>

      <style>{`
        @keyframes solennia-bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-4px); }
        }
        @keyframes solennia-fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FIX: VendorCard now handles both venue and supplier profile URLs correctly.
// Venues use venue_id and open /venue-profile; suppliers use vendor_id / user_id.
// ─────────────────────────────────────────────────────────────────────────────
function VendorCard({ vendor }) {
  const formatPrice = (price) => {
    if (!price) return 'Contact for pricing';
    const num = parseFloat(price);
    if (!isNaN(num) && String(num) === String(price).trim()) {
      return '₱' + num.toLocaleString();
    }
    const str = price.toString();
    return str.length > 60 ? str.substring(0, 60) + '...' : str;
  };

  const handleClick = () => {
    const isVenue = vendor.type === 'venue';

    if (isVenue) {
      // Venue: use the venue listing id, not user_id
      const venueId = vendor.venue_id ?? vendor.ID ?? vendor.id;
      if (venueId) {
        window.open(`/venue/${venueId}`, '_blank');
      }
    } else {
      // Supplier: use user_id for the profile, plus optional listing id
      const userId = vendor.UserID ?? vendor.user_id;
      const listingId = vendor.vendor_id ?? vendor.ID ?? vendor.id;
      if (userId) {
        const url = listingId
          ? `/vendor-profile?id=${userId}&listingId=${listingId}`
          : `/vendor-profile?id=${userId}`;
        window.open(url, '_blank');
      } else if (listingId) {
        // Fallback: open by listing id alone
        window.open(`/vendor-profile?listingId=${listingId}`, '_blank');
      }
    }
  };

  return (
    <div
      style={styles.vendorCard}
      onClick={handleClick}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(122, 93, 71, 0.15)';
        e.currentTarget.style.borderColor = '#7A5D47';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = '0 1px 4px rgba(122, 93, 71, 0.04)';
        e.currentTarget.style.borderColor = '#E8DCC8';
      }}
    >
      <div style={styles.vendorCardHeader}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h4 style={styles.vendorName}>{vendor.BusinessName ?? vendor.business_name ?? vendor.venue_name}</h4>
          <span style={styles.vendorCategory}>
            {vendor.type === 'venue' ? 'Venue' : (vendor.Category ?? vendor.service_category ?? 'Supplier')}
          </span>
        </div>
      </div>
      <span style={styles.vendorPrice}>{formatPrice(vendor.Pricing ?? vendor.pricing)}</span>
      {(vendor.Description ?? vendor.description) && (
        <p style={styles.vendorDesc}>
          {(vendor.Description ?? vendor.description).length > 100
            ? (vendor.Description ?? vendor.description).substring(0, 100) + '...'
            : (vendor.Description ?? vendor.description)}
        </p>
      )}
      <div style={styles.vendorFooter}>
        {vendor.AverageRating && vendor.AverageRating > 0 && (
          <span style={styles.vendorRating}>{vendor.AverageRating}/5.0</span>
        )}
        {vendor.TotalReviews > 0 && (
          <span style={styles.vendorReviews}>({vendor.TotalReviews} reviews)</span>
        )}
        {(vendor.BusinessAddress ?? vendor.address) && (
          <span style={styles.vendorLocation}>{vendor.BusinessAddress ?? vendor.address}</span>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    background: '#FFFAF3',
    borderRadius: '12px',
    border: '1px solid #D4C5A9',
    overflow: 'hidden',
    boxShadow: '0 4px 24px rgba(122, 93, 71, 0.08)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    background: 'linear-gradient(135deg, #7A5D47 0%, #5A4333 100%)',
    borderBottom: '2px solid #4A3526',
    flexShrink: 0,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  avatarContainer: {
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    background: 'rgba(255,255,255,0.15)',
    border: '1.5px solid rgba(255,255,255,0.25)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: '16px',
    fontFamily: "'Georgia', serif",
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: '15px',
    fontWeight: '700',
    margin: 0,
    letterSpacing: '0.3px',
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: '11px',
    margin: 0,
    marginTop: '2px',
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
    fontWeight: '500',
  },
  statusBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '11px',
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  statusDot: {
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    background: '#4ADE80',
    boxShadow: '0 0 6px rgba(74,222,128,0.4)',
  },
  messageArea: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    background: '#FFFAF3',
  },
  messageRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    animation: 'solennia-fade-in 0.3s ease-out',
    minWidth: 0,
  },
  assistantAvatar: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    background: '#7A5D47',
    color: '#FFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '13px',
    fontWeight: '700',
    fontFamily: "'Georgia', serif",
    flexShrink: 0,
    marginTop: '2px',
  },
  assistantBubble: {
    maxWidth: '75%',
    background: '#FFFFFF',
    border: '1px solid #E8DCC8',
    borderRadius: '4px 16px 16px 16px',
    padding: '12px 16px',
    color: '#3D2E1F',
    fontSize: '14px',
    lineHeight: '1.6',
    boxShadow: '0 1px 4px rgba(122, 93, 71, 0.06)',
    minWidth: 0,
    wordBreak: 'break-word',
    overflowWrap: 'break-word',
  },
  userBubble: {
    display: 'inline-block',
    maxWidth: '75%',
    background: 'linear-gradient(135deg, #7A5D47 0%, #6B4F3C 100%)',
    borderRadius: '16px 4px 16px 16px',
    padding: '12px 16px',
    color: '#FFFFFF',
    fontSize: '14px',
    lineHeight: '1.6',
    boxShadow: '0 2px 8px rgba(122, 93, 71, 0.15)',
    wordBreak: 'normal',
    overflowWrap: 'break-word',
    whiteSpace: 'pre-wrap',
    flexShrink: 0,
  },
  bubbleLabel: {
    fontSize: '11px',
    fontWeight: '700',
    color: '#7A5D47',
    marginBottom: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  messageText: {
    margin: 0,
    whiteSpace: 'pre-wrap',
    wordBreak: 'normal',
    overflowWrap: 'break-word',
  },
  thinkingContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  thinkingDots: {
    display: 'flex',
    gap: '4px',
  },
  dot: {
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    background: '#7A5D47',
    display: 'inline-block',
    animation: 'solennia-bounce 1.4s ease-in-out infinite',
  },
  thinkingLabel: {
    fontSize: '12px',
    color: '#8C7A68',
    fontWeight: '500',
  },
  inputBar: {
    padding: '16px 20px',
    borderTop: '1px solid #E8DCC8',
    background: '#FFFFFF',
    flexShrink: 0,
  },
  inputRow: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '10px',
  },
  textInput: {
    flex: 1,
    padding: '12px 16px',
    border: '1.5px solid #D4C5A9',
    borderRadius: '12px',
    fontSize: '14px',
    fontFamily: 'inherit',
    lineHeight: '1.5',
    outline: 'none',
    resize: 'none',
    minHeight: '44px',
    maxHeight: '120px',
    background: '#FFFAF3',
    color: '#3D2E1F',
    transition: 'border-color 0.2s',
  },
  sendButton: {
    width: '44px',
    height: '44px',
    minWidth: '44px',
    borderRadius: '12px',
    background: 'linear-gradient(135deg, #7A5D47 0%, #5A4333 100%)',
    color: '#FFFFFF',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'opacity 0.2s, transform 0.1s',
    flexShrink: 0,
  },
  vendorGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '10px',
    paddingLeft: '42px',
    width: 'calc(100% - 42px)',
    boxSizing: 'border-box',
    alignItems: 'start',
  },
  vendorCard: {
    background: '#FFFFFF',
    border: '1px solid #E8DCC8',
    borderRadius: '10px',
    padding: '12px',
    transition: 'box-shadow 0.2s, border-color 0.2s',
    cursor: 'pointer',
    boxShadow: '0 1px 4px rgba(122, 93, 71, 0.04)',
    overflow: 'hidden',
    minWidth: 0,
  },
  vendorCardHeader: {
    marginBottom: '6px',
  },
  vendorName: {
    fontSize: '13px',
    fontWeight: '700',
    color: '#3D2E1F',
    margin: 0,
    wordBreak: 'break-word',
  },
  vendorCategory: {
    fontSize: '11px',
    color: '#8C7A68',
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
    fontWeight: '500',
  },
  vendorPrice: {
    fontSize: '12px',
    fontWeight: '700',
    color: '#7A5D47',
    display: 'block',
    marginBottom: '6px',
    wordBreak: 'break-word',
  },
  vendorDesc: {
    fontSize: '12px',
    color: '#6B5E50',
    lineHeight: '1.5',
    margin: '0 0 10px 0',
  },
  vendorFooter: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  vendorRating: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#7A5D47',
    background: '#F5EDE0',
    padding: '2px 8px',
    borderRadius: '4px',
  },
  vendorReviews: {
    fontSize: '11px',
    color: '#8C7A68',
  },
  vendorLocation: {
    fontSize: '11px',
    color: '#8C7A68',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '150px',
  },
};