import { Router } from 'express';
import { ApiError } from '../../shared/ApiError.ts';
import { getAuth, requireAuth } from './auth.middleware.ts';
import type { AuthRepository } from './auth.repository.ts';
import { login, logout, registerUser } from './auth.service.ts';
import { validateLogin, validateRegister } from './auth.validation.ts';

export function createAuthRouter(accounts: AuthRepository) {
  const router = Router();

  router.post('/register', async (request, response) => {
    const input = validateRegister(request.body);
    const user = await registerUser(accounts, input);
    response.status(201).json({ data: { user } });
  });

  router.post('/login', async (request, response) => {
    const input = validateLogin(request.body);
    response.json({ data: await login(accounts, input) });
  });

  router.get('/me', requireAuth(accounts), async (_request, response) => {
    const user = await accounts.findById(getAuth(response).userId);
    if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'Sign in to continue.');
    response.set('Cache-Control', 'no-store');
    response.json({ data: { user } });
  });

  router.post('/logout', requireAuth(accounts), async (_request, response) => {
    await logout(accounts, getAuth(response).token);
    response.status(204).end();
  });

  return router;
}
