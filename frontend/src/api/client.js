const TOKEN_KEY = 'bt_token';
const USER_KEY = 'bt_user';

/** Backend origin — empty string = same origin (Vite proxy or unified npm start) */
export const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '');

let onUnauthorized = () => {};

export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

/** Build a full URL for API or OAuth redirects */
export function apiUrl(path) {
  if (/^https?:\/\//i.test(path)) return path;
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${normalized}`;
}

export function getStoredSession() {
  return {
    token: localStorage.getItem(TOKEN_KEY),
    user: JSON.parse(localStorage.getItem(USER_KEY) || 'null'),
  };
}

export function persistSession(data) {
  // Refresh token now lives in an httpOnly cookie — only the access token + user
  // are kept client-side.
  localStorage.setItem(TOKEN_KEY, data.token);
  localStorage.setItem(USER_KEY, JSON.stringify(data.user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

// ponytail: single in-flight refresh shared by concurrent 401s.
let refreshing = null;
function tryRefresh() {
  if (!refreshing) {
    refreshing = fetch(apiUrl('/api/auth/refresh'), { method: 'POST', credentials: 'include' })
      .then(async (r) => {
        if (!r.ok) throw new Error('refresh failed');
        const data = await r.json();
        localStorage.setItem(TOKEN_KEY, data.token);
        if (data.user) localStorage.setItem(USER_KEY, JSON.stringify(data.user));
        return data.token;
      })
      .finally(() => { refreshing = null; });
  }
  return refreshing;
}

export async function api(path, { token, auth = true, _retry = false, ...opts } = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  const session = getStoredSession();
  const authToken = token ?? (auth ? session.token : null);
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  const res = await fetch(apiUrl(path), { ...opts, headers, credentials: 'include' });
  if (res.status === 401) {
    // One silent refresh attempt via the cookie, then retry the original call once.
    if (auth && !_retry && !token && path !== '/api/auth/refresh') {
      try {
        const fresh = await tryRefresh();
        return api(path, { ...opts, auth, _retry: true, token: fresh });
      } catch {
        onUnauthorized();
        throw new Error('Session expired. Sign in again.');
      }
    }
    onUnauthorized();
    throw new Error('Session expired. Sign in again.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}

/** Revoke the refresh token server-side and drop the local session. */
export async function logout() {
  try {
    await fetch(apiUrl('/api/auth/logout'), { method: 'POST', credentials: 'include' });
  } catch { /* best effort */ }
  clearSession();
}

/** Ping the backend — useful for dev connection checks */
export async function checkBackendHealth() {
  const res = await fetch(apiUrl('/api/health'));
  if (!res.ok) throw new Error('Backend unreachable');
  return res.json();
}
