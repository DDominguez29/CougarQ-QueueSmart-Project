import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import type { Store } from '../../data/store.ts';
import { ApiError } from '../../shared/ApiError.ts';
import type { PublicUser, User, UserRole } from './auth.models.ts';
import { emailTaken, type AuthRepository } from './auth.repository.ts';
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

// Only this digest is stored, so a leaked sessions table cannot be replayed.
export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
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

// Synchronous in-memory helper used by unit test fixtures.
export function createUser(
  store: Store,
  input: RegisterInput,
  role: UserRole = 'user',
) {
  if (findUserByEmail(store, input.email)) throw emailTaken();

  const user: User = {
    id: randomUUID(),
    fullName: input.fullName,
    email: input.email,
    phone: input.phone ?? null,
    passwordHash: hashPassword(input.password),
    role,
    createdAt: new Date().toISOString(),
  };
  store.users.set(user.id, user);
  return user;
}

export function registerUser(accounts: AuthRepository, input: RegisterInput) {
  return accounts.createAccount({
    fullName: input.fullName,
    email: input.email,
    phone: input.phone ?? null,
    passwordHash: hashPassword(input.password),
    role: 'user',
  });
}

export async function startSession(accounts: AuthRepository, userId: string, now = Date.now()) {
  const token = randomBytes(32).toString('hex');
  await accounts.createSession({
    tokenHash: hashToken(token),
    userId,
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
  });
  return token;
}

export async function login(accounts: AuthRepository, input: LoginInput, now = Date.now()) {
  const user = await accounts.findByEmail(input.email);
  if (!user || !verifyPassword(input.password, user.passwordHash)) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
  }
  return { token: await startSession(accounts, user.id, now), user: toPublicUser(user) };
}

export function resolveSession(accounts: AuthRepository, token: string, now = Date.now()) {
  return accounts.findSessionUser(hashToken(token), now);
}

export function logout(accounts: AuthRepository, token: string) {
  return accounts.deleteSession(hashToken(token));
}
