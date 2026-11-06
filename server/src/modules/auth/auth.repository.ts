import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import type { Store } from '../../data/store.ts';
import { ApiError } from '../../shared/ApiError.ts';
import type { PublicUser, Session, User, UserRole } from './auth.models.ts';

export interface NewAccount {
  fullName: string;
  email: string;
  phone: string | null;
  passwordHash: string;
  role: UserRole;
}

export interface AuthRepository {
  createAccount(account: NewAccount): Promise<PublicUser>;
  findByEmail(email: string): Promise<User | undefined>;
  findById(id: string): Promise<PublicUser | undefined>;
  createSession(session: Session): Promise<void>;
  findSessionUser(tokenHash: string, now: number): Promise<PublicUser | undefined>;
  deleteSession(tokenHash: string): Promise<void>;
}

export function emailTaken(): ApiError {
  return new ApiError(409, 'EMAIL_TAKEN', 'An account with this email already exists.');
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const userColumns = `credentials.id, credentials.email, credentials.role,
  credentials.created_at AS "createdAt", profile.full_name AS "fullName", profile.phone`;

const userJoin = `user_credentials AS credentials
  JOIN user_profiles AS profile ON profile.user_id = credentials.id`;

interface UserRow {
  id: string;
  email: string;
  role: UserRole;
  createdAt: Date;
  fullName: string;
  phone: string | null;
  passwordHash?: string;
}

function toPublic(row: UserRow): PublicUser {
  return {
    id: row.id,
    fullName: row.fullName,
    email: row.email,
    phone: row.phone,
    role: row.role,
    createdAt: row.createdAt.toISOString(),
  };
}

function isUniqueEmailError(error: unknown) {
  return error instanceof Error && 'code' in error && error.code === '23505'
    && 'constraint' in error && error.constraint === 'user_credentials_email_unique';
}

export function createPostgresAuthRepository(database: Pool): AuthRepository {
  return {
    async createAccount(account) {
      const client = await database.connect();
      try {
        // Credentials and profile are saved together or not at all.
        await client.query('BEGIN');
        const credentials = await client.query<{ id: string; createdAt: Date }>(`
          INSERT INTO user_credentials (email, password_hash, role)
          VALUES ($1, $2, $3)
          RETURNING id, created_at AS "createdAt"`,
        [account.email, account.passwordHash, account.role]);
        const { id, createdAt } = credentials.rows[0];
        await client.query(
          'INSERT INTO user_profiles (user_id, full_name, phone) VALUES ($1, $2, $3)',
          [id, account.fullName, account.phone],
        );
        await client.query('COMMIT');
        return toPublic({ ...account, id, createdAt });
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        if (isUniqueEmailError(error)) throw emailTaken();
        throw error;
      } finally {
        client.release();
      }
    },

    async findByEmail(email) {
      const { rows } = await database.query<UserRow & { passwordHash: string }>(`
        SELECT ${userColumns}, credentials.password_hash AS "passwordHash"
        FROM ${userJoin} WHERE credentials.email = $1`, [email]);
      const row = rows[0];
      return row ? { ...toPublic(row), passwordHash: row.passwordHash } : undefined;
    },

    async findById(id) {
      if (!uuidPattern.test(id)) return undefined;
      const { rows } = await database.query<UserRow>(
        `SELECT ${userColumns} FROM ${userJoin} WHERE credentials.id = $1`, [id],
      );
      return rows[0] ? toPublic(rows[0]) : undefined;
    },

    async createSession(session) {
      await database.query(`
        INSERT INTO sessions (token_hash, user_id, created_at, expires_at)
        VALUES ($1, $2, $3, $4)`,
      [session.tokenHash, session.userId, new Date(session.createdAt), new Date(session.expiresAt)]);
    },

    async findSessionUser(tokenHash, now) {
      const { rows } = await database.query<UserRow>(`
        SELECT ${userColumns}
        FROM sessions AS session
        JOIN ${userJoin} ON credentials.id = session.user_id
        WHERE session.token_hash = $1 AND session.expires_at > $2`,
      [tokenHash, new Date(now)]);
      if (rows[0]) return toPublic(rows[0]);
      await database.query(
        'DELETE FROM sessions WHERE token_hash = $1 AND expires_at <= $2',
        [tokenHash, new Date(now)],
      );
      return undefined;
    },

    async deleteSession(tokenHash) {
      await database.query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash]);
    },
  };
}

function withoutHash(user: User): PublicUser {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    role: user.role,
    createdAt: user.createdAt,
  };
}

// Database-free version for unit tests; the running app uses PostgreSQL.
export function createMemoryAuthRepository(store: Store): AuthRepository {
  function lookup(email: string) {
    for (const user of store.users.values()) {
      if (user.email === email) return user;
    }
    return undefined;
  }

  return {
    async createAccount(account) {
      if (lookup(account.email)) throw emailTaken();
      const user: User = { id: randomUUID(), createdAt: new Date().toISOString(), ...account };
      store.users.set(user.id, user);
      return withoutHash(user);
    },
    async findByEmail(email) {
      const user = lookup(email);
      return user ? { ...user } : undefined;
    },
    async findById(id) {
      const user = store.users.get(id);
      return user ? withoutHash(user) : undefined;
    },
    async createSession(session) {
      store.sessions.set(session.tokenHash, { ...session });
    },
    async findSessionUser(tokenHash, now) {
      const session = store.sessions.get(tokenHash);
      if (!session) return undefined;
      if (session.expiresAt <= now) {
        store.sessions.delete(tokenHash);
        return undefined;
      }
      const user = store.users.get(session.userId);
      return user ? withoutHash(user) : undefined;
    },
    async deleteSession(tokenHash) {
      store.sessions.delete(tokenHash);
    },
  };
}
