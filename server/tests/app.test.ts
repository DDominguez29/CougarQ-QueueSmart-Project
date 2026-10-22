import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';
import { createApp } from '../src/app.ts';

let server: Server;
let baseUrl: string;

before(async () => {
  server = createApp().listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
});

test('health endpoint responds with the shared success envelope', async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { data: { status: 'ok' } });
});

test('unknown endpoints return a JSON 404 error', async () => {
  const response = await fetch(`${baseUrl}/api/missing`);
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), {
    error: { code: 'NOT_FOUND', message: 'API endpoint not found.' },
  });
});

test('malformed JSON returns a validation error instead of HTML', async () => {
  const response = await fetch(`${baseUrl}/api/health`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{invalid',
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON.' },
  });
});

test('oversized JSON is rejected with a consistent error', async () => {
  const response = await fetch(`${baseUrl}/api/health`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: 'x'.repeat(110_000) }),
  });
  assert.equal(response.status, 413);
  assert.deepEqual(await response.json(), {
    error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body exceeds 100 KB.' },
  });
});
