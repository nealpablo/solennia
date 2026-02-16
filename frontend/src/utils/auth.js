/**
 * Authentication Utilities
 * Helper functions for JWT token validation and parsing
 */

/**
 * Parse JWT token payload
 * @param {string} token - JWT token string
 * @returns {object|null} - Decoded payload or null if invalid
 */
export function parseJwtPayload(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = parts[1];
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded);
  } catch (e) {
    console.error('Failed to parse JWT:', e);
    return null;
  }
}

/**
 * Check if JWT token is expired
 * @param {string} token - JWT token string
 * @returns {boolean} - True if expired or invalid, false otherwise
 */
export function tokenExpired(token) {
  if (!token || typeof token !== 'string') return true;

  const payload = parseJwtPayload(token);
  if (!payload || !payload.exp) return true;

  // Token is expired if exp time has passed
  return payload.exp * 1000 < Date.now();
}

/**
 * Get user ID from JWT token
 * @param {string} token - JWT token string
 * @returns {number|null} - User ID or null if invalid
 */
export function getUserIdFromToken(token) {
  const payload = parseJwtPayload(token);
  return payload?.mysql_id || payload?.user_id || payload?.sub || null;
}

/**
 * Get user role from JWT token
 * @param {string} token - JWT token string
 * @returns {number|null} - User role or null if invalid
 */
export function getUserRoleFromToken(token) {
  const payload = parseJwtPayload(token);
  return payload?.role ?? null;
}

/**
 * Check if user is authenticated (has valid, non-expired token)
 * @returns {boolean} - True if authenticated, false otherwise
 */
export function isAuthenticated() {
  const token = localStorage.getItem('solennia_token');
  return token && !tokenExpired(token);
}

/**
 * Get stored auth token from localStorage
 * @returns {string|null} - Token or null
 */
export function getAuthToken() {
  return localStorage.getItem('solennia_token');
}

/**
 * Clear all authentication data from localStorage
 */
export function clearAuth() {
  localStorage.removeItem('solennia_token');
  localStorage.removeItem('solennia_profile');
  localStorage.removeItem('solennia_role');
}
