import { useState, useRef, useEffect } from 'react';

const sIcon = (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
    <path d="M8 14s1.5 2 4 2 4-2 4-2" />
    <circle cx="9" cy="9" r="1" fill="currentColor" />
    <circle cx="15" cy="9" r="1" fill="currentColor" />
  </svg>
);

export default function ChatInterface({ messages, onSendMessage, isProcessing }) {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
            <h3 style={styles.headerTitle}>Solennia Booking Assistant</h3>
            <p style={styles.headerSubtitle}>Vendor Recommendations & Booking</p>
          </div>
        </div>
        <div style={styles.statusBadge}>
          <span style={styles.statusDot} />
          Active
        </div>
      </div>

      {/* Messages */}
      <div style={styles.messageArea}>
        {messages.map((msg, index) => (
          <div
            key={index}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
              gap: '10px',
            }}
          >
            <div
              style={{
                ...styles.messageRow,
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              }}
            >
              {msg.role === 'assistant' && (
                <div style={styles.assistantAvatar}>S</div>
              )}

              <div
                style={
                  msg.role === 'user'
                    ? styles.userBubble
                    : styles.assistantBubble
                }
              >
                {msg.role === 'assistant' && (
                  <div style={styles.bubbleLabel}>Solennia Assistant</div>
                )}
                <p style={styles.messageText}>{msg.content}</p>
              </div>
            </div>

            {/* Vendor cards - rendered inline with the message that contains them */}
            {msg.vendors && msg.vendors.length > 0 && (
              <div style={styles.vendorGrid}>
                {msg.vendors.map((vendor) => (
                  <VendorCard key={vendor.ID} vendor={vendor} />
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

        <div ref={messagesEndRef} />
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

function VendorCard({ vendor }) {
  const formatPrice = (price) => {
    if (!price) return 'Contact for pricing';
    const num = parseFloat(price);
    if (!isNaN(num) && String(num) === String(price).trim()) {
      return 'P' + num.toLocaleString();
    }
    return price.toString();
  };

  return (
    <div style={styles.vendorCard}>
      <div style={styles.vendorCardHeader}>
        <div>
          <h4 style={styles.vendorName}>{vendor.BusinessName}</h4>
          <span style={styles.vendorCategory}>{vendor.Category}</span>
        </div>
        <span style={styles.vendorPrice}>{formatPrice(vendor.Pricing)}</span>
      </div>
      {vendor.Description && (
        <p style={styles.vendorDesc}>
          {vendor.Description.length > 100 ? vendor.Description.substring(0, 100) + '...' : vendor.Description}
        </p>
      )}
      <div style={styles.vendorFooter}>
        {vendor.AverageRating && vendor.AverageRating > 0 && (
          <span style={styles.vendorRating}>
            {vendor.AverageRating}/5.0
          </span>
        )}
        {vendor.TotalReviews > 0 && (
          <span style={styles.vendorReviews}>({vendor.TotalReviews} reviews)</span>
        )}
        {vendor.BusinessAddress && (
          <span style={styles.vendorLocation}>{vendor.BusinessAddress}</span>
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
  },
  userBubble: {
    maxWidth: '75%',
    background: 'linear-gradient(135deg, #7A5D47 0%, #6B4F3C 100%)',
    borderRadius: '16px 4px 16px 16px',
    padding: '12px 16px',
    color: '#FFFFFF',
    fontSize: '14px',
    lineHeight: '1.6',
    boxShadow: '0 2px 8px rgba(122, 93, 71, 0.15)',
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
    wordBreak: 'break-word',
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
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: '12px',
    paddingLeft: '42px',
  },
  vendorCard: {
    background: '#FFFFFF',
    border: '1px solid #E8DCC8',
    borderRadius: '10px',
    padding: '14px',
    transition: 'box-shadow 0.2s, border-color 0.2s',
    cursor: 'default',
    boxShadow: '0 1px 4px rgba(122, 93, 71, 0.04)',
  },
  vendorCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '8px',
  },
  vendorName: {
    fontSize: '14px',
    fontWeight: '700',
    color: '#3D2E1F',
    margin: 0,
  },
  vendorCategory: {
    fontSize: '11px',
    color: '#8C7A68',
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
    fontWeight: '500',
  },
  vendorPrice: {
    fontSize: '13px',
    fontWeight: '700',
    color: '#7A5D47',
    textAlign: 'right',
    whiteSpace: 'nowrap',
    marginLeft: '8px',
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