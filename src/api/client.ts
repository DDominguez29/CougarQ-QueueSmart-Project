import { authHeaders } from './session';

export class ApiRequestError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
  }
}

export async function requestApi<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  if (options.body) headers.set('Content-Type', 'application/json');
  for (const [name, value] of Object.entries(authHeaders())) headers.set(name, value);

  const response = await fetch(path, { ...options, headers, credentials: 'include' });
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ApiRequestError(response.status, 'The server returned an unreadable response. Please try again.');
  }
  if (!response.ok) {
    const error = body && typeof body === 'object' && 'error' in body ? body.error : null;
    const message = error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
      ? error.message : 'The request could not be completed.';
    throw new ApiRequestError(response.status, message);
  }
  if (!body || typeof body !== 'object' || !('data' in body)) {
    throw new ApiRequestError(502, 'The server response is missing data. Please try again.');
  }
  return body.data as T;
}

export function requestError(error: unknown): ApiRequestError {
  return error instanceof ApiRequestError
    ? error
    : new ApiRequestError(0, 'Could not reach the server. Please try again.');
}
