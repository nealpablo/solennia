import React from "react";
import { Link } from "react-router-dom";

export default function Footer() {

  /* =========================
     MODAL HANDLERS
  ========================= */
  const openModal = (id) => (e) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) el.classList.remove("hidden");
  };

  return (
    <footer style={styles.footer}>
      {/* Top Section */}
      <div style={styles.topSection}>
        <div style={styles.container}>
          <div style={styles.grid}>

            {/* Brand Column */}
            <div style={styles.brandColumn}>
              <div style={styles.logoRow}>
                <img
                  src="/images/solennia.png"
                  alt="Solennia logo"
                  style={styles.logo}
                />
                <span style={styles.brandName}>SOLENNIA</span>
              </div>
              <p style={styles.tagline}>
                "One click closer to the perfect event."
              </p>
              <div style={styles.contactRow}>
                <svg style={styles.contactIcon} viewBox="0 0 20 20" fill="currentColor">
                  <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                  <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                </svg>
                <a href="mailto:solenniainquires@gmail.com" style={styles.contactLink}>
                  solenniainquires@gmail.com
                </a>
              </div>
            </div>

            {/* Quick Links Column */}
            <div style={styles.linksColumn}>
              <h4 style={styles.columnTitle}>Quick Links</h4>
              <ul style={styles.linkList}>
                <li>
                  <Link to="/venue" style={styles.link}>
                    Venues
                  </Link>
                </li>
                <li>
                  <Link to="/vendors" style={styles.link}>
                    Suppliers
                  </Link>
                </li>
                <li>
                  <Link to="/ai-booking" style={styles.link}>
                    Solennia AI
                  </Link>
                </li>
                <li>
                  <Link to="/about" style={styles.link}>
                    About Us
                  </Link>
                </li>
              </ul>
            </div>

            {/* Legal Column */}
            <div style={styles.linksColumn}>
              <h4 style={styles.columnTitle}>Legal</h4>
              <ul style={styles.linkList}>
                <li>
                  <button onClick={openModal("privacyModal")} style={styles.linkButton}>
                    Privacy Policy
                  </button>
                </li>
                <li>
                  <button onClick={openModal("termsModal")} style={styles.linkButton}>
                    Terms & Conditions
                  </button>
                </li>
                <li>
                  <button onClick={openModal("feedbackModal")} style={styles.linkButton}>
                    Give Feedback
                  </button>
                </li>
              </ul>
            </div>

          </div>
        </div>
      </div>

      {/* Divider */}
      <div style={styles.divider} />

      {/* Bottom Bar */}
      <div style={styles.bottomBar}>
        <div style={styles.container}>
          <div style={styles.bottomContent}>
            <p style={styles.copyright}>
              © 2025 Solennia. All rights reserved.
            </p>
            <div style={styles.socialRow}>
              {/* Facebook */}
              <a href="https://www.facebook.com/profile.php?id=61576574033297" target="_blank" rel="noopener noreferrer" style={styles.socialLink} aria-label="Facebook">
                <svg style={styles.socialIcon} viewBox="0 0 24 24" fill="currentColor">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>
      {/* Hover & responsive styles */}
      <style>{`
        footer a:hover, footer button:hover {
          color: #f2e7c6 !important;
        }
        footer a[aria-label]:hover {
          background: rgba(232, 221, 174, 0.15) !important;
          border-color: rgba(232, 221, 174, 0.3) !important;
        }
        @media (max-width: 768px) {
          footer > div:first-child > div > div {
            grid-template-columns: 1fr !important;
            gap: 28px !important;
          }
          footer > div:last-child > div > div {
            flex-direction: column !important;
            align-items: center !important;
            gap: 12px !important;
            text-align: center;
          }
        }
      `}</style>
    </footer>
  );
}

/* ─── Styles ─── */
const styles = {
  footer: {
    background: '#353946',
    color: '#e8ddae',
  },
  container: {
    maxWidth: '1152px',
    margin: '0 auto',
    padding: '0 32px',
  },
  topSection: {
    padding: '40px 0 24px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1.5fr 1fr 1fr',
    gap: '40px',
    alignItems: 'start',
  },
  brandColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  logoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  logo: {
    height: '48px',
    width: 'auto',
    userSelect: 'none',
  },
  brandName: {
    fontSize: '20px',
    fontWeight: '700',
    letterSpacing: '0.15em',
    color: '#e8ddae',
  },
  tagline: {
    fontSize: '13px',
    color: '#a9a08a',
    fontStyle: 'italic',
    lineHeight: '1.5',
    margin: 0,
  },
  contactRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginTop: '4px',
  },
  contactIcon: {
    width: '16px',
    height: '16px',
    color: '#7a5d47',
    flexShrink: 0,
  },
  contactLink: {
    fontSize: '13px',
    color: '#c9bda4',
    textDecoration: 'none',
    transition: 'color 0.2s',
  },
  linksColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  columnTitle: {
    fontSize: '11px',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '0.2em',
    color: '#e8ddae',
    margin: 0,
    paddingBottom: '4px',
    borderBottom: '2px solid #7a5d47',
    display: 'inline-block',
  },
  linkList: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  link: {
    fontSize: '13px',
    color: '#c9bda4',
    textDecoration: 'none',
    transition: 'color 0.2s',
    letterSpacing: '0.05em',
  },
  linkButton: {
    fontSize: '13px',
    color: '#c9bda4',
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'color 0.2s',
    letterSpacing: '0.05em',
    fontFamily: 'inherit',
  },
  divider: {
    height: '1px',
    background: 'linear-gradient(90deg, transparent 0%, #5a5e6e 50%, transparent 100%)',
    margin: '0 32px',
  },
  bottomBar: {
    padding: '16px 0',
  },
  bottomContent: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  copyright: {
    fontSize: '12px',
    color: '#7a7d8a',
    margin: 0,
  },
  socialRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  socialLink: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    background: 'rgba(232, 221, 174, 0.08)',
    border: '1px solid rgba(232, 221, 174, 0.15)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s',
    textDecoration: 'none',
  },
  socialIcon: {
    width: '14px',
    height: '14px',
    color: '#c9bda4',
  },
};
