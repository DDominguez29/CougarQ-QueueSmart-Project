export type UserRole = 'user' | 'admin';

export interface User {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  passwordHash: string;
  role: UserRole;
  createdAt: string;
}

export type PublicUser = Omit<User, 'passwordHash'>;

export interface Session {
  tokenHash: string;
  userId: string;
  createdAt: number;
  expiresAt: number;
}
