import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import type { Store } from '../../data/store.ts';
import { ApiError } from '../../shared/ApiError.ts';
import type { PublicUser, User, UserRole } from './auth.models.ts';
import type { LoginInput, RegisterInput } from './auth.validation.ts';

export const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, 'hex');
  const actual = scryptSync(password, salt, expected.length);
  return timingSafeEqual(actual, expected);
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  };
}

export function findUserByEmail(store: Store, email: string) {
  for (const user of store.users.values()) {
    if (user.email === email) return user;
  }
  return undefined;
}

export function createUser(
  store: Store,
  input: RegisterInput,
  role: UserRole = 'user',
) {
  if (findUserByEmail(store, input.email)) {
    throw new ApiError(409, 'EMAIL_TAKEN', 'An account with this email already exists.');
  }

  const user: User = {
    id: randomUUID(),
    fullName: input.fullName,
    email: input.email,
    passwordHash: hashPassword(input.password),
    role,
    createdAt: new Date().toISOString(),
  };
  store.users.set(user.id, user);
  return user;
}

export function registerUser(store: Store, input: RegisterInput) {
  return toPublicUser(createUser(store, input, 'user'));
}

export function startSession(store: Store, userId: string, now = Date.now()) {
  const token = randomBytes(32).toString('hex');
  store.sessions.set(token, { token, userId, expiresAt: now + SESSION_TTL_MS });
  return token;
}

export function login(store: Store, input: LoginInput, now = Date.now()) {
  const user = findUserByEmail(store, input.email);
  if (!user || !verifyPassword(input.password, user.passwordHash)) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
  }
  return { token: startSession(store, user.id, now), user: toPublicUser(user) };
}

export function resolveSession(store: Store, token: string, now = Date.now()) {
  const session = store.sessions.get(token);
  if (!session) return undefined;
  if (session.expiresAt <= now) {
    store.sessions.delete(token);
    return undefined;
  }
  return store.users.get(session.userId);
}

export function logout(store: Store, token: string) {
  store.sessions.delete(token);
}
