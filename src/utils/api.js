import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

// Render free-tier instances sleep after ~15 min idle. The first request after
// sleep can take 30–60 s while gunicorn cold-starts, during which Render's
// edge returns 503. Use a long timeout + automatic retry on the cold-start
// status codes so users don't see a hard failure on the first visit.
const COLD_START_TIMEOUT_MS = 90_000;
const RETRY_STATUSES = new Set([502, 503, 504]);
const MAX_RETRIES = 3;
const RETRY_BACKOFF_MS = 3000;

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: COLD_START_TIMEOUT_MS,
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
    .get(`${API_BASE_URL.replace(/\/api\/?$/, '')}/health/`, { timeout: COLD_START_TIMEOUT_MS })
    .catch(() => null);
  return wakePromise;
};

// Add request interceptor to include auth token.
// DRF TokenAuthentication expects "Token <key>", not "Bearer <key>".
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token && !token.startsWith('demo-token-')) {
      config.headers.Authorization = `Token ${token}`;
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

    const isAuthEndpoint = url.includes('/accounts/me/') || url.includes('/accounts/login/');
    if (status === 401 && isAuthEndpoint) {
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
  dueForPromotion: (params = {}) =>
    api.get('/staff/due-for-promotion/', { params }),
  dueForRetirement: (params = {}) =>
    api.get('/staff/due-for-retirement/', { params }),
  promote: (id, data) =>
    api.post(`/staff/${id}/promote/`, data),
};

// Designation API
// Backs the shared designation picker. Read endpoints require login;
// writes require Super Admin / Admin Staff (enforced server-side).
export const designationAPI = {
  list: () => api.get('/designations/'),
  create: (name) => api.post('/designations/', { name }),
  update: (id, name) => api.patch(`/designations/${id}/`, { name }),
  delete: (id) => api.delete(`/designations/${id}/`),
};

// Department API
export const departmentAPI = {
  list: (params = {}) =>
    api.get('/departments/', { params }),
  create: (data) =>
    api.post('/departments/', data),
  retrieve: (id) =>
    api.get(`/departments/${id}/`),
  update: (id, data) =>
    api.put(`/departments/${id}/`, data),
  delete: (id) =>
    api.delete(`/departments/${id}/`),
};

// User API
export const userAPI = {
  list: (params = {}) =>
    api.get('/users/', { params }),
  create: (data) =>
    api.post('/users/', data),
  retrieve: (id) =>
    api.get(`/users/${id}/`),
  update: (id, data) =>
    api.put(`/users/${id}/`, data),
  delete: (id) =>
    api.delete(`/users/${id}/`),
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
