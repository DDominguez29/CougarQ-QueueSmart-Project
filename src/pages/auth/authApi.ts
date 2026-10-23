import { saveSession, type SessionUser } from '../../api/session';

async function postJson<T>(path: string, body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('Could not reach the server. Please try again.');
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error?.message ?? 'Something went wrong. Please try again.');
  }
  return payload.data as T;
}

export async function loginRequest(email: string, password: string) {
  const result = await postJson<{ token: string; user: SessionUser }>('/api/auth/login', {
    email,
    password,
  });
  saveSession(result.token, result.user);
  return result.user;
}

export async function registerRequest(fullName: string, email: string, password: string) {
  const result = await postJson<{ user: SessionUser }>('/api/auth/register', {
    fullName,
    email,
    password,
  });
  return result.user;
}
