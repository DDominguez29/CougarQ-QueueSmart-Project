import { randomUUID } from 'node:crypto';
import { createUser } from '../modules/auth/auth.service.ts';
import type { QueueStatus } from '../shared/models.ts';
import type { Store } from './store.ts';

export const DEMO_ACCOUNTS = [
  {
    fullName: 'Demo Student',
    email: 'student@cougarnet.uh.edu',
    password: 'Cougar123',
    role: 'user',
  },
  {
    fullName: 'Bookstore Manager',
    email: 'admin@uh.edu',
    password: 'Admin123',
    role: 'admin',
  },
] as const;

export function seedDemoAccounts(store: Store) {
  for (const { role, ...account } of DEMO_ACCOUNTS) {
    createUser(store, account, role);
  }
}

export const DEMO_SERVICES = [
  {
    id: 'ctap-main',
    name: 'CTAP Main Lane',
    description: 'Pick up multiple CTAP course materials.',
    expectedDurationMinutes: 5,
    priority: 1,
  },
  {
    id: 'ctap-express',
    name: 'CTAP Express',
    description: 'Pick up a single book or course material.',
    expectedDurationMinutes: 2,
    priority: 1,
  },
  {
    id: 'help-desk',
    name: 'Support Table Help Desk',
    description: 'Questions about orders, accounts, or CTAP.',
    expectedDurationMinutes: 4,
    priority: 1,
  },
];

export function seedDemoServices(store: Store) {
  for (const service of DEMO_SERVICES) {
    store.services.set(service.id, { ...service });
  }
}

type DemoVisitStatus = Extract<QueueStatus, 'queued' | 'serving' | 'left'>;

export const DEMO_QUEUE = [
  { name: 'Dylan Whiteman', email: 'dwhiteman@cougarnet.uh.edu', serviceId: 'ctap-express', waitedMinutes: 4, status: 'serving' },
  { name: 'Maya Patel', email: 'mpatel14@cougarnet.uh.edu', serviceId: 'ctap-main', waitedMinutes: 31, status: 'queued' },
  { name: 'Carlos Nguyen', email: 'cnguyen8@cougarnet.uh.edu', serviceId: 'ctap-main', waitedMinutes: 28, status: 'queued' },
  { name: 'Jessica Garcia', email: 'jgarcia@cougarnet.uh.edu', serviceId: 'ctap-main', waitedMinutes: 26, status: 'queued' },
  { name: 'Ethan Torrie', email: 'etorrie@cougarnet.uh.edu', serviceId: 'help-desk', waitedMinutes: 15, status: 'left' },
  { name: 'Alyssa Brown', email: 'abrown23@cougarnet.uh.edu', serviceId: 'ctap-express', waitedMinutes: 9, status: 'queued' },
  { name: 'Jordan Lee', email: 'jlee91@cougarnet.uh.edu', serviceId: 'ctap-main', waitedMinutes: 24, status: 'queued' },
  { name: 'Priya Shah', email: 'pshah7@cougarnet.uh.edu', serviceId: 'ctap-main', waitedMinutes: 21, status: 'queued' },
  { name: 'Marcus Hill', email: 'mhill12@cougarnet.uh.edu', serviceId: 'ctap-express', waitedMinutes: 7, status: 'queued' },
  { name: 'Sofia Martinez', email: 'smartinez5@cougarnet.uh.edu', serviceId: 'help-desk', waitedMinutes: 12, status: 'queued' },
  { name: 'Noah Johnson', email: 'njohnson18@cougarnet.uh.edu', serviceId: 'ctap-main', waitedMinutes: 18, status: 'queued' },
] as const satisfies readonly {
  name: string;
  email: string;
  serviceId: string;
  waitedMinutes: number;
  status: DemoVisitStatus;
}[];

export const DEMO_STUDENT_PASSWORD = 'Cougar123';

export function seedDemoQueue(store: Store, now = Date.now()) {
  const nowIso = new Date(now).toISOString();

  for (const visit of DEMO_QUEUE) {
    const service = store.services.get(visit.serviceId);
    if (!service) continue;

    const user = createUser(store, {
      fullName: visit.name,
      email: visit.email,
      password: DEMO_STUDENT_PASSWORD,
    });

    const id = randomUUID();
    store.queueEntries.set(id, {
      id,
      userId: user.id,
      userName: user.fullName,
      serviceId: service.id,
      serviceName: service.name,
      priority: service.priority,
      joinedAt: new Date(now - visit.waitedMinutes * 60_000).toISOString(),
      status: visit.status,
      endedAt: visit.status === 'left' ? nowIso : null,
      serviceStartedAt: visit.status === 'serving' ? nowIso : null,
      completedAt: null,
    });
  }
}
