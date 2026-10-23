import type { Request, RequestHandler, Response } from 'express';
import type { Identity } from '../shared/models.ts';
import { ApiError } from '../shared/ApiError.ts';

// Auth supplies this resolver after verifying its cookie/session/token on the server.
export type IdentityResolver = (request: Request) => Identity | null | Promise<Identity | null>;

export function identityMiddleware(resolveIdentity?: IdentityResolver): RequestHandler {
  return async (request, response, next) => {
    response.locals.identity = resolveIdentity ? await resolveIdentity(request) : null;
    next();
  };
}

export function getIdentity(response: Response): Identity | undefined {
  return response.locals.identity ?? undefined;
}

export function requireIdentity(identity: Identity | undefined): Identity {
  if (!identity) {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Sign in to continue.');
  }
  return identity;
}

export function requireAdministrator(identity: Identity | undefined): Identity {
  const actor = requireIdentity(identity);
  if (actor.role !== 'admin') {
    throw new ApiError(403, 'FORBIDDEN', 'Administrator access is required.');
  }
  return actor;
}
