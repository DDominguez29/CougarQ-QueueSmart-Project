import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, it } from 'node:test';

import { createApp } from '../src/app.ts';
import { createStore } from '../src/data/store.ts';
import type { Identity } from '../src/shared/models.ts';

const openServers: Server[] = [];

afterEach(async () => {
  await Promise.all(
    openServers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => {
            if (error) {
              reject(error);
              return;
            }

            resolve();
          });
        }),
    ),
  );
});

const userOne: Identity = {
  userId: 'user-1',
  role: 'user',
};

const userTwo: Identity = {
  userId: 'user-2',
  role: 'user',
};

async function startTestServer(identity?: Identity) {
  const store = createStore();

  store.services.set('service-1', {
    id: 'service-1',
    name: 'Book Pickup',
    description: 'Pickup reserved books.',
    expectedDurationMinutes: 10,
    priority: 2,
  });

  const app = createApp(store, {
    resolveIdentity: () => identity ?? null,
  });

  const server = app.listen(0);
  openServers.push(server);

  await new Promise<void>((resolve) => {
    server.once('listening', resolve);
  });

  const address = server.address() as AddressInfo;

  return {
    store,
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
}

describe('user queue API', () => {
  it('requires authentication to join a queue', async () => {
    const { baseUrl } = await startTestServer();

    const response = await fetch(
      `${baseUrl}/api/services/service-1/queue/join`,
      {
        method: 'POST',
      },
    );

    assert.equal(response.status, 401);

    const body = (await response.json()) as {
      error: {
        code: string;
        message: string;
      };
    };

    assert.equal(
      body.error.code,
      'UNAUTHENTICATED',
    );
  });

  it('allows a signed-in user to join a queue', async () => {
    const { store, baseUrl } =
      await startTestServer(userOne);

    const response = await fetch(
      `${baseUrl}/api/services/service-1/queue/join`,
      {
        method: 'POST',
      },
    );

    assert.equal(response.status, 201);

    const body = (await response.json()) as {
      data: {
        entry: {
          id: string;
          userId: string;
          serviceId: string;
          status: string;
        };
        position: number | null;
        waitingCount: number;
      };
    };

    assert.equal(body.data.entry.userId, 'user-1');
    assert.equal(
      body.data.entry.serviceId,
      'service-1',
    );
    assert.equal(body.data.entry.status, 'queued');
    assert.equal(body.data.position, 1);
    assert.equal(body.data.waitingCount, 1);

    assert.equal(store.queueEntries.size, 1);
  });

  it('prevents a user from having two active queue entries', async () => {
    const { baseUrl } =
      await startTestServer(userOne);

    const firstResponse = await fetch(
      `${baseUrl}/api/services/service-1/queue/join`,
      {
        method: 'POST',
      },
    );

    assert.equal(firstResponse.status, 201);

    const secondResponse = await fetch(
      `${baseUrl}/api/services/service-1/queue/join`,
      {
        method: 'POST',
      },
    );

    assert.equal(secondResponse.status, 409);

    const body = (await secondResponse.json()) as {
      error: {
        code: string;
      };
    };

    assert.equal(
      body.error.code,
      'ALREADY_IN_QUEUE',
    );
  });

  it('returns the signed-in user active queue', async () => {
    const { baseUrl } =
      await startTestServer(userOne);

    await fetch(
      `${baseUrl}/api/services/service-1/queue/join`,
      {
        method: 'POST',
      },
    );

    const response = await fetch(
      `${baseUrl}/api/queue/me`,
    );

    assert.equal(response.status, 200);

    const body = (await response.json()) as {
      data: {
        entry: {
          userId: string;
          status: string;
        };
        service: {
          id: string;
          name: string;
        };
        position: number | null;
      } | null;
    };

    assert.ok(body.data);
    assert.equal(body.data.entry.userId, 'user-1');
    assert.equal(body.data.entry.status, 'queued');
    assert.equal(body.data.service.id, 'service-1');
    assert.equal(body.data.position, 1);
  });

  it('returns null when the user has no active queue', async () => {
    const { baseUrl } =
      await startTestServer(userOne);

    const response = await fetch(
      `${baseUrl}/api/queue/me`,
    );

    assert.equal(response.status, 200);

    const body = (await response.json()) as {
      data: unknown;
    };

    assert.equal(body.data, null);
  });

  it('allows the owner to leave a queued entry', async () => {
    const { store, baseUrl } =
      await startTestServer(userOne);

    const joinResponse = await fetch(
      `${baseUrl}/api/services/service-1/queue/join`,
      {
        method: 'POST',
      },
    );

    const joined = (await joinResponse.json()) as {
      data: {
        entry: {
          id: string;
        };
      };
    };

    const response = await fetch(
      `${baseUrl}/api/queue/${joined.data.entry.id}/leave`,
      {
        method: 'POST',
      },
    );

    assert.equal(response.status, 200);

    const body = (await response.json()) as {
      data: {
        entry: {
          id: string;
          status: string;
          endedAt: string | null;
        };
      };
    };

    assert.equal(body.data.entry.status, 'left');
    assert.ok(body.data.entry.endedAt);

    const stored = store.queueEntries.get(
      joined.data.entry.id,
    );

    assert.equal(stored?.status, 'left');
    assert.ok(stored?.endedAt);
  });

  it('does not return a left entry as active', async () => {
    const { baseUrl } =
      await startTestServer(userOne);

    const joinResponse = await fetch(
      `${baseUrl}/api/services/service-1/queue/join`,
      {
        method: 'POST',
      },
    );

    const joined = (await joinResponse.json()) as {
      data: {
        entry: {
          id: string;
        };
      };
    };

    await fetch(
      `${baseUrl}/api/queue/${joined.data.entry.id}/leave`,
      {
        method: 'POST',
      },
    );

    const response = await fetch(
      `${baseUrl}/api/queue/me`,
    );

    const body = (await response.json()) as {
      data: unknown;
    };

    assert.equal(response.status, 200);
    assert.equal(body.data, null);
  });

  it('prevents another user from leaving someone else queue entry', async () => {
    const store = createStore();

    store.services.set('service-1', {
      id: 'service-1',
      name: 'Book Pickup',
      description: 'Pickup reserved books.',
      expectedDurationMinutes: 10,
      priority: 2,
    });

    store.queueEntries.set('entry-1', {
      id: 'entry-1',
      userId: userOne.userId,
      serviceId: 'service-1',
      priority: 2,
      joinedAt: new Date().toISOString(),
      status: 'queued',
      endedAt: null,
      serviceName: 'Book Pickup',
      serviceStartedAt: null,
      completedAt: null,
    });

    const app = createApp(store, {
      resolveIdentity: () => userTwo,
    });

    const server = app.listen(0);
    openServers.push(server);

    await new Promise<void>((resolve) => {
      server.once('listening', resolve);
    });

    const address = server.address() as AddressInfo;
    const baseUrl =
      `http://127.0.0.1:${address.port}`;

    const response = await fetch(
      `${baseUrl}/api/queue/entry-1/leave`,
      {
        method: 'POST',
      },
    );

    assert.equal(response.status, 403);

    const body = (await response.json()) as {
      error: {
        code: string;
      };
    };

    assert.equal(body.error.code, 'FORBIDDEN');
    assert.equal(
      store.queueEntries.get('entry-1')?.status,
      'queued',
    );
  });
});
