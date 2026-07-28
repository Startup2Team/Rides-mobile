import { useEffect } from 'react';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useQueryClient } from '@tanstack/react-query';
import { notificationKeys } from '@/query/keys';

// Notification data payloads carry a `type` (matching the backend's nType /
// data.type) that we use to deep-link on tap. Ride/negotiation events take the
// user to the live ride screen (which recovers the active ride from context);
// everything else opens the notifications list.
const RIDE_FLOW_TYPES = new Set([
  'ride_request',
  'driver_matched',
  'ride_confirmed',
  'driver_en_route',
  'driver_arrived',
  'ride_started',
  'negotiation_message',
]);

function routeForNotification(data: Record<string, unknown> | undefined): void {
  const type = typeof data?.type === 'string' ? data.type : '';
  try {
    if (RIDE_FLOW_TYPES.has(type)) {
      router.push('/ride');
      return;
    }
    router.push('/notifications');
  } catch {
    // Router not ready (rare cold-start race) — the badge refresh still runs.
  }
}

// usePushNotifications wires the foreground + tap handlers for received pushes:
//   • foreground receipt → refresh the in-app feed + unread badge
//   • tap (background or cold start) → refresh, then deep-link by type
// Mounted once, inside the query + navigation providers.
export function usePushNotifications(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    const refreshFeed = () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    };

    // Foreground: a push arrived while the app is open — refresh so the badge
    // and list reflect it immediately (the OS still shows the banner).
    const receivedSub = Notifications.addNotificationReceivedListener(() => {
      refreshFeed();
    });

    // Tap on a notification (app backgrounded or foregrounded).
    const responseSub = Notifications.addNotificationResponseReceivedListener(response => {
      refreshFeed();
      const data = response.notification.request.content.data as Record<string, unknown> | undefined;
      routeForNotification(data);
    });

    // Cold start: the app was launched by tapping a notification.
    void Notifications.getLastNotificationResponseAsync().then(response => {
      if (!response) return;
      refreshFeed();
      const data = response.notification.request.content.data as Record<string, unknown> | undefined;
      routeForNotification(data);
    });

    return () => {
      receivedSub.remove();
      responseSub.remove();
    };
  }, [queryClient]);
}
