import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

import { createApp } from '../src/app.ts';
import { createStore } from '../src/data/store.ts';
import type { Identity } from '../src/shared/models.ts';

type ServiceData = {
  id: string;
  name: string;
  description: string;
  expectedDurationMinutes: number;
  priority: number;
};

type ServiceResponse = {
  data: ServiceData;
};

type ServiceListResponse = {
  data: ServiceData[];
};

type ErrorResponse = {
  error: {
    code: string;
    message: string;
  };
};

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

async function startTestServer(identity?: Identity) {
  const store = createStore();

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

function createAdminIdentity(): Identity {
  return {
    role: 'admin',
  } as unknown as Identity;
}

function createStudentIdentity(): Identity {
  return {
    role: 'student',
  } as unknown as Identity;
}

const validService = {
  name: 'Book Pickup',
  description: 'Pickup reserved library books.',
  expectedDurationMinutes: 10,
  priority: 2,
};

describe('service management API', () => {
  it('lists services', async () => {
    const { store, baseUrl } = await startTestServer();

    store.services.set('service-1', {
      id: 'service-1',
      name: 'CTAP Express',
      description: 'Express CTAP assistance.',
      expectedDurationMinutes: 10,
      priority: 1,
    });

    const response = await fetch(`${baseUrl}/api/services`);

    assert.equal(response.status, 200);

    const body =
      (await response.json()) as ServiceListResponse;

    assert.equal(body.data.length, 1);
    assert.equal(body.data[0].name, 'CTAP Express');
  });

  it('sorts services by highest priority first', async () => {
    const { store, baseUrl } = await startTestServer();

    store.services.set('low', {
      id: 'low',
      name: 'Low Priority Service',
      description: 'Lower priority.',
      expectedDurationMinutes: 5,
      priority: 1,
    });

    store.services.set('high', {
      id: 'high',
      name: 'High Priority Service',
      description: 'Higher priority.',
      expectedDurationMinutes: 15,
      priority: 10,
    });

    const response = await fetch(`${baseUrl}/api/services`);

    const body =
      (await response.json()) as ServiceListResponse;

    assert.equal(response.status, 200);
    assert.equal(
      body.data[0].name,
      'High Priority Service',
    );
    assert.equal(
      body.data[1].name,
      'Low Priority Service',
    );
  });

  it('allows an administrator to create a service', async () => {
    const { baseUrl } = await startTestServer(
      createAdminIdentity(),
    );

    const response = await fetch(`${baseUrl}/api/services`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(validService),
    });

    assert.equal(response.status, 201);

    const body =
      (await response.json()) as ServiceResponse;

    assert.equal(body.data.name, 'Book Pickup');
    assert.equal(
      body.data.description,
      'Pickup reserved library books.',
    );
    assert.equal(
      body.data.expectedDurationMinutes,
      10,
    );
    assert.equal(body.data.priority, 2);
    assert.equal(typeof body.data.id, 'string');
  });

  it('rejects service creation when the user is not signed in', async () => {
    const { baseUrl } = await startTestServer();

    const response = await fetch(`${baseUrl}/api/services`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(validService),
    });

    assert.equal(response.status, 401);

    const body =
      (await response.json()) as ErrorResponse;

    assert.deepEqual(body, {
      error: {
        code: 'UNAUTHENTICATED',
        message: 'Sign in to continue.',
      },
    });
  });

  it('rejects service creation for a student', async () => {
    const { baseUrl } = await startTestServer(
      createStudentIdentity(),
    );

    const response = await fetch(`${baseUrl}/api/services`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(validService),
    });

    assert.equal(response.status, 403);

    const body =
      (await response.json()) as ErrorResponse;

    assert.deepEqual(body, {
      error: {
        code: 'FORBIDDEN',
        message: 'Administrator access is required.',
      },
    });
  });

  it('rejects invalid service input', async () => {
    const { baseUrl } = await startTestServer(
      createAdminIdentity(),
    );

    const response = await fetch(`${baseUrl}/api/services`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: '',
        description: 'Test service',
        expectedDurationMinutes: 10,
        priority: 1,
      }),
    });

    assert.equal(response.status, 400);

    const body =
      (await response.json()) as ErrorResponse;

    assert.equal(
      body.error.code,
      'INVALID_SERVICE_NAME',
    );
  });

  it('allows an administrator to update a service', async () => {
    const { store, baseUrl } = await startTestServer(
      createAdminIdentity(),
    );

    store.services.set('service-1', {
      id: 'service-1',
      name: 'Old Service',
      description: 'Old description.',
      expectedDurationMinutes: 10,
      priority: 1,
    });

    const response = await fetch(
      `${baseUrl}/api/services/service-1`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Updated Service',
          description: 'Updated description.',
          expectedDurationMinutes: 20,
          priority: 5,
        }),
      },
    );

    assert.equal(response.status, 200);

    const body =
      (await response.json()) as ServiceResponse;

    assert.equal(body.data.id, 'service-1');
    assert.equal(body.data.name, 'Updated Service');
    assert.equal(
      body.data.expectedDurationMinutes,
      20,
    );
    assert.equal(body.data.priority, 5);

    const storedService =
      store.services.get('service-1');

    assert.equal(
      storedService?.name,
      'Updated Service',
    );
  });

  it('rejects updates from a student', async () => {
    const { store, baseUrl } = await startTestServer(
      createStudentIdentity(),
    );

    store.services.set('service-1', {
      id: 'service-1',
      name: 'Original Service',
      description: 'Original description.',
      expectedDurationMinutes: 10,
      priority: 1,
    });

    const response = await fetch(
      `${baseUrl}/api/services/service-1`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(validService),
      },
    );

    assert.equal(response.status, 403);

    const body =
      (await response.json()) as ErrorResponse;

    assert.equal(body.error.code, 'FORBIDDEN');
  });

  it('returns 404 when updating a service that does not exist', async () => {
    const { baseUrl } = await startTestServer(
      createAdminIdentity(),
    );

    const response = await fetch(
      `${baseUrl}/api/services/missing-service`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(validService),
      },
    );

    assert.equal(response.status, 404);

    const body =
      (await response.json()) as ErrorResponse;

    assert.deepEqual(body, {
      error: {
        code: 'SERVICE_NOT_FOUND',
        message: 'Service not found.',
      },
    });
  });

  it('rejects a zero expected duration', async () => {
    const { baseUrl } = await startTestServer(
      createAdminIdentity(),
    );

    const response = await fetch(`${baseUrl}/api/services`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...validService,
        expectedDurationMinutes: 0,
      }),
    });

    assert.equal(response.status, 400);

    const body =
      (await response.json()) as ErrorResponse;

    assert.equal(
      body.error.code,
      'INVALID_SERVICE_DURATION',
    );
  });

  it('rejects a negative priority', async () => {
    const { baseUrl } = await startTestServer(
      createAdminIdentity(),
    );

    const response = await fetch(`${baseUrl}/api/services`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...validService,
        priority: -1,
      }),
    });

    assert.equal(response.status, 400);

    const body =
      (await response.json()) as ErrorResponse;

    assert.equal(
      body.error.code,
      'INVALID_SERVICE_PRIORITY',
    );
  });
});