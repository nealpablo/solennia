// Global toast notification utility
let toastContainer = null;

// Initialize toast container
function initToastContainer() {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'global-toast-container';
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

// Add toast styles to document
function addToastStyles() {
  if (document.getElementById('global-toast-styles')) return;
  
  const style = document.createElement('style');
  style.id = 'global-toast-styles';
  style.textContent = `
    #global-toast-container.toast-container {
      position: fixed;
      top: 1.5rem;
      left: 50%;
      transform: translateX(-50%);
      z-index: 9999;
      pointer-events: none;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      max-width: 90vw;
    }

    .toast {
      background: #10b981;
      color: #ffffff;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-radius: 0.5rem;
      padding: 0.875rem 1.75rem;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
      font-size: 0.9375rem;
      font-weight: 600;
      animation: slideInDown 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
      pointer-events: auto;
      min-width: 300px;
      max-width: 600px;
      text-align: center;
      letter-spacing: 0.01em;
    }

    .toast.success {
      background: #10b981;
      border-color: rgba(255, 255, 255, 0.3);
    }

    .toast.error {
      background: #ef4444;
      border-color: rgba(255, 255, 255, 0.3);
    }

    .toast.fail {
      background: #ef4444;
      border-color: rgba(255, 255, 255, 0.3);
    }

    .toast.warning {
      background: #f59e0b;
      border-color: rgba(255, 255, 255, 0.3);
    }

    .toast.info {
      background: #3b82f6;
      border-color: rgba(255, 255, 255, 0.3);
    }

    @keyframes slideInDown {
      from {
        transform: translateY(-100%);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }

    @keyframes slideOutUp {
      from {
        transform: translateY(0);
        opacity: 1;
      }
      to {
        transform: translateY(-100%);
        opacity: 0;
      }
    }

    .toast.hiding {
      animation: slideOutUp 0.3s ease-in forwards;
    }

    @media (max-width: 640px) {
      .toast {
        min-width: 280px;
        font-size: 0.875rem;
        padding: 0.75rem 1.5rem;
      }
    }
  `;
  document.head.appendChild(style);
}

// Show toast notification
export function showToast(message, type = 'info', duration = 3000) {
  addToastStyles();
  const container = initToastContainer();
  
  // Create toast element
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  
  container.appendChild(toast);
  
  // Remove toast after duration
  setTimeout(() => {
    toast.classList.add('hiding');
    setTimeout(() => {
      toast.remove();
      // Clean up container if empty
      if (container.children.length === 0) {
        container.remove();
        toastContainer = null;
      }
    }, 300);
  }, duration);
}

// Convenience methods
export const toast = {
  success: (message, duration) => showToast(message, 'success', duration),
  error: (message, duration) => showToast(message, 'error', duration),
  fail: (message, duration) => showToast(message, 'fail', duration),
  warning: (message, duration) => showToast(message, 'warning', duration),
  info: (message, duration) => showToast(message, 'info', duration),
};

export default toast;