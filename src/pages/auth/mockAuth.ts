// TODO: replace with API calls once the backend is added.

export type UserRole = 'user' | 'admin';

export interface MockAccount {
  fullName: string;
  email: string;
  password: string;
  role: UserRole;
}

const mockAccounts: MockAccount[] = [
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
];

function normalize(email: string) {
  return email.trim().toLowerCase();
}

export function findAccount(email: string, password: string) {
  return mockAccounts.find(
    (account) =>
      normalize(account.email) === normalize(email) &&
      account.password === password,
  );
}

export function emailExists(email: string) {
  return mockAccounts.some(
    (account) => normalize(account.email) === normalize(email),
  );
}

export function registerAccount(fullName: string, email: string, password: string) {
  mockAccounts.push({
    fullName: fullName.trim(),
    email: normalize(email),
    password,
    role: 'user',
  });
}
