import { useEffect } from 'react';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useQueryClient } from '@tanstack/react-query';
import { notificationKeys } from '@/query/keys';
import { triggerRideReconcile } from '@/state/rideReconcileTrigger';

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

// Push types meaning "the ride this device knows about may no longer be
// live" — a missed WS ride_cancelled self-heals by re-verifying against
// GET /rides/active (RideProvider's reconcileActiveRide) instead of only
// refreshing the notification badge and waiting for the next foreground/
// backstop check. ride_taken covers the "someone else took/ended this ride"
// family the backend sends alongside ride_cancelled.
const RIDE_RECONCILE_PUSH_TYPES = new Set(['ride_cancelled', 'ride_taken']);

function pushDataType(data: Record<string, unknown> | undefined): string {
  return typeof data?.type === 'string' ? data.type : '';
}

function routeForNotification(data: Record<string, unknown> | undefined): void {
  try {
    if (RIDE_FLOW_TYPES.has(pushDataType(data))) {
      router.push('/ride');
      return;
    }
    router.push('/notifications');
  } catch {
    // Router not ready (rare cold-start race) — the badge refresh still runs.
  }
}

// usePushNotifications wires the foreground + tap handlers for received pushes:
//   • foreground receipt → refresh the in-app feed + unread badge, and
//     reconcile the ride if the type implies it may be gone
//   • tap (background or cold start) → same reconcile, refresh, then
//     deep-link by type
// Mounted once, inside the query + navigation providers.
export function usePushNotifications(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    const refreshFeed = () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    };

    const handlePushData = (data: Record<string, unknown> | undefined) => {
      refreshFeed();
      if (RIDE_RECONCILE_PUSH_TYPES.has(pushDataType(data))) {
        triggerRideReconcile();
      }
    };

    // Foreground: a push arrived while the app is open — refresh so the badge
    // and list reflect it immediately (the OS still shows the banner).
    const receivedSub = Notifications.addNotificationReceivedListener(notification => {
      const data = notification.request.content.data as Record<string, unknown> | undefined;
      handlePushData(data);
    });

    // Tap on a notification (app backgrounded or foregrounded).
    const responseSub = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data as Record<string, unknown> | undefined;
      handlePushData(data);
      routeForNotification(data);
    });

    // Cold start: the app was launched by tapping a notification.
    void Notifications.getLastNotificationResponseAsync().then(response => {
      if (!response) return;
      const data = response.notification.request.content.data as Record<string, unknown> | undefined;
      handlePushData(data);
      routeForNotification(data);
    });

    return () => {
      receivedSub.remove();
      responseSub.remove();
    };
  }, [queryClient]);
}
