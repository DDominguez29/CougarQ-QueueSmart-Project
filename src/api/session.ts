const TOKEN_KEY = 'cougarq.token';
const USER_KEY = 'cougarq.user';

export type UserRole = 'user' | 'admin';

export interface SessionUser {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
}

function readStorage(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function getToken() {
  return readStorage(TOKEN_KEY);
}

export function getSessionUser(): SessionUser | null {
  const raw = readStorage(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

export function saveSession(token: string, user: SessionUser) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    // Private windows can block storage, so the login only lasts until refresh.
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {
    // Nothing stored.
  }
}

export function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
