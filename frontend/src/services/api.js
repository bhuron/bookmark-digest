import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || '/api';

// Get API key from localStorage
const getApiKey = () => localStorage.getItem('bookmark_digest_api_key');

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
      // Clear invalid API key
      localStorage.removeItem('bookmark_digest_api_key');
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
  addTags: (id, tags) => api.post(`/articles/${id}/tags`, { tags }),
  removeTag: (id, tagId) => api.delete(`/articles/${id}/tags/${tagId}`),
  getStats: () => api.get('/articles/stats'),
};

// Tags API
export const tagsApi = {
  list: () => api.get('/tags'),
  get: (id) => api.get(`/tags/${id}`),
  create: (data) => api.post('/tags', data),
  update: (id, data) => api.put(`/tags/${id}`, data),
  delete: (id) => api.delete(`/tags/${id}`),
  getArticles: (id, params) => api.get(`/tags/${id}/articles`, { params }),
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
