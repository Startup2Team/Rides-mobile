import { loadVersionedStorage, saveVersionedStorage } from './versionedStorage';
import { z } from 'zod';

const schema = z.object({
  read: z.array(z.string()),
  unread: z.array(z.string()),
});

export type NotificationReadState = { read: Set<string>; unread: Set<string> };

const KEY = 'notification_read_state_v1';

export async function loadNotificationReadState(): Promise<NotificationReadState> {
  const result = await loadVersionedStorage(KEY, schema);
  return {
    read: new Set(result.data?.read ?? []),
    unread: new Set(result.data?.unread ?? []),
  };
}

export async function saveNotificationReadState(state: NotificationReadState): Promise<void> {
  await saveVersionedStorage(KEY, {
    read: [...state.read],
    unread: [...state.unread],
  });
}
