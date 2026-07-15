import axios from 'axios';

// Build-time default. For the packaged desktop (Tauri) app the operator points
// the client at their server via a runtime override stored in localStorage —
// see getApiBaseUrl / setApiBaseUrl below. Falls back to the env var, then
// localhost for dev. See docs/OFFLINE_FIRST_ARCHITECTURE.md.
const DEFAULT_API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
const API_URL_KEY = 'cca.apiBaseUrl';

export const getApiBaseUrl = () => {
  try {
    const override = localStorage.getItem(API_URL_KEY);
    if (override) return override;
  } catch (_) { /* non-browser context */ }
  return DEFAULT_API_URL;
};

// Persist a new backend URL (e.g. from a desktop "Server settings" screen) and
// apply it to the live axios instance. Pass a falsy value to clear the override.
export const setApiBaseUrl = (url) => {
  const clean = String(url || '').trim().replace(/\/+$/, '');
  if (clean) {
    localStorage.setItem(API_URL_KEY, clean);
    api.defaults.baseURL = clean;
  } else {
    localStorage.removeItem(API_URL_KEY);
    api.defaults.baseURL = DEFAULT_API_URL;
  }
  return getApiBaseUrl();
};

const API_BASE_URL = getApiBaseUrl();

// Render free-tier instances sleep after ~15 min idle. The first request after
// sleep can take 30–60 s while gunicorn cold-starts, during which Render's
// edge returns 503. Use a long timeout + automatic retry on the cold-start
// status codes so users don't see a hard failure on the first visit.
const COLD_START_TIMEOUT_MS = 90_000;
const RETRY_STATUSES = new Set([502, 503, 504]);
const MAX_RETRIES = 3;
const RETRY_BACKOFF_MS = 3000;

// Helper to get CSRF token from cookies (needed for cross-domain requests on Render)
const getCookie = (name) => {
  let cookieValue = null;
  if (document.cookie && document.cookie !== '') {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.substring(0, name.length + 1) === `${name}=`) {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
};

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: COLD_START_TIMEOUT_MS,
  withCredentials: true,  // Required for CORS with auth tokens
  headers: {
    'Content-Type': 'application/json',
  },
});

// Fire-and-forget wake-up ping. Called once when the SPA mounts so the
// backend has a head start on cold-booting before the user clicks anything.
let wakePromise = null;
export const wakeBackend = () => {
  if (wakePromise) return wakePromise;
  wakePromise = axios
    .get(`${getApiBaseUrl().replace(/\/api\/?$/, '')}/health/`, { timeout: COLD_START_TIMEOUT_MS })
    .catch(() => null);
  return wakePromise;
};

