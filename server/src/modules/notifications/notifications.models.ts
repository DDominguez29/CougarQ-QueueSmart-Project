export interface NotificationEntry {
  userId: string;
  queueEntryId: string;
  serviceName: string;
}

export interface NotificationItem extends NotificationEntry {
  id: string;
  type: 'joined' | 'near_turn';
  message: string;
  createdAt: string;
}
