// src/utils/api.js
//  Optimized API utility with timeout, retry logic, and error handling

const API = 
  import.meta.env.VITE_API_BASE || 
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD 
    ? "https://solennia.up.railway.app/api" : "/api");

/**
 *  Fetch with timeout support
 * @param {string} url - The URL to fetch
 * @param {object} options - Fetch options
 * @param {number} timeout - Timeout in milliseconds (default: 15000)
 * @returns {Promise<Response>}
 */
const fetchWithTimeout = (url, options = {}, timeout = 15000) => {
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    const signal = controller.signal;

    // Set timeout
    const timeoutId = setTimeout(() => {
      controller.abort();
      reject(new Error(`Request timeout after ${timeout}ms`));
    }, timeout);

    // Make fetch request
    fetch(url, { ...options, signal })
      .then(response => {
        clearTimeout(timeoutId);
        resolve(response);
      })
      .catch(error => {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          reject(new Error('Request was aborted due to timeout'));
        } else {
          reject(error);
        }
      });
  });
};

/**
 *  Fetch with retry logic
 * @param {string} url - The URL to fetch
 * @param {object} options - Fetch options
 * @param {number} retries - Number of retries (default: 2)
 * @param {number} timeout - Timeout in milliseconds (default: 15000)
 * @returns {Promise<Response>}
 */
const fetchWithRetry = async (url, options = {}, retries = 2, timeout = 15000) => {
  let lastError;
  
  for (let i = 0; i <= retries; i++) {
    try {
      const response = await fetchWithTimeout(url, options, timeout);
      
      // If server error (5xx), retry
      if (response.status >= 500 && i < retries) {
        console.warn(`Server error ${response.status}, retrying... (${i + 1}/${retries})`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Exponential backoff
        continue;
      }
      
      return response;
    } catch (error) {
      lastError = error;
      
      if (i < retries) {
        console.warn(`Request failed, retrying... (${i + 1}/${retries})`, error.message);
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Exponential backoff
      }
    }
  }
  
  throw lastError;
};

/**
 *  GET request with timeout and retry
 * @param {string} endpoint - API endpoint (e.g., '/auth/me')
 * @param {object} headers - Additional headers
 * @param {number} timeout - Timeout in milliseconds (default: 15000)
 * @returns {Promise<object>}
 */
export const apiGet = async (endpoint, headers = {}, timeout = 15000) => {
  const token = localStorage.getItem('solennia_token');
  
  const defaultHeaders = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...headers,
  };
  
  try {
    const response = await fetchWithRetry(
      `${API}${endpoint}`,
      {
        method: 'GET',
        headers: defaultHeaders,
      },
      2,
      timeout
    );
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || error.message || `HTTP ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`API GET ${endpoint} failed:`, error);
    throw error;
  }
};

/**
 *  POST request with timeout and retry
 * @param {string} endpoint - API endpoint
 * @param {object} data - Request body
 * @param {object} headers - Additional headers
 * @param {number} timeout - Timeout in milliseconds (default: 20000)
 * @returns {Promise<object>}
 */
export const apiPost = async (endpoint, data = {}, headers = {}, timeout = 20000) => {
  const token = localStorage.getItem('solennia_token');
  
  const defaultHeaders = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...headers,
  };
  
  try {
    const response = await fetchWithRetry(
      `${API}${endpoint}`,
      {
        method: 'POST',
        headers: defaultHeaders,
        body: JSON.stringify(data),
      },
      1, // Only 1 retry for POST to avoid duplicate submissions
      timeout
    );
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || error.message || `HTTP ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`API POST ${endpoint} failed:`, error);
    throw error;
  }
};

/**
 *  PUT request with timeout and retry
 * @param {string} endpoint - API endpoint
 * @param {object} data - Request body
 * @param {object} headers - Additional headers
 * @param {number} timeout - Timeout in milliseconds (default: 20000)
 * @returns {Promise<object>}
 */
