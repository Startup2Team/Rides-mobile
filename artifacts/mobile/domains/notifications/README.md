# Notifications Domain

Owns notification read-state and feed projection.

Owns:
- notification read state
- notification feed projection

Must not own:
- ride lifecycle truth
- booking draft
- package entitlements

Current source files outside this domain:
- `persistence/notificationPersistence.ts`
- `app/notifications.tsx`
- `components/HomeTopHeader.tsx`

Future migration plan:
- move notification behavior into `domains/notifications`
- keep source-of-truth data behind `NotificationRepository`

Ownership:
- repository: `NotificationRepository`
- store: none yet
- query: future notifications query hooks
- events: notification-read, notification-unread