// Add request interceptor to include auth token and CSRF token.
// DRF TokenAuthentication expects "Token <key>", not "Bearer <key>".
// CSRF token is needed for cross-domain requests (required on Render deployment).
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token && !token.startsWith('demo-token-')) {
      config.headers.Authorization = `Token ${token}`;
    }

    // The instance defaults to `Content-Type: application/json`. For multipart
    // uploads (passport photos / signatures, and staff-with-files), that default
    // would send the FormData body with the wrong content-type and NO boundary,
    // so the server can't read the file — the image silently never saves.
    // Drop the header for FormData bodies so the browser sets
    // `multipart/form-data; boundary=…` itself.
    if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
      if (config.headers && typeof config.headers.delete === 'function') {
        config.headers.delete('Content-Type');
      } else if (config.headers) {
        delete config.headers['Content-Type'];
      }
    }

    // Add CSRF token if available (for cross-domain requests on Render)
    const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]')?.value 
      || getCookie('csrftoken');
    if (csrfToken && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(config.method.toUpperCase())) {
      config.headers['X-CSRFToken'] = csrfToken;
    }
    
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: retry on cold-start statuses, force-logout on 401
// from auth-critical endpoints. Background polls (notifications, etc.)
// hitting 401 must NOT log the user out — they may simply mean the backend
// is offline or the endpoint isn't ready.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status;
    const config = error.config || {};
    const url = config.url || '';

    // Cold-start / transient gateway errors → retry with backoff.
    const isNetworkOrTimeout = !error.response && (error.code === 'ECONNABORTED' || error.message === 'Network Error');
    if ((status && RETRY_STATUSES.has(status)) || isNetworkOrTimeout) {
      config.__retryCount = (config.__retryCount || 0) + 1;
      if (config.__retryCount <= MAX_RETRIES) {
        const delay = RETRY_BACKOFF_MS * config.__retryCount;
        await new Promise((r) => setTimeout(r, delay));
        return api(config);
      }
    }

    // A 401 with a response body means the server actively rejected our
    // credentials — most commonly DRF's "Invalid token." when the stored token
    // was rotated out (e.g. the same account signed in on another device, or a
    // password reset). This is distinct from an offline/cold-start failure,
    // which arrives as a network error with no `error.response`. When the token
    // is genuinely bad, no authenticated request can succeed, so clear the
    // session and send the user back to sign in for a fresh token — rather than
    // surfacing a confusing "Invalid token" message on pages like User
    // Management that call protected endpoints directly.
    const detail = String(error.response?.data?.detail || '').toLowerCase();
    const isAuthEndpoint = url.includes('/accounts/me/') || url.includes('/accounts/login/');
    const isBadToken = detail.includes('invalid token')
      || detail.includes('token has expired')
      || detail.includes('token expired')
      || detail.includes('invalid or expired token');
    if (status === 401 && (isAuthEndpoint || isBadToken)) {
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Authentication API
export const authAPI = {
  login: (identifier, password) =>
    api.post('/accounts/login/', { username: identifier, email: identifier, password }),
  logout: () =>
    api.post('/accounts/logout/'),
  changePassword: (oldPassword, newPassword) =>
    api.post('/accounts/change-password/', { old_password: oldPassword, new_password: newPassword }),
  getCurrentUser: () =>
    api.get('/accounts/me/'),
};

// Pass-through config used by staffAPI.create/update so file uploads work.
// When the body is a FormData instance, axios must let the browser set the
// Content-Type (it needs to include the multipart boundary). Our axios
// instance defaults to application/json, which would otherwise block that.
const multipartConfig = (data) => (
  data instanceof FormData
    ? { headers: { 'Content-Type': 'multipart/form-data' } }
    : undefined
);

// Staff API
export const staffAPI = {
  list: (params = {}) =>
    api.get('/staff/', { params }),
  create: (data) =>
    api.post('/staff/', data, multipartConfig(data)),
  retrieve: (id) =>
    api.get(`/staff/${id}/`),
  update: (id, data) =>
    api.put(`/staff/${id}/`, data, multipartConfig(data)),
  partialUpdate: (id, data) =>
    api.patch(`/staff/${id}/`, data, multipartConfig(data)),
  delete: (id) =>
    api.delete(`/staff/${id}/`),
  bulkDelete: (ids) =>
    api.post('/staff/bulk-delete/', { ids }),
  // Lookup endpoints used by AddStaff/StaffDetail to resolve names → FK PKs.
  listDepartments: (params = {}) => api.get('/staff/departments/', { params }),
  listDesignations: (params = {}) => api.get('/staff/designations/', { params }),
  listGradeLevels: (params = {}) => api.get('/staff/grade-levels/', { params }),
  listPostingLocations: (params = {}) => api.get('/staff/posting-locations/', { params }),
  createDepartment: (data) => api.post('/staff/departments/', data),
  createDesignation: (data) => api.post('/staff/designations/', data),
  dueForPromotion: (params = {}) =>
    api.get('/staff/due-for-promotion/', { params }),
  dueForRetirement: (params = {}) =>
    api.get('/staff/due-for-retirement/', { params }),
  promote: (id, data) =>
    api.post(`/staff/${id}/promote/`, data),
};

// Designation API — backs the shared designation picker. Points at the
// canonical /api/staff/designations/ route registered by staff.api_urls so
// we only ever have one URL serving each resource (the old /api/designations/
// mount was removed to eliminate divergence).
// The serializer's field is `title`; we accept both `title` and `name` for
// backwards-compat with callers that pass either.
export const designationAPI = {
  list: () => api.get('/staff/designations/'),
  create: (name) => api.post('/staff/designations/', { title: name }),
  update: (id, name) => api.patch(`/staff/designations/${id}/`, { title: name }),
  delete: (id) => api.delete(`/staff/designations/${id}/`),
};

// Department API — same story, points at /api/staff/departments/.
export const departmentAPI = {
  list: (params = {}) => api.get('/staff/departments/', { params }),
  create: (data) => api.post('/staff/departments/', data),
  retrieve: (id) => api.get(`/staff/departments/${id}/`),
  update: (id, data) => api.put(`/staff/departments/${id}/`, data),
  delete: (id) => api.delete(`/staff/departments/${id}/`),
};

// User API — points at the real Django UserViewSet at
// /api/accounts/users/. Only the Super Admin role can use these endpoints
// (IsSuperAdmin enforced server-side).
export const userAPI = {
  list: (params = {}) =>
    api.get('/accounts/users/', { params }),
  create: (data) =>
    api.post('/accounts/users/', data),
  retrieve: (id) =>
    api.get(`/accounts/users/${id}/`),
  update: (id, data) =>
    api.patch(`/accounts/users/${id}/`, data),
  delete: (id) =>
    api.delete(`/accounts/users/${id}/`),
  resetPassword: (id) =>
    api.post(`/accounts/users/${id}/reset-password/`),
};

// Audit Log API
export const auditAPI = {
  list: (params = {}) =>
    api.get('/audit-logs/', { params }),
  retrieve: (id) =>
    api.get(`/audit-logs/${id}/`),
  byStaff: (staffId, params = {}) =>
    api.get(`/audit-logs/staff/${staffId}/`, { params }),
  byUser: (userId, params = {}) =>
    api.get(`/audit-logs/user/${userId}/`, { params }),
};

// Notifications API
export const notificationAPI = {
  // Bell dropdown: recent N + unread total in a single round-trip.
  recent: (limit = 10) =>
    api.get('/notifications/', { params: { limit } }),
  // Full list page; supports type, is_read, date_from, date_to, page.
  list: (params = {}) =>
    api.get('/notifications/', { params }),
  unreadCount: () =>
    api.get('/notifications/unread-count/'),
  markRead: (id) =>
    api.post(`/notifications/${id}/read/`),
  markAllRead: () =>
    api.post('/notifications/mark-all-read/'),
};

// Reports API
export const reportAPI = {
  staffSummary: () =>
    api.get('/reports/staff-summary/'),
  retirementForecast: () =>
    api.get('/reports/retirement-forecast/'),
  promotionHistory: () =>
    api.get('/reports/promotion-history/'),
  exportStaff: (format = 'csv') =>
    api.get(`/reports/export-staff/?format=${format}`),
};

export default api;
