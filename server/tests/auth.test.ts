import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, describe, test } from 'node:test';
import express from 'express';
import { createStore } from '../src/data/store.ts';
import { seedDemoAccounts } from '../src/data/seed.ts';
import { errorHandler } from '../src/middleware/errors.ts';
import {
  createIdentityResolver,
  getAuth,
  readBearerToken,
  requireAuth,
  requireRole,
} from '../src/modules/auth/auth.middleware.ts';
import {
  SESSION_TTL_MS,
  hashPassword,
  login,
  registerUser,
  resolveSession,
  verifyPassword,
} from '../src/modules/auth/auth.service.ts';
import { validateLogin, validateRegister } from '../src/modules/auth/auth.validation.ts';
import { ApiError } from '../src/shared/ApiError.ts';
import { request, startServer, stopServer } from './helpers.ts';

const validRegistration = {
  fullName: 'Denzel Maldonado',
  email: 'dmaldonado@cougarnet.uh.edu',
  password: 'Cougar2026',
};

function expectValidationError(run: () => unknown, message: RegExp) {
  assert.throws(run, (error: unknown) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 400);
    assert.equal(error.code, 'VALIDATION_ERROR');
    assert.match(error.message, message);
    return true;
  });
}

describe('registration validation', () => {
  test('accepts a valid student and normalizes the email', () => {
    const input = validateRegister({
      ...validRegistration,
      fullName: '  Denzel Maldonado ',
      email: ' DMaldonado@CougarNet.UH.edu ',
    });
    assert.equal(input.fullName, 'Denzel Maldonado');
    assert.equal(input.email, 'dmaldonado@cougarnet.uh.edu');
  });

  test('rejects a body that is not an object', () => {
    expectValidationError(() => validateRegister(null), /JSON object/);
    expectValidationError(() => validateRegister(['a']), /JSON object/);
  });

  test('requires every field', () => {
    expectValidationError(() => validateRegister({ ...validRegistration, fullName: '' }), /Full name is required/);
    expectValidationError(() => validateRegister({ ...validRegistration, fullName: '   ' }), /Full name is required/);
    expectValidationError(() => validateRegister({ ...validRegistration, email: undefined }), /Email is required/);
    expectValidationError(() => validateRegister({ ...validRegistration, password: null }), /Password is required/);
  });

  test('rejects fields with the wrong type', () => {
    expectValidationError(() => validateRegister({ ...validRegistration, fullName: 42 }), /must be a string/);
    expectValidationError(() => validateRegister({ ...validRegistration, email: true }), /must be a string/);
    expectValidationError(() => validateRegister({ ...validRegistration, password: 12345678 }), /must be a string/);
  });

  test('enforces length limits', () => {
    expectValidationError(() => validateRegister({ ...validRegistration, fullName: 'A'.repeat(61) }), /60 characters/);
    expectValidationError(
      () => validateRegister({ ...validRegistration, email: `${'a'.repeat(90)}@cougarnet.uh.edu` }),
      /100 characters/,
    );
    expectValidationError(() => validateRegister({ ...validRegistration, password: 'abc123' }), /at least 8/);
    expectValidationError(() => validateRegister({ ...validRegistration, password: `a1${'x'.repeat(63)}` }), /64 characters/);
  });

  test('rejects badly formatted names and emails', () => {
    expectValidationError(() => validateRegister({ ...validRegistration, fullName: 'Denzel 123' }), /only contain letters/);
    expectValidationError(() => validateRegister({ ...validRegistration, email: 'not-an-email' }), /valid email/);
  });

  test('only allows CougarNet emails', () => {
    expectValidationError(() => validateRegister({ ...validRegistration, email: 'denzel@gmail.com' }), /cougarnet\.uh\.edu/);
    expectValidationError(() => validateRegister({ ...validRegistration, email: 'staff@uh.edu' }), /cougarnet\.uh\.edu/);
  });

  test('requires a letter and a number in the password', () => {
    expectValidationError(() => validateRegister({ ...validRegistration, password: 'onlyletters' }), /letter and one number/);
    expectValidationError(() => validateRegister({ ...validRegistration, password: '12345678' }), /letter and one number/);
  });
});

