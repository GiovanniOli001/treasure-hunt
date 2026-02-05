// ============================================
// API CLIENT
// ============================================

const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:8787'
  : 'https://treasure-hunt-api.oliveri-john001.workers.dev';

function getToken() {
  return localStorage.getItem('th_token');
}

function setToken(token) {
  localStorage.setItem('th_token', token);
}

function clearToken() {
  localStorage.removeItem('th_token');
}

async function apiRequest(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const headers = { 'Content-Type': 'application/json' };

  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers: { ...headers, ...options.headers }
  });

  if (response.status === 401) {
    clearToken();
    if (window.location.pathname !== '/login.html' && window.location.pathname !== '/play.html') {
      window.location.href = '/login.html';
    }
  }

  // Handle CSV responses
  const contentType = response.headers.get('Content-Type') || '';
  if (contentType.includes('text/csv')) {
    return { ok: response.ok, blob: await response.blob(), httpStatus: response.status };
  }

  const data = await response.json();

  // If API returns an array, return it directly with ok flag
  if (Array.isArray(data)) {
    data.ok = response.ok;
    return data;
  }

  return { ok: response.ok, httpStatus: response.status, ...data };
}
