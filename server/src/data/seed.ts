import { createUser } from '../modules/auth/auth.service.ts';
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
