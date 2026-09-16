const TOKEN_KEY = 'realtysaas.token';
const REFRESH_KEY = 'realtysaas.refresh';
const ORG_KEY = 'realtysaas.org';

export const store = {
  token: () => localStorage.getItem(TOKEN_KEY) || '',
  refresh: () => localStorage.getItem(REFRESH_KEY) || '',
  org: () => localStorage.getItem(ORG_KEY) || '',
  setToken: (value) => localStorage.setItem(TOKEN_KEY, value),
  setRefresh: (value) => localStorage.setItem(REFRESH_KEY, value),
  setOrg: (value) => value ? localStorage.setItem(ORG_KEY, value) : localStorage.removeItem(ORG_KEY),
  clear: () => [TOKEN_KEY, REFRESH_KEY, ORG_KEY].forEach((key) => localStorage.removeItem(key)),
};

let refreshing;

async function refreshToken() {
  if (!refreshing) {
    refreshing = fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: store.refresh() }),
    }).then(async (response) => {
      if (!response.ok) throw new Error('Session expired');
      const data = await response.json();
      store.setToken(data.token);
      store.setRefresh(data.refreshToken);
      return data.token;
    }).finally(() => { refreshing = null; });
  }
  return refreshing;
}

export async function request(path, options = {}) {
  const { method = 'GET', body, params, form, noOrg = false, retried = false } = options;
  const url = new URL(path, window.location.origin);
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
  });

  const headers = {};
  if (store.token()) headers.Authorization = `Bearer ${store.token()}`;
  if (store.org() && !noOrg && path.startsWith('/api/')) headers['x-organization-id'] = store.org();

  const init = { method, headers };
  if (form) init.body = form;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  let response = await fetch(url, init);
  if (response.status === 401 && !retried && store.refresh()) {
    try {
      await refreshToken();
      return request(path, { ...options, retried: true });
    } catch (_error) {
      store.clear();
    }
  }

  let data = null;
  try { data = await response.json(); } catch (_error) { /* empty response */ }
  if (!response.ok) {
    const error = new Error(data?.error || data?.message || `Request failed (${response.status})`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

export const api = {
  login: (email, password) => request('/api/auth/login', { method: 'POST', body: { email, password }, noOrg: true }),
  register: (body) => request('/api/auth/register', { method: 'POST', body, noOrg: true }),
  logout: () => request('/api/auth/logout', { method: 'POST', noOrg: true }),
  me: () => request('/api/auth/me', { noOrg: true }),
  listOrgs: () => request('/api/orgs', { noOrg: true }),
  createOrg: (body) => request('/api/orgs', { method: 'POST', body, noOrg: true }),
  getOrg: (id) => request(`/api/orgs/${id}`, { noOrg: true }),
  updateOrg: (id, body) => request(`/api/orgs/${id}`, { method: 'PUT', body, noOrg: true }),
  listMembers: (id) => request(`/api/orgs/${id}/members`, { noOrg: true }),
  addMember: (id, body) => request(`/api/orgs/${id}/members`, { method: 'POST', body, noOrg: true }),
  removeMember: (id, userId) => request(`/api/orgs/${id}/members/${userId}`, { method: 'DELETE', noOrg: true }),
  listProperties: (params) => request('/api/properties', { params }),
  getProperty: (id) => request(`/api/properties/${id}`),
  createProperty: (body) => request('/api/properties', { method: 'POST', body }),
  updateProperty: (id, body) => request(`/api/properties/${id}`, { method: 'PUT', body }),
  deleteProperty: (id) => request(`/api/properties/${id}`, { method: 'DELETE' }),
  propertyStats: () => request('/api/properties/stats/overview'),
  searchProperties: (query) => request('/api/properties/search/query', { params: { q: query } }),
  listTasks: (params) => request('/api/tasks', { params }),
  getTask: (id) => request(`/api/tasks/${id}`),
  createTask: (body) => request('/api/tasks', { method: 'POST', body }),
  updateTask: (id, body) => request(`/api/tasks/${id}`, { method: 'PUT', body }),
  deleteTask: (id) => request(`/api/tasks/${id}`, { method: 'DELETE' }),
  addComment: (id, content) => request(`/api/tasks/${id}/comments`, { method: 'POST', body: { content } }),
};
