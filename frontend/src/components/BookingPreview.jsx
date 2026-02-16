export default function BookingPreview({ data, stage }) {
  const isVenueBooking = !!data.venue_id;
  const isSupplierBooking = !!data.vendor_id;
  const completionPercentage = calculateCompletion(data, isVenueBooking);

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h3 style={styles.headerTitle}>Booking Progress</h3>
          <p style={styles.headerSub}>
            {isVenueBooking ? 'Venue Booking' : isSupplierBooking ? 'Supplier Booking' : 'Event Planning'}
          </p>
        </div>
        <span style={styles.percentBadge}>{completionPercentage}%</span>
      </div>

      {/* Progress Bar */}
      <div style={styles.progressWrapper}>
        <div style={styles.progressTrack}>
          <div
            style={{
              ...styles.progressFill,
              width: `${completionPercentage}%`,
            }}
          />
        </div>
      </div>

      {/* Stage Timeline */}
      <div style={styles.timelineSection}>
        <StageTimeline stage={stage} />
      </div>

      {/* Data Fields */}
      <div style={styles.fieldsContainer}>
        <p style={styles.sectionTitle}>Event Details</p>
        <DataField label="Event Type" value={data.event_type} icon="event" />
        <DataField label="Date" value={data.date ? formatDate(data.date) : null} icon="date" />
        <DataField label="Time" value={data.time} icon="time" />

        {/* Location: only show for supplier bookings or if not yet determined */}
        {!isVenueBooking && (
          <DataField
            label="Location"
            value={data.location}
            icon="location"
            hint={isSupplierBooking ? 'Required for supplier booking' : null}
          />
        )}
        {isVenueBooking && data.venue_name && (
          <DataField
            label="Venue Location"
            value={data.venue_name}
            icon="location"
            hint="Venue provides the location"
            locked
          />
        )}

        <DataField
          label="Budget"
          value={data.budget ? (typeof data.budget === 'number' ? `₱${data.budget.toLocaleString()}` : data.budget) : null}
          icon="budget"
        />
        <DataField label="Guests" value={data.guests} icon="guests" />
      </div>

      {/* Selected Vendor/Venue Card */}
      {(data.venue_name || data.vendor_name) && (
        <div style={styles.selectionSection}>
          <p style={styles.sectionTitle}>Selected {data.venue_name ? 'Venue' : 'Supplier'}</p>
          <div style={styles.selectedCard}>
            <div style={styles.selectedCardIcon}>
              {data.venue_name ? (
                <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="#7A5D47" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 18h14M4 18V8l6-5 6 5v10M8 18v-5h4v5" />
                </svg>
              ) : (
                <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="#7A5D47" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="14" height="14" rx="2" />
                  <circle cx="10" cy="8" r="2.5" />
                  <path d="M5 16c0-2.5 2.2-4.5 5-4.5s5 2 5 4.5" />
                </svg>
              )}
            </div>
            <div style={styles.selectedCardInfo}>
              <p style={styles.selectedCardName}>
                {data.venue_name || data.vendor_name}
              </p>
              <p style={styles.selectedCardType}>
                {data.venue_name ? 'Venue' : 'Supplier'} #{data.venue_id || data.vendor_id}
              </p>
            </div>
            <div style={styles.selectedBadge}>Selected</div>
          </div>
        </div>
      )}

      {/* Preferences */}
      {data.preferences && data.preferences.length > 0 && (
        <div style={styles.preferencesSection}>
          <p style={styles.sectionTitle}>Preferences</p>
          <div style={styles.prefTags}>
            {data.preferences.map((pref, i) => (
              <span key={i} style={styles.prefTag}>
                {pref}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Next Step Hint */}
      <div style={styles.hintSection}>
        <NextStepHint stage={stage} data={data} isVenueBooking={isVenueBooking} />
      </div>

      <style>{`
        @keyframes bp-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes bp-slide { from { opacity: 0; transform: translateX(-6px); } to { opacity: 1; transform: translateX(0); } }
      `}</style>
    </div>
  );
}

/* ─── Next Step Hint ─── */
function NextStepHint({ stage, data, isVenueBooking }) {
  const getHint = () => {
    switch (stage) {
      case 'discovery':
        if (!data.event_type) return { text: 'Tell the assistant what type of event you are planning.', action: 'Start by sharing your event type' };
        if (!data.date) return { text: 'Provide the date for your event.', action: 'Share your event date' };
        if (!data.budget) return { text: 'Set a budget so we can find the right options for you.', action: 'Set your budget' };
        if (!data.guests) return { text: 'How many guests are you expecting?', action: 'Specify guest count' };
        return { text: 'Details are looking good. Ask for venue or vendor recommendations.', action: 'Ask for recommendations' };
      case 'recommendation':
        return { text: 'Review the recommendations above. Select one to proceed with booking.', action: 'Pick a venue or vendor' };
      case 'vendor_search':
        if (!data.venue_id && !data.vendor_id)
          return { text: 'Browse the options and select one to continue.', action: 'Select a vendor or venue' };
        return { text: 'Vendor selected. Confirm your booking details.', action: 'Confirm your booking' };
      case 'confirmation':
        const missing = [];
        if (!data.time) missing.push('time');
        if (!isVenueBooking && !data.location) missing.push('location');
        if (missing.length > 0)
          return { text: `Still need: ${missing.join(', ')}. Provide these to proceed.`, action: `Add ${missing.join(' and ')}` };
        return { text: 'All details are set. Confirm with the assistant to finalize your booking.', action: 'Confirm booking' };
      case 'completed':
        return { text: 'Your booking has been submitted successfully.', action: 'Booking complete' };
      default:
        return { text: 'Chat with the assistant to get started.', action: 'Get started' };
    }
  };

  const hint = getHint();
  return (
    <div style={styles.hintCard}>
      <div style={styles.hintIcon}>
        <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="#7A5D47" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="10" cy="10" r="8" />
          <path d="M10 13v-3M10 7h.01" />
        </svg>
      </div>
      <div>
        <p style={styles.hintAction}>{hint.action}</p>
        <p style={styles.hintText}>{hint.text}</p>
      </div>
    </div>
  );
}

/* ─── Stage Timeline ─── */
function StageTimeline({ stage }) {
  const stages = [
    { key: 'discovery', label: 'Gathering Details', desc: 'Event type, date, budget' },
    { key: 'recommendation', label: 'Recommendations', desc: 'Venue & vendor options' },
    { key: 'vendor_search', label: 'Selection', desc: 'Choosing the right one' },
    { key: 'confirmation', label: 'Confirmation', desc: 'Final review & booking' },
    { key: 'completed', label: 'Booked', desc: 'All set' },
  ];

  const currentIndex = stages.findIndex(s => s.key === stage);

  return (
    <div style={styles.timelineTrack}>
      {stages.map((s, i) => {
        const isComplete = i < currentIndex;
        const isCurrent = i === currentIndex;
        const isFuture = i > currentIndex;

        return (
          <div key={s.key} style={styles.timelineItem}>
            {/* Connector line */}
            {i > 0 && (
              <div
                style={{
                  ...styles.timelineConnector,
                  background: isComplete ? '#7A5D47' : '#E8DCC8',
                }}
              />
            )}

            {/* Dot */}
            <div
              style={{
                ...styles.timelineDot,
                background: isComplete ? '#7A5D47' : isCurrent ? '#FFFFFF' : '#F5EDE0',
                border: isCurrent
                  ? '2.5px solid #7A5D47'
                  : isComplete
                    ? '2.5px solid #7A5D47'
                    : '2px solid #D4C5A9',
                boxShadow: isCurrent ? '0 0 0 3px rgba(122, 93, 71, 0.15)' : 'none',
              }}
            >
              {isComplete && (
                <svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="#FFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="2 6 5 9 10 3" />
                </svg>
              )}
              {isCurrent && (
                <div style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: '#7A5D47',
                  animation: 'bp-pulse 2s ease-in-out infinite',
                }} />
              )}
            </div>

            {/* Label */}
            <div style={{
              ...styles.timelineLabel,
              animation: isCurrent ? 'bp-slide 0.4s ease-out' : 'none',
            }}>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: isCurrent ? '700' : isComplete ? '600' : '500',
                  color: isFuture ? '#B5A898' : '#3D2E1F',
                }}
              >
                {s.label}
              </span>
              {isCurrent && (
                <span style={styles.timelineDesc}>{s.desc}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Icons ─── */
function FieldIcon({ type }) {
  const iconMap = {
    event: (
      <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="#7A5D47" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="4" width="16" height="14" rx="2" />
        <path d="M2 8h16" />
        <path d="M6 2v4M14 2v4" />
      </svg>
    ),
    date: (
      <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="#7A5D47" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="4" width="16" height="14" rx="2" />
        <path d="M2 8h16" />
        <path d="M6 2v4M14 2v4" />
        <circle cx="10" cy="13" r="1.5" fill="#7A5D47" stroke="none" />
      </svg>
    ),
    time: (
      <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="#7A5D47" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="10" cy="10" r="8" />
        <path d="M10 6v4l3 2" />
      </svg>
    ),
    location: (
      <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="#7A5D47" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 18s-6-5.5-6-9.5a6 6 0 1112 0c0 4-6 9.5-6 9.5z" />
        <circle cx="10" cy="8.5" r="2" />
      </svg>
    ),
    budget: (
      <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="#7A5D47" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 2v16M14 6H8.5a2.5 2.5 0 000 5h3a2.5 2.5 0 010 5H6" />
      </svg>
    ),
    guests: (
      <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="#7A5D47" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="7" cy="7" r="3" />
        <path d="M2 17v-1a5 5 0 0110 0v1" />
        <circle cx="14" cy="7" r="2" />
        <path d="M14 13a4 4 0 014 4v0" />
      </svg>
    ),
  };
  return iconMap[type] || null;
}

/* ─── Data Field ─── */
function DataField({ icon, label, value, hint, locked }) {
  return (
    <div style={styles.fieldRow}>
      <div style={styles.fieldIconWrap}>
        <FieldIcon type={icon} />
      </div>
      <div style={styles.fieldContent}>
        <p style={styles.fieldLabel}>{label}</p>
        {value ? (
          <p style={styles.fieldValue}>{value}</p>
        ) : (
          <p style={styles.fieldEmpty}>Not provided yet</p>
        )}
        {hint && <p style={styles.fieldHint}>{hint}</p>}
      </div>
      {value && !locked && (
        <div style={styles.checkMark}>
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="#4A8C5C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 8 6.5 11.5 13 5" />
          </svg>
        </div>
      )}
      {locked && (
        <div style={styles.lockMark}>
          <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="#8C7A68" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="7" width="10" height="7" rx="1.5" />
            <path d="M5 7V5a3 3 0 016 0v2" />
          </svg>
        </div>
      )}
    </div>
  );
}

/* ─── Helpers ─── */
function calculateCompletion(data, isVenueBooking) {
  // Core fields always required
  const fields = ['event_type', 'date', 'time', 'budget', 'guests'];

  // Location only required for supplier bookings
  if (!isVenueBooking) {
    fields.push('location');
  }

  // Vendor or Venue selection
  if (data.venue_id || data.vendor_id) {
    // Count selection as a completed field
    const filled = fields.filter(field => data[field]).length + 1;
    return Math.round((filled / (fields.length + 1)) * 100);
  }

  const filled = fields.filter(field => data[field]).length;
  return Math.round((filled / (fields.length + 1)) * 100); // +1 for vendor/venue selection
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/* ─── Styles ─── */
const styles = {
  container: {
    background: '#FFFFFF',
    borderRadius: '12px',
    border: '1px solid #D4C5A9',
    overflow: 'hidden',
    overflowY: 'auto',
    boxShadow: '0 4px 24px rgba(122, 93, 71, 0.08)',
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    background: 'linear-gradient(135deg, #7A5D47 0%, #5A4333 100%)',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: '15px',
    fontWeight: '700',
    margin: 0,
    letterSpacing: '0.3px',
  },
  headerSub: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: '11px',
    margin: '2px 0 0 0',
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
    fontWeight: '500',
  },
  percentBadge: {
    background: 'rgba(255,255,255,0.15)',
    color: '#FFFFFF',
    fontSize: '13px',
    fontWeight: '700',
    padding: '4px 12px',
    borderRadius: '20px',
    border: '1px solid rgba(255,255,255,0.2)',
  },
  progressWrapper: {
    padding: '0 20px',
    marginTop: '-1px',
    paddingTop: '16px',
    paddingBottom: '4px',
  },
  progressTrack: {
    width: '100%',
    height: '5px',
    background: '#F0E8D8',
    borderRadius: '3px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #7A5D47 0%, #A67C5B 100%)',
    borderRadius: '3px',
    transition: 'width 0.5s ease',
  },
  timelineSection: {
    padding: '14px 20px 10px',
    borderBottom: '1px solid #F0E8D8',
  },
  timelineTrack: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0',
    position: 'relative',
  },
  timelineItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    position: 'relative',
    minHeight: '28px',
  },
  timelineConnector: {
    position: 'absolute',
    left: '9px',
    top: '-10px',
    width: '2px',
    height: '10px',
    transition: 'background 0.3s ease',
  },
  timelineDot: {
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'all 0.3s ease',
  },
  timelineLabel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1px',
  },
  timelineDesc: {
    fontSize: '10px',
    color: '#8C7A68',
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: '10px',
    color: '#8C7A68',
    textTransform: 'uppercase',
    letterSpacing: '0.8px',
    fontWeight: '700',
    margin: '0 0 8px 0',
  },
  fieldsContainer: {
    padding: '14px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '0',
    flex: 1,
  },
  fieldRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '9px 0',
    borderBottom: '1px solid #F5EDE0',
  },
  fieldIconWrap: {
    width: '30px',
    height: '30px',
    borderRadius: '7px',
    background: '#FAF5ED',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  fieldContent: {
    flex: 1,
    minWidth: 0,
  },
  fieldLabel: {
    fontSize: '10px',
    color: '#8C7A68',
    textTransform: 'uppercase',
    letterSpacing: '0.6px',
    fontWeight: '600',
    margin: 0,
  },
  fieldValue: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#3D2E1F',
    margin: 0,
    marginTop: '1px',
  },
  fieldEmpty: {
    fontSize: '12px',
    color: '#BFB3A1',
    fontStyle: 'italic',
    margin: 0,
    marginTop: '1px',
  },
  fieldHint: {
    fontSize: '10px',
    color: '#A39484',
    margin: 0,
    marginTop: '1px',
    fontStyle: 'italic',
  },
  checkMark: {
    flexShrink: 0,
  },
  lockMark: {
    flexShrink: 0,
    opacity: 0.6,
  },
  selectionSection: {
    padding: '14px 20px',
    borderTop: '1px solid #F0E8D8',
  },
  selectedCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px',
    background: 'linear-gradient(135deg, #FAF5ED 0%, #F5EDE0 100%)',
    borderRadius: '10px',
    border: '1.5px solid #D4C5A9',
  },
  selectedCardIcon: {
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    background: '#FFFFFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    border: '1px solid #E8DCC8',
  },
  selectedCardInfo: {
    flex: 1,
    minWidth: 0,
  },
  selectedCardName: {
    fontSize: '13px',
    fontWeight: '700',
    color: '#3D2E1F',
    margin: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  selectedCardType: {
    fontSize: '10px',
    color: '#8C7A68',
    margin: '2px 0 0 0',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    fontWeight: '500',
  },
  selectedBadge: {
    fontSize: '10px',
    fontWeight: '700',
    color: '#4A8C5C',
    background: '#E8F5ED',
    padding: '3px 8px',
    borderRadius: '4px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    flexShrink: 0,
  },
  preferencesSection: {
    padding: '14px 20px',
    borderTop: '1px solid #F0E8D8',
  },
  prefTags: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
  },
  prefTag: {
    padding: '4px 10px',
    background: '#FAF5ED',
    color: '#7A5D47',
    fontSize: '11px',
    fontWeight: '600',
    borderRadius: '6px',
    border: '1px solid #E8DCC8',
  },
  hintSection: {
    padding: '0 20px 16px',
    marginTop: 'auto',
  },
  hintCard: {
    display: 'flex',
    gap: '10px',
    padding: '12px',
    background: '#FDFAF5',
    borderRadius: '8px',
    border: '1px dashed #D4C5A9',
  },
  hintIcon: {
    flexShrink: 0,
    marginTop: '1px',
  },
  hintAction: {
    fontSize: '12px',
    fontWeight: '700',
    color: '#7A5D47',
    margin: '0 0 2px 0',
  },
  hintText: {
    fontSize: '11px',
    color: '#8C7A68',
    margin: 0,
    lineHeight: '1.4',
  },
};