# Notifications Domain

Query-backed notification domain for the one-app model.

This domain owns notification projection, read-state, and feed assembly. It remains backed by the current local repository and persistence format until a real backend notification channel exists.

Owns:
- notification item types
- notification categories
- notification read/unread state access
- notification list access
- mark read/unread actions
- read-all and clear behavior

Must not own:
- ride lifecycle truth
- payment truth
- driver package truth
- driver approval truth
- push transport implementation
- real-time event source

Current source files outside this domain:
- `persistence/notificationPersistence.ts`
- `app/notifications.tsx`
- `components/HomeTopHeader.tsx`
- `app/(driver)/index.tsx`

Current behavior:
- the feed is still locally generated from ride, driver, and static app state
- read-state persistence uses the existing `notification_read_state_v1` payload
- query hooks wrap the repository and keep the current visual behavior intact

Future migration plan:
- move the feed source to backend or event projections later
- keep read-state compatibility until transport and sync are ready
- reuse the same domain API when transport changes

Ownership:
- repository: `notificationRepository`
- store: none yet
- query: `useNotificationsQuery`, `useUnreadNotificationCountQuery`
- mutations: mark read, mark unread, mark all read, clear
- events: future notification-read / notification-unread projections
