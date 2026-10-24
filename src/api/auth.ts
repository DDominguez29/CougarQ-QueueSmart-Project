import { requestApi, requestError } from './client';
import { clearSession, saveSession, type SessionUser } from './session';

export async function loginRequest(email: string, password: string) {
  const result = await requestApi<{ token: string; user: SessionUser }>('/api/auth/login', {
    method: 'POST', body: JSON.stringify({ email, password }),
  });
  saveSession(result.token, result.user);
  return result.user;
}

export async function registerRequest(fullName: string, email: string, password: string) {
  const result = await requestApi<{ user: SessionUser }>('/api/auth/register', {
    method: 'POST', body: JSON.stringify({ fullName, email, password }),
  });
  return result.user;
}

export async function logoutRequest() {
  try {
    await requestApi<void>('/api/auth/logout', { method: 'POST' });
  } catch (err) {
    // An expired session is already signed out on the server.
    if (requestError(err).status !== 401) throw err;
  }
  clearSession();
}
