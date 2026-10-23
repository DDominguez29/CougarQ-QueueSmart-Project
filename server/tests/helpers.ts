import { once } from 'node:events';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app.ts';
import { createStore, type Store } from '../src/data/store.ts';

export async function startServer(store: Store = createStore()) {
  const server: Server = createApp(store).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address() as AddressInfo;
  return { server, store, baseUrl: `http://127.0.0.1:${port}` };
}

export async function stopServer(server: Server) {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

export async function request(
  baseUrl: string,
  path: string,
  options: { method?: string; body?: unknown; token?: string } = {},
) {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}
