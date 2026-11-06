import type { Pool } from 'pg';
import { hashPassword } from '../modules/auth/auth.service.ts';
import { DEMO_ACCOUNTS } from './seed.ts';

// Explicit demo setup. Existing accounts keep their current password and profile.
export async function seedDatabaseAccounts(database: Pool): Promise<number> {
  const client = await database.connect();
  let added = 0;
  try {
    await client.query('BEGIN');
    for (const account of DEMO_ACCOUNTS) {
      const { rows } = await client.query<{ id: string }>(`
        INSERT INTO user_credentials (email, password_hash, role)
        VALUES ($1, $2, $3) ON CONFLICT (email) DO NOTHING RETURNING id`,
      [account.email, hashPassword(account.password), account.role]);
      if (!rows[0]) continue;
      await client.query(
        'INSERT INTO user_profiles (user_id, full_name) VALUES ($1, $2)',
        [rows[0].id, account.fullName],
      );
      added += 1;
    }
    await client.query('COMMIT');
    return added;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
