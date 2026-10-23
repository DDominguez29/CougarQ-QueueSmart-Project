import { Router } from 'express';
import type { Store } from '../../data/store.ts';
import { ApiError } from '../../shared/ApiError.ts';
import { getAuth, requireAuth } from './auth.middleware.ts';
import { login, logout, registerUser, toPublicUser } from './auth.service.ts';
import { validateLogin, validateRegister } from './auth.validation.ts';

export function createAuthRouter(store: Store) {
  const router = Router();

  router.post('/register', (request, response) => {
    const input = validateRegister(request.body);
    const user = registerUser(store, input);
    response.status(201).json({ data: { user } });
  });

  router.post('/login', (request, response) => {
    const input = validateLogin(request.body);
    response.json({ data: login(store, input) });
  });

  router.get('/me', requireAuth(store), (_request, response) => {
    const { userId } = getAuth(response);
    const user = store.users.get(userId);
    if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'Sign in to continue.');
    response.json({ data: { user: toPublicUser(user) } });
  });

  router.post('/logout', requireAuth(store), (_request, response) => {
    logout(store, getAuth(response).token);
    response.status(204).end();
  });

  return router;
}