describe('login validation', () => {
  test('accepts student and staff emails', () => {
    assert.equal(validateLogin({ email: 'a@cougarnet.uh.edu', password: 'x' }).email, 'a@cougarnet.uh.edu');
    assert.equal(validateLogin({ email: 'Admin@UH.edu', password: 'x' }).email, 'admin@uh.edu');
  });

  test('rejects other domains, missing fields, and oversized passwords', () => {
    expectValidationError(() => validateLogin({ email: 'a@gmail.com', password: 'x' }), /cougarnet\.uh\.edu or @uh\.edu/);
    expectValidationError(() => validateLogin({ email: 'a@uh.edu' }), /Password is required/);
    expectValidationError(() => validateLogin({ email: 'a@uh.edu', password: 'x'.repeat(65) }), /64 characters/);
  });
});

describe('auth service', () => {
  test('hashes passwords with a salt and verifies them', () => {
    const first = hashPassword('Cougar123');
    const second = hashPassword('Cougar123');
    assert.notEqual(first, second);
    assert.equal(verifyPassword('Cougar123', first), true);
    assert.equal(verifyPassword('wrong', first), false);
    assert.equal(verifyPassword('Cougar123', 'malformed'), false);
  });

  test('registers students with the user role and never exposes the hash', () => {
    const store = createStore();
    const user = registerUser(store, validRegistration);
    assert.equal(user.role, 'user');
    assert.equal('passwordHash' in user, false);
    assert.equal(store.users.size, 1);
  });

  test('blocks duplicate emails', () => {
    const store = createStore();
    registerUser(store, validRegistration);
    assert.throws(() => registerUser(store, validRegistration), { status: 409, code: 'EMAIL_TAKEN' });
  });

  test('logs in with the right password and rejects the wrong one', () => {
    const store = createStore();
    seedDemoAccounts(store);
    const result = login(store, { email: 'admin@uh.edu', password: 'Admin123' });
    assert.equal(result.user.role, 'admin');
    assert.equal(resolveSession(store, result.token)?.email, 'admin@uh.edu');
    assert.throws(() => login(store, { email: 'admin@uh.edu', password: 'Wrong123' }), { status: 401 });
    assert.throws(() => login(store, { email: 'nobody@uh.edu', password: 'Admin123' }), { status: 401 });
  });

  test('expires sessions after the time limit', () => {
    const store = createStore();
    seedDemoAccounts(store);
    const start = 1_000_000;
    const { token } = login(store, { email: 'student@cougarnet.uh.edu', password: 'Cougar123' }, start);
    assert.ok(resolveSession(store, token, start + SESSION_TTL_MS - 1));
    assert.equal(resolveSession(store, token, start + SESSION_TTL_MS), undefined);
    assert.equal(store.sessions.has(token), false);
    assert.equal(resolveSession(store, 'unknown-token'), undefined);
  });

  test('reads only well-formed bearer tokens', () => {
    assert.equal(readBearerToken('Bearer abc'), 'abc');
    assert.equal(readBearerToken('Basic abc'), undefined);
    assert.equal(readBearerToken('Bearer'), undefined);
    assert.equal(readBearerToken(undefined), undefined);
  });
});

