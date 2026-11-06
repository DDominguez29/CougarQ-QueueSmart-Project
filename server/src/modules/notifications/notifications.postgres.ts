import type { Pool, PoolClient } from 'pg';
import { ApiError } from '../../shared/ApiError.ts';
import type { NotificationItem } from './notifications.models.ts';

export type NotificationType = 'joined' | 'near_turn';
export type SqlConnection = Pick<Pool | PoolClient, 'query'>;

interface NotificationRow {
  id: string;
  user_id: string;
  queue_entry_id: string;
  service_name_snapshot: string;
  type: NotificationType;
  message: string;
  created_at: Date | string;
}

function toItem(row: NotificationRow): NotificationItem {
  return {
    id: row.id,
    userId: row.user_id,
    queueEntryId: row.queue_entry_id,
    serviceName: row.service_name_snapshot,
    type: row.type,
    message: row.message,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

// Use only server-verified identities. All SQL values are parameterized.
export function createPostgresNotificationRepository(database: SqlConnection) {
  return {
    async list(userId: string): Promise<NotificationItem[]> {
      const result = await database.query<NotificationRow>(`
        SELECT n.id, n.user_id, n.queue_entry_id,
               e.service_name_snapshot, n.type, n.message, n.created_at
          FROM notifications AS n
          JOIN queue_entries AS e ON e.id = n.queue_entry_id
         WHERE n.user_id = $1 AND n.dismissed_at IS NULL
         ORDER BY n.created_at DESC, n.id DESC
      `, [userId]);
      return result.rows.map(toItem);
    },

    async remove(userId: string, notificationId: string): Promise<void> {
      const result = await database.query<{ id: string }>(`
        UPDATE notifications
           SET dismissed_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND user_id = $2 AND dismissed_at IS NULL
         RETURNING id
      `, [notificationId, userId]);
      if (result.rows.length === 0) {
        throw new ApiError(404, 'NOTIFICATION_NOT_FOUND', 'Notification not found.');
      }
    },

    async markViewed(userId: string, notificationId: string): Promise<void> {
      const result = await database.query<{ id: string }>(`
        UPDATE notifications
           SET status = 'viewed', viewed_at = COALESCE(viewed_at, CURRENT_TIMESTAMP)
         WHERE id = $1 AND user_id = $2 AND dismissed_at IS NULL
         RETURNING id
      `, [notificationId, userId]);
      if (result.rows.length === 0) {
        throw new ApiError(404, 'NOTIFICATION_NOT_FOUND', 'Notification not found.');
      }
    },

    // Call once a matching queue_entries row has been committed, or within
    // the SAME transaction (pass its PoolClient). The unique constraint
    // suppresses events even across process restarts and after dismissal.
    async emit(userId: string, queueEntryId: string, type: NotificationType, message: string): Promise<NotificationItem | null> {
      const result = await database.query<NotificationRow>(`
        WITH inserted AS (
          INSERT INTO notifications (user_id, queue_entry_id, type, message)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (user_id, queue_entry_id, type) DO NOTHING
          RETURNING *
        )
        SELECT n.id, n.user_id, n.queue_entry_id,
               e.service_name_snapshot, n.type, n.message, n.created_at
          FROM inserted AS n
          JOIN queue_entries AS e ON e.id = n.queue_entry_id
      `, [userId, queueEntryId, type, message]);
      return result.rows[0] ? toItem(result.rows[0]) : null;
    },
  };
}