export const apiPut = async (endpoint, data = {}, headers = {}, timeout = 20000) => {
  const token = localStorage.getItem('solennia_token');
  
  const defaultHeaders = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...headers,
  };
  
  try {
    const response = await fetchWithRetry(
      `${API}${endpoint}`,
      {
        method: 'PUT',
        headers: defaultHeaders,
        body: JSON.stringify(data),
      },
      1,
      timeout
    );
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || error.message || `HTTP ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`API PUT ${endpoint} failed:`, error);
    throw error;
  }
};

/**
 *  DELETE request with timeout and retry
 * @param {string} endpoint - API endpoint
 * @param {object} headers - Additional headers
 * @param {number} timeout - Timeout in milliseconds (default: 15000)
 * @returns {Promise<object>}
 */
export const apiDelete = async (endpoint, headers = {}, timeout = 15000) => {
  const token = localStorage.getItem('solennia_token');
  
  const defaultHeaders = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...headers,
  };
  
  try {
    const response = await fetchWithRetry(
      `${API}${endpoint}`,
      {
        method: 'DELETE',
        headers: defaultHeaders,
      },
      1,
      timeout
    );
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || error.message || `HTTP ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`API DELETE ${endpoint} failed:`, error);
    throw error;
  }
};

/**
 *  Upload file with progress tracking and timeout
 * @param {string} endpoint - API endpoint
 * @param {FormData} formData - Form data with files
 * @param {Function} onProgress - Progress callback (0-100)
 * @param {number} timeout - Timeout in milliseconds (default: 30000)
 * @returns {Promise<object>}
 */
export const apiUpload = async (endpoint, formData, onProgress = null, timeout = 30000) => {
  const token = localStorage.getItem('solennia_token');
  
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    
    // Set timeout
    const timeoutId = setTimeout(() => {
      xhr.abort();
      reject(new Error(`Upload timeout after ${timeout}ms`));
    }, timeout);
    
    // Progress tracking
    if (onProgress) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100;
          onProgress(Math.round(percentComplete));
        }
      });
    }
    
    // Handle completion
    xhr.addEventListener('load', () => {
      clearTimeout(timeoutId);
      
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          resolve(response);
        } catch (error) {
          reject(new Error('Failed to parse response'));
        }
      } else {
        try {
          const error = JSON.parse(xhr.responseText);
          reject(new Error(error.error || error.message || `HTTP ${xhr.status}`));
        } catch {
          reject(new Error(`HTTP ${xhr.status}`));
        }
      }
    });
    
    // Handle errors
    xhr.addEventListener('error', () => {
      clearTimeout(timeoutId);
      reject(new Error('Network error'));
    });
    
    xhr.addEventListener('abort', () => {
      clearTimeout(timeoutId);
      reject(new Error('Upload aborted'));
    });
    
    // Open and send
    xhr.open('POST', `${API}${endpoint}`);
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }
    xhr.send(formData);
  });
};

/**
 *  Validate file before upload
 * @param {File} file - File to validate
 * @param {number} maxSize - Max size in bytes (default: 10MB)
 * @param {string[]} allowedTypes - Allowed MIME types
 * @returns {object} - { valid: boolean, error: string }
 */
export const validateFile = (file, maxSize = 10485760, allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp']) => {
  if (!file) {
    return { valid: false, error: 'No file provided' };
  }
  
  if (file.size > maxSize) {
    const maxSizeMB = Math.round(maxSize / 1048576);
    return { valid: false, error: `File too large (max ${maxSizeMB}MB)` };
  }
  
  if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
    return { valid: false, error: 'Invalid file type' };
  }
  
  return { valid: true };
};

// Export the base API URL
export { API };

export default {
  get: apiGet,
  post: apiPost,
  put: apiPut,
  delete: apiDelete,
  upload: apiUpload,
  validateFile,
};