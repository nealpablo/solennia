// Global toast notification utility
let toastContainer = null;

// Initialize toast container
function initToastContainer() {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'global-toast-container';
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
    .toast-container {
      position: fixed;
      top: 1.5rem;
      right: 1.5rem;
      z-index: 9999;
      pointer-events: none;
    }

    .toast {
      background: #fff;
      border-radius: 0.5rem;
      padding: 1rem 1.5rem;
      box-shadow: 0 10px 30px rgba(0,0,0,.2);
      font-size: 0.875rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
      animation: slideInRight 0.3s ease-out;
      pointer-events: auto;
      min-width: 300px;
      max-width: 500px;
    }

    .toast.success {
      background: #7a5d47;
      color: #fff;
      border-left: 4px solid #5a4333;
    }

    .toast.error {
      background: #dc2626;
      color: #fff;
      border-left: 4px solid #991b1b;
    }

    .toast.warning {
      background: #f59e0b;
      color: #fff;
      border-left: 4px solid #d97706;
    }

    .toast.info {
      background: #3b82f6;
      color: #fff;
      border-left: 4px solid #2563eb;
    }

    @keyframes slideInRight {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }

    @keyframes slideOutRight {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(100%);
        opacity: 0;
      }
    }

    .toast.hiding {
      animation: slideOutRight 0.3s ease-in forwards;
    }
  `;
  document.head.appendChild(style);
}

// Show toast notification
export function showToast(message, type = 'info', duration = 2300) {
  addToastStyles();
  const container = initToastContainer();
  
  // Create toast element
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  
  // Wrap in container for positioning
  const wrapper = document.createElement('div');
  wrapper.className = 'toast-container';
  wrapper.appendChild(toast);
  
  container.appendChild(wrapper);
  
  // Remove toast after duration
  setTimeout(() => {
    toast.classList.add('hiding');
    setTimeout(() => {
      wrapper.remove();
    }, 300);
  }, duration);
}

// Convenience methods
export const toast = {
  success: (message, duration) => showToast(message, 'success', duration),
  error: (message, duration) => showToast(message, 'error', duration),
  warning: (message, duration) => showToast(message, 'warning', duration),
  info: (message, duration) => showToast(message, 'info', duration),
};

export default toast;