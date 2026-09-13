import axios from 'axios';
import { clearApiKey, getApiKey, readSentApiKey } from '../utils/apiKey';

const API_BASE = import.meta.env.VITE_API_BASE || '/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add API key to requests
api.interceptors.request.use((config) => {
  const apiKey = getApiKey();
  if (apiKey) {
    config.headers['X-API-Key'] = apiKey;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Only forget a key that was actually sent and rejected. Clearing when no
      // key was sent would delete the host-wide cookie, which is shared with the
      // other port, and break a setup that was working there.
      if (readSentApiKey(error.config)) {
        clearApiKey();
      }

      window.location.href = '/settings';
    }
    return Promise.reject(error);
  }
);

// Articles API
export const articlesApi = {
  list: (params) => api.get('/articles', { params }),
  get: (id) => api.get(`/articles/${id}`),
  create: (data) => api.post('/articles', data),
  update: (id, data) => api.put(`/articles/${id}`, data),
  delete: (id) => api.delete(`/articles/${id}`),
  // Scope is either { ids: [...] } or { filter: {...} }; the API accepts both
  bulkDelete: (scope) => api.delete('/articles/bulk', { data: scope }),
  bulkUpdate: (scope, fields) => api.put('/articles/bulk', { ...scope, ...fields }),
  restore: (scope) => api.post('/articles/restore', scope),
  purge: (scope) => api.delete('/articles/purge', { data: scope }),

  getStats: () => api.get('/articles/stats'),
};



// EPUB API
export const epubApi = {
  generate: (data) => api.post('/epub/generate', data),
  listExports: () => api.get('/epub/exports'),
  getExport: (id) => api.get(`/epub/exports/${id}`),
  downloadExport: (id) => api.get(`/epub/exports/${id}/download`, { responseType: 'blob' }),
  deleteExport: (id) => api.delete(`/epub/exports/${id}`),
  sendToKindle: (id) => api.post(`/epub/exports/${id}/send-to-kindle`),
};

// Settings API
export const settingsApi = {
  get: () => api.get('/settings'),
  update: (data) => api.put('/settings', data),
  testSmtp: (data) => api.post('/settings/test-smtp', data),
};

export default api;
