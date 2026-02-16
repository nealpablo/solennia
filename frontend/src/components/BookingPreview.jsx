export default function BookingPreview({ data, stage }) {
  const completionPercentage = calculateCompletion(data);

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h3 style={styles.headerTitle}>Booking Progress</h3>
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

      {/* Data Fields */}
      <div style={styles.fieldsContainer}>
        <DataField label="Event Type" value={data.event_type} icon="event" />
        <DataField label="Date" value={data.date ? formatDate(data.date) : null} icon="date" />
        <DataField label="Time" value={data.time} icon="time" />
        <DataField label="Location" value={data.location} icon="location" />
        <DataField label="Budget" value={data.budget ? (typeof data.budget === 'number' ? `P${data.budget.toLocaleString()}` : data.budget) : null} icon="budget" />
        <DataField label="Guests" value={data.guests} icon="guests" />
      </div>

      {/* Preferences */}
      {data.preferences && data.preferences.length > 0 && (
        <div style={styles.preferencesSection}>
          <p style={styles.preferencesLabel}>Preferences</p>
          <div style={styles.prefTags}>
            {data.preferences.map((pref, i) => (
              <span key={i} style={styles.prefTag}>
                {pref}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Stage Indicator */}
      <div style={styles.stageSection}>
        <StageIndicator stage={stage} />
      </div>
    </div>
  );
}

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

function DataField({ icon, label, value }) {
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
      </div>
      {value && (
        <div style={styles.checkMark}>
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="#4A8C5C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 8 6.5 11.5 13 5" />
          </svg>
        </div>
      )}
    </div>
  );
}

function StageIndicator({ stage }) {
  const stages = [
    { key: 'discovery', label: 'Gathering Details' },
    { key: 'vendor_search', label: 'Finding Vendors' },
    { key: 'confirmation', label: 'Ready to Book' },
    { key: 'completed', label: 'Booking Complete' },
  ];

  const currentIndex = stages.findIndex(s => s.key === stage);

  return (
    <div>
      <p style={styles.stageLabel}>Current Stage</p>
      <div style={styles.stageTrack}>
        {stages.map((s, i) => (
          <div key={s.key} style={styles.stageStep}>
            <div
              style={{
                ...styles.stageDot,
                background: i <= currentIndex ? '#7A5D47' : '#E0D5C0',
                border: i === currentIndex ? '2px solid #5A4333' : '2px solid transparent',
                transform: i === currentIndex ? 'scale(1.2)' : 'scale(1)',
              }}
            />
            <span
              style={{
                ...styles.stageStepLabel,
                color: i <= currentIndex ? '#3D2E1F' : '#A39484',
                fontWeight: i === currentIndex ? '700' : '500',
              }}
            >
              {s.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function calculateCompletion(data) {
  const fields = ['event_type', 'date', 'time', 'location', 'budget', 'guests'];
  const filled = fields.filter(field => data[field]).length;
  return Math.round((filled / fields.length) * 100);
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

const styles = {
  container: {
    background: '#FFFFFF',
    borderRadius: '12px',
    border: '1px solid #D4C5A9',
    overflow: 'hidden',
    boxShadow: '0 4px 24px rgba(122, 93, 71, 0.08)',
    position: 'sticky',
    top: '16px',
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
    paddingBottom: '8px',
  },
  progressTrack: {
    width: '100%',
    height: '6px',
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
  fieldsContainer: {
    padding: '12px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  fieldRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 0',
    borderBottom: '1px solid #F5EDE0',
  },
  fieldIconWrap: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
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
    letterSpacing: '0.8px',
    fontWeight: '600',
    margin: 0,
  },
  fieldValue: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#3D2E1F',
    margin: 0,
    marginTop: '2px',
  },
  fieldEmpty: {
    fontSize: '13px',
    color: '#BFB3A1',
    fontStyle: 'italic',
    margin: 0,
    marginTop: '2px',
  },
  checkMark: {
    flexShrink: 0,
  },
  preferencesSection: {
    padding: '12px 20px',
    borderTop: '1px solid #F0E8D8',
  },
  preferencesLabel: {
    fontSize: '10px',
    color: '#8C7A68',
    textTransform: 'uppercase',
    letterSpacing: '0.8px',
    fontWeight: '600',
    margin: '0 0 8px 0',
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
    fontSize: '12px',
    fontWeight: '600',
    borderRadius: '6px',
    border: '1px solid #E8DCC8',
  },
  stageSection: {
    padding: '16px 20px',
    borderTop: '1px solid #F0E8D8',
    background: '#FDFAF5',
  },
  stageLabel: {
    fontSize: '10px',
    color: '#8C7A68',
    textTransform: 'uppercase',
    letterSpacing: '0.8px',
    fontWeight: '600',
    margin: '0 0 12px 0',
  },
  stageTrack: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  stageStep: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  stageDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    flexShrink: 0,
    transition: 'all 0.3s ease',
  },
  stageStepLabel: {
    fontSize: '12px',
    transition: 'all 0.3s ease',
  },
};