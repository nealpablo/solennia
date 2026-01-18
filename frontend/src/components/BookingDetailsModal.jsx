import React from 'react';

/**
 * BookingDetailsModal Component
 * Displays complete booking information for both clients and vendors
 * Shows different views based on user role
 */
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

  // Format date
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
            <h3 style={styles.sectionTitle}>Service Information</h3>
            <div style={styles.infoGrid}>
              <InfoItem 
                label="Service" 
                value={booking.ServiceName || 'Not specified'} 
              />
              <InfoItem 
                label="Event Type" 
                value={booking.EventType || 'Not specified'} 
              />
              <InfoItem 
                label="Package Selected" 
                value={booking.PackageSelected || 'Not specified'} 
              />
              <InfoItem 
                label="Total Amount" 
                value={booking.TotalAmount ? `₱${parseFloat(booking.TotalAmount).toLocaleString()}` : 'Not specified'} 
              />
            </div>
          </section>

          {/* Event Details */}
          <section style={styles.section}>
            <h3 style={styles.sectionTitle}>Event Details</h3>
            <div style={styles.infoGrid}>
              <InfoItem 
                label="Event Date" 
                value={formatDate(booking.EventDate)} 
              />
              <InfoItem 
                label="Event Location" 
                value={booking.EventLocation || 'Not specified'} 
              />
            </div>
            {booking.AdditionalNotes && (
              <div style={styles.notesContainer}>
                <label style={styles.label}>Additional Notes:</label>
                <p style={styles.notes}>{booking.AdditionalNotes}</p>
              </div>
            )}
          </section>

          {/* Client Information (Vendor View) */}
          {isVendor && (
            <section style={styles.section}>
              <h3 style={styles.sectionTitle}>Client Information</h3>
              <div style={styles.infoGrid}>
                <InfoItem 
                  label="Client Name" 
                  value={booking.client_name || booking.client_first_name + ' ' + booking.client_last_name || 'Not available'} 
                />
                <InfoItem 
                  label="Email" 
                  value={booking.client_email || 'Not available'} 
                />
                {booking.client_phone && (
                  <InfoItem 
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
              <h3 style={styles.sectionTitle}>Vendor Information</h3>
              <div style={styles.infoGrid}>
                <InfoItem 
                  label="Business Name" 
                  value={booking.vendor_business_name || booking.vendor_name || 'Not available'} 
                />
                <InfoItem 
                  label="Contact Email" 
                  value={booking.vendor_email || 'Not available'} 
                />
              </div>
            </section>
          )}

          {/* Booking Metadata */}
          <section style={styles.section}>
            <h3 style={styles.sectionTitle}>Booking Information</h3>
            <div style={styles.infoGrid}>
              <InfoItem 
                label="Booking ID" 
                value={`#${booking.ID}`} 
              />
              <InfoItem 
                label="Booked On" 
                value={formatDate(booking.CreatedAt)} 
              />
              {booking.UpdatedAt && booking.UpdatedAt !== booking.CreatedAt && (
                <InfoItem 
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
                {processing ? 'Processing...' : 'Accept Booking'}
              </button>
              <button
                style={styles.rejectBtn}
                onClick={() => onReject(booking.ID)}
                disabled={processing}
              >
                {processing ? 'Processing...' : 'Reject Booking'}
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
              {processing ? 'Processing...' : 'Cancel Booking'}
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
 * Displays a label-value pair
 */
function InfoItem({ label, value }) {
  return (
    <div style={styles.infoItem}>
      <label style={styles.label}>{label}</label>
      <p style={styles.value}>{value}</p>
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
    borderBottom: '2px solid #e5e5e5'
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
    marginBottom: '0.25rem'
  },
  value: {
    fontSize: '0.95rem',
    color: '#1c1b1a',
    margin: 0,
    fontWeight: '500'
  },
  notesContainer: {
    marginTop: '1rem',
    padding: '1rem',
    backgroundColor: '#f9f9f9',
    borderRadius: '8px',
    border: '1px solid #e5e5e5'
  },
  notes: {
    fontSize: '0.95rem',
    color: '#333',
    margin: '0.5rem 0 0 0',
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