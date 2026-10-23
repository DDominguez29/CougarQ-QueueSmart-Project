import type { Request, RequestHandler, Response } from 'express';
import type { Store } from '../../data/store.ts';
import { ApiError } from '../../shared/ApiError.ts';
import type { UserRole } from './auth.models.ts';
import { resolveSession } from './auth.service.ts';

export interface AuthIdentity {
  userId: string;
  role: UserRole;
  token: string;
}

export function readBearerToken(header: string | undefined) {
  if (!header) return undefined;
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return undefined;
  return token;
}

export function authenticate(store: Store, request: Request): AuthIdentity | null {
  const token = readBearerToken(request.get('Authorization'));
  const user = token ? resolveSession(store, token) : undefined;
  if (!token || !user) return null;
  return { userId: user.id, role: user.role, token };
}

export function createIdentityResolver(store: Store) {
  return (request: Request) => {
    const identity = authenticate(store, request);
    return identity ? { userId: identity.userId, role: identity.role } : null;
  };
}

export function requireAuth(store: Store): RequestHandler {
  return (request, response, next) => {
    const identity = authenticate(store, request);
    if (!identity) {
      next(new ApiError(401, 'UNAUTHORIZED', 'Sign in to continue.'));
      return;
    }
    response.locals.auth = identity;
    next();
  };
}

export function requireRole(role: UserRole): RequestHandler {
  return (_request, response, next) => {
    const identity = response.locals.auth as AuthIdentity | undefined;
    if (!identity) {
      next(new ApiError(401, 'UNAUTHORIZED', 'Sign in to continue.'));
      return;
    }
    if (identity.role !== role) {
      next(new ApiError(403, 'FORBIDDEN', 'You do not have access to this action.'));
      return;
    }
    next();
  };
}

export function getAuth(response: Response) {
  const identity = response.locals.auth as AuthIdentity | undefined;
  if (!identity) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Sign in to continue.');
  }
  return identity;
}
