import React from 'react';

export default function BookingDetailsModal({ 
  booking, 
  isOpen, 
  onClose, 
  userRole, 
  onAccept, 
  onReject, 
  onCancel,
  processing 
}) {
  if (!isOpen || !booking) return null;

  const isVendor = userRole === 1;
  const isClient = userRole === 0;
  
  // Status color coding
  const getStatusStyle = (status) => {
    const styles = {
      Pending: { bg: '#fef3c7', text: '#92400e', border: '#fbbf24' },
      Confirmed: { bg: '#d1fae5', text: '#065f46', border: '#34d399' },
      Cancelled: { bg: '#fee2e2', text: '#991b1b', border: '#f87171' },
      Rejected: { bg: '#fee2e2', text: '#991b1b', border: '#f87171' },
      Completed: { bg: '#e0e7ff', text: '#3730a3', border: '#818cf8' }
    };
    return styles[status] || styles.Pending;
  };

  const statusStyle = getStatusStyle(booking.BookingStatus);

  //  UPDATED: Format date and time SEPARATELY
  const formatDateTime = (dateStr) => {
    if (!dateStr) return { date: 'Not specified', time: 'Not specified' };
    
    try {
      const date = new Date(dateStr);
      const dateFormatted = date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric'
      });
      const timeFormatted = date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      });
      
      return { date: dateFormatted, time: timeFormatted };
    } catch {
      return { date: dateStr, time: 'N/A' };
    }
  };

  // Format regular dates (for CreatedAt, UpdatedAt)
  const formatDate = (dateStr) => {
    if (!dateStr) return 'Not specified';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  //  Get formatted event date and time
  const { date: eventDate, time: eventTime } = formatDateTime(booking.EventDate);

  // Check if actions are available
  const canAccept = isVendor && booking.BookingStatus === 'Pending';
  const canReject = isVendor && booking.BookingStatus === 'Pending';
  const canCancel = isClient && booking.BookingStatus === 'Pending';

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.title}>Booking Details</h2>
          <button style={styles.closeBtn} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {/* Status Badge */}
        <div style={styles.statusSection}>
          <span 
            style={{
              ...styles.statusBadge,
              backgroundColor: statusStyle.bg,
              color: statusStyle.text,
              borderColor: statusStyle.border
            }}
          >
            {booking.BookingStatus}
          </span>
        </div>

        {/* Content */}
        <div style={styles.content}>
          
          {/* Service Information */}
          <section style={styles.section}>
            <h3 style={styles.sectionTitle}>💼 Service Information</h3>
            <div style={styles.infoGrid}>
              <InfoItem 
                icon="🎯"
                label="Service" 
                value={booking.ServiceName || 'Not specified'} 
              />
              <InfoItem 
                icon="🎉"
                label="Event Type" 
                value={booking.EventType || 'Not specified'} 
              />
              <InfoItem 
                icon="📦"
                label="Package Selected" 
                value={booking.PackageSelected || 'Not specified'} 
              />
              <InfoItem 
                icon="💰"
                label="Estimated Budget" 
                value={booking.TotalAmount ? `₱${parseFloat(booking.TotalAmount).toLocaleString()}` : 'Not specified'}
                highlight
              />
            </div>
          </section>

          {/*  UPDATED: Event Details with Separate Date and Time */}
          <section style={styles.section}>
            <h3 style={styles.sectionTitle}>📅 Event Details</h3>
            <div style={styles.infoGrid}>
              <InfoItem 
                icon="📅"
                label="Event Date" 
                value={eventDate} 
              />
              <InfoItem 
                icon="⏰"
                label="Event Time" 
                value={eventTime} 
              />
              <InfoItem 
                icon="📍"
                label="Event Location" 
                value={booking.EventLocation || 'Not specified'} 
              />
              {booking.NumberOfGuests && (
                <InfoItem 
                  icon="👥"
                  label="Number of Guests" 
                  value={booking.NumberOfGuests.toString()} 
                />
              )}
            </div>
            
            {/*  UPDATED: Enhanced Additional Notes Display */}
            {booking.AdditionalNotes && (
              <div style={styles.notesContainer}>
                <label style={styles.notesLabel}>
                  <span style={styles.notesIcon}>📝</span>
                  Additional Notes
                </label>
                <p style={styles.notes}>{booking.AdditionalNotes}</p>
              </div>
            )}
          </section>

          {/* Client Information (Vendor View) */}
          {isVendor && (
            <section style={styles.section}>
              <h3 style={styles.sectionTitle}>👤 Client Information</h3>
              <div style={styles.infoGrid}>
                <InfoItem 
                  icon="👤"
                  label="Client Name" 
                  value={booking.client_name || booking.client_first_name + ' ' + booking.client_last_name || 'Not available'} 
                />
                <InfoItem 
                  icon="📧"
                  label="Email" 
                  value={booking.client_email || 'Not available'} 
                />
                {booking.client_phone && (
                  <InfoItem 
                    icon="📱"
                    label="Phone" 
                    value={booking.client_phone} 
                  />
                )}
              </div>
            </section>
          )}

          {/* Vendor Information (Client View) */}
          {isClient && (
            <section style={styles.section}>
              <h3 style={styles.sectionTitle}>🏢 Vendor Information</h3>
              <div style={styles.infoGrid}>
                <InfoItem 
                  icon="🏢"
                  label="Business Name" 
                  value={booking.vendor_business_name || booking.vendor_name || 'Not available'} 
                />
                <InfoItem 
                  icon="📧"
                  label="Contact Email" 
                  value={booking.vendor_email || 'Not available'} 
                />
              </div>
            </section>
          )}

          {/* Booking Metadata */}
          <section style={styles.section}>
            <h3 style={styles.sectionTitle}>ℹ️ Booking Information</h3>
            <div style={styles.infoGrid}>
              <InfoItem 
                icon="🔖"
                label="Booking ID" 
                value={`#${booking.ID}`} 
              />
              <InfoItem 
                icon="📅"
                label="Booked On" 
                value={formatDate(booking.CreatedAt)} 
              />
              {booking.UpdatedAt && booking.UpdatedAt !== booking.CreatedAt && (
                <InfoItem 
                  icon="🔄"
                  label="Last Updated" 
                  value={formatDate(booking.UpdatedAt)} 
                />
              )}
            </div>
          </section>

        </div>

        {/* Actions */}
        <div style={styles.actions}>
          
          {/* Vendor Actions */}
          {isVendor && (canAccept || canReject) && (
            <>
              <button
                style={styles.acceptBtn}
                onClick={() => onAccept(booking.ID)}
                disabled={processing}
              >
                {processing ? 'Processing...' : '✓ Accept Booking'}
              </button>
              <button
                style={styles.rejectBtn}
                onClick={() => onReject(booking.ID)}
                disabled={processing}
              >
                {processing ? 'Processing...' : '✗ Reject Booking'}
              </button>
            </>
          )}

          {/* Client Actions */}
          {isClient && canCancel && (
            <button
              style={styles.cancelBtn}
              onClick={() => onCancel(booking.ID)}
              disabled={processing}
            >
              {processing ? 'Processing...' : '✗ Cancel Booking'}
            </button>
          )}

          {/* Close Button */}
          <button style={styles.closeActionBtn} onClick={onClose}>
            Close
          </button>
        </div>

      </div>
    </div>
  );
}

