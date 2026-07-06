export const notificationKeys = {
  all: ['notifications'] as const,
  list: ((userId?: string | null) => (
    userId == null ? ['notifications', 'list'] as const : ['notifications', userId, 'list'] as const
  )) as {
    (): readonly ['notifications', 'list'];
    (userId: string | null | undefined): readonly ['notifications', string, 'list'];
  },
  unreadCount: ((userId?: string | null) => (
    userId == null ? ['notifications', 'unread-count'] as const : ['notifications', userId, 'unread-count'] as const
  )) as {
    (): readonly ['notifications', 'unread-count'];
    (userId: string | null | undefined): readonly ['notifications', string, 'unread-count'];
  },
} as const;
