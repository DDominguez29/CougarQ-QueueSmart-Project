import type { Request, RequestHandler, Response } from 'express';
import { ApiError } from '../../shared/ApiError.ts';
import type { Identity } from '../../shared/models.ts';
import type { UserRole } from './auth.models.ts';
import type { AuthRepository } from './auth.repository.ts';
import { resolveSession } from './auth.service.ts';

export interface AuthIdentity {
  userId: string;
  role: UserRole;
  name: string;
  token: string;
}

export function readBearerToken(header: string | undefined) {
  if (!header) return undefined;
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return undefined;
  return token;
}

export async function authenticate(accounts: AuthRepository, request: Request): Promise<AuthIdentity | null> {
  const token = readBearerToken(request.get('Authorization'));
  if (!token) return null;
  const user = await resolveSession(accounts, token);
  if (!user) return null;
  return { userId: user.id, role: user.role, name: user.fullName, token };
}

export function createIdentityResolver(accounts: AuthRepository) {
  return async (request: Request): Promise<Identity | null> => {
    const identity = await authenticate(accounts, request);
    return identity ? { userId: identity.userId, role: identity.role, name: identity.name } : null;
  };
}

export function requireAuth(accounts: AuthRepository): RequestHandler {
  return async (request, response, next) => {
    const identity = await authenticate(accounts, request);
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