describe('auth endpoints', () => {
  let server: Server;
  let baseUrl: string;

  before(async () => {
    const store = createStore();
    seedDemoAccounts(store);
    ({ server, baseUrl } = await startServer(store));
  });

  after(() => stopServer(server));

  test('registers, logs in, reads the profile, and logs out', async () => {
    const registered = await request(baseUrl, '/api/auth/register', { method: 'POST', body: validRegistration });
    assert.equal(registered.status, 201);
    assert.equal(registered.body.data.user.email, validRegistration.email);

    const loggedIn = await request(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: { email: validRegistration.email, password: validRegistration.password },
    });
    assert.equal(loggedIn.status, 200);
    const { token } = loggedIn.body.data;
    assert.equal(typeof token, 'string');

    const me = await request(baseUrl, '/api/auth/me', { token });
    assert.equal(me.status, 200);
    assert.equal(me.body.data.user.role, 'user');

    const out = await request(baseUrl, '/api/auth/logout', { method: 'POST', token });
    assert.equal(out.status, 204);

    const afterLogout = await request(baseUrl, '/api/auth/me', { token });
    assert.equal(afterLogout.status, 401);
  });

  test('returns validation and conflict errors in the shared format', async () => {
    const invalid = await request(baseUrl, '/api/auth/register', {
      method: 'POST',
      body: { ...validRegistration, email: 'x@gmail.com' },
    });
    assert.equal(invalid.status, 400);
    assert.equal(invalid.body.error.code, 'VALIDATION_ERROR');

    const duplicate = await request(baseUrl, '/api/auth/register', {
      method: 'POST',
      body: { ...validRegistration, email: 'student@cougarnet.uh.edu' },
    });
    assert.equal(duplicate.status, 409);
  });

  test('rejects bad credentials and missing tokens', async () => {
    const wrong = await request(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: { email: 'student@cougarnet.uh.edu', password: 'Wrong1234' },
    });
    assert.equal(wrong.status, 401);
    assert.equal(wrong.body.error.code, 'INVALID_CREDENTIALS');

    const noToken = await request(baseUrl, '/api/auth/me');
    assert.equal(noToken.status, 401);
  });
});

describe('role middleware', () => {
  let server: Server;
  let baseUrl: string;
  let studentToken: string;
  let adminToken: string;

  before(async () => {
    const store = createStore();
    seedDemoAccounts(store);
    studentToken = login(store, { email: 'student@cougarnet.uh.edu', password: 'Cougar123' }).token;
    adminToken = login(store, { email: 'admin@uh.edu', password: 'Admin123' }).token;

    const app = express();
    app.get('/admin-only', requireAuth(store), requireRole('admin'), (_request, response) => {
      response.json({ data: { role: getAuth(response).role } });
    });
    app.get('/no-auth', requireRole('admin'), (_request, response) => {
      response.json({ data: {} });
    });
    app.get('/identity', (_request, response) => {
      response.json({ data: getAuth(response) });
    });
    app.use(errorHandler);

    server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(() => stopServer(server));

  test('lets admins through', async () => {
    const response = await request(baseUrl, '/admin-only', { token: adminToken });
    assert.equal(response.status, 200);
    assert.equal(response.body.data.role, 'admin');
  });

  test('blocks students from admin routes', async () => {
    const response = await request(baseUrl, '/admin-only', { token: studentToken });
    assert.equal(response.status, 403);
    assert.equal(response.body.error.code, 'FORBIDDEN');
  });

  test('requires sign in before checking the role', async () => {
    assert.equal((await request(baseUrl, '/admin-only')).status, 401);
    assert.equal((await request(baseUrl, '/no-auth')).status, 401);
    assert.equal((await request(baseUrl, '/identity')).status, 401);
  });
});

describe('identity resolver for other modules', () => {
  test('returns the verified user ID and role from a valid token', () => {
    const store = createStore();
    seedDemoAccounts(store);
    const { token, user } = login(store, { email: 'admin@uh.edu', password: 'Admin123' });
    const resolve = createIdentityResolver(store);
    const fakeRequest = (header?: string) =>
      ({ get: () => header }) as unknown as Parameters<typeof resolve>[0];

    assert.deepEqual(resolve(fakeRequest(`Bearer ${token}`)), { userId: user.id, role: 'admin' });
    assert.equal(resolve(fakeRequest('Bearer not-a-real-token')), null);
    assert.equal(resolve(fakeRequest()), null);
  });
});
