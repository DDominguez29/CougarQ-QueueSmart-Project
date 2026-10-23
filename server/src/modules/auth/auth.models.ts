export type UserRole = 'user' | 'admin';

export interface User {
  id: string;
  fullName: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  createdAt: string;
}

export type PublicUser = Omit<User, 'passwordHash'>;

export interface Session {
  token: string;
  userId: string;
  expiresAt: number;
}