/**
 * InfoItem Component
 * Displays a label-value pair with optional icon and highlight
 */
function InfoItem({ icon, label, value, highlight }) {
  return (
    <div style={styles.infoItem}>
      <label style={styles.label}>
        {icon && <span style={styles.icon}>{icon}</span>}
        {label}
      </label>
      <p style={{
        ...styles.value,
        ...(highlight ? styles.highlightValue : {})
      }}>
        {value}
      </p>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: '1rem',
    overflowY: 'auto'
  },
  modal: {
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    maxWidth: '800px',
    width: '100%',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
    margin: 'auto'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1.5rem',
    borderBottom: '1px solid #e5e5e5',
    backgroundColor: '#fafafa'
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: '600',
    color: '#1c1b1a',
    margin: 0
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: '2rem',
    color: '#666',
    cursor: 'pointer',
    padding: '0',
    width: '2rem',
    height: '2rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '4px',
    transition: 'all 0.2s'
  },
  statusSection: {
    padding: '1rem 1.5rem',
    display: 'flex',
    justifyContent: 'center',
    backgroundColor: '#fafafa',
    borderBottom: '1px solid #e5e5e5'
  },
  statusBadge: {
    padding: '0.5rem 1.25rem',
    borderRadius: '9999px',
    fontSize: '0.875rem',
    fontWeight: '600',
    border: '2px solid'
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: '1.5rem'
  },
  section: {
    marginBottom: '2rem'
  },
  sectionTitle: {
    fontSize: '1.1rem',
    fontWeight: '600',
    color: '#333',
    marginBottom: '1rem',
    paddingBottom: '0.5rem',
    borderBottom: '2px solid #e5e5e5',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem'
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '1rem'
  },
  infoItem: {
    display: 'flex',
    flexDirection: 'column'
  },
  label: {
    fontSize: '0.75rem',
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '0.25rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem'
  },
  icon: {
    fontSize: '1rem'
  },
  value: {
    fontSize: '0.95rem',
    color: '#1c1b1a',
    margin: 0,
    fontWeight: '500'
  },
  highlightValue: {
    color: '#059669',
    fontWeight: '600',
    fontSize: '1rem'
  },
  notesContainer: {
    marginTop: '1rem',
    padding: '1rem',
    backgroundColor: '#eff6ff',
    borderRadius: '8px',
    border: '1px solid #bfdbfe'
  },
  notesLabel: {
    fontSize: '0.875rem',
    fontWeight: '600',
    color: '#1e40af',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: '0.5rem'
  },
  notesIcon: {
    fontSize: '1.2rem'
  },
  notes: {
    fontSize: '0.95rem',
    color: '#1e3a8a',
    margin: 0,
    lineHeight: '1.6',
    whiteSpace: 'pre-wrap'
  },
  actions: {
    display: 'flex',
    gap: '0.75rem',
    padding: '1.5rem',
    borderTop: '1px solid #e5e5e5',
    backgroundColor: '#fafafa',
    flexWrap: 'wrap'
  },
  acceptBtn: {
    flex: '1',
    minWidth: '150px',
    padding: '0.875rem 1.5rem',
    backgroundColor: '#16a34a',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '1rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  rejectBtn: {
    flex: '1',
    minWidth: '150px',
    padding: '0.875rem 1.5rem',
    backgroundColor: '#dc2626',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '1rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  cancelBtn: {
    flex: '1',
    minWidth: '150px',
    padding: '0.875rem 1.5rem',
    backgroundColor: '#dc2626',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '1rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  closeActionBtn: {
    flex: '1',
    minWidth: '150px',
    padding: '0.875rem 1.5rem',
    backgroundColor: 'white',
    color: '#666',
    border: '1px solid #ddd',
    borderRadius: '8px',
    fontSize: '1rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s'
  }
};