import type { DriverEntitlement } from '@/domain/driverRidePackages';
import type { Ride } from '@/types';
import type { NotificationReadState } from '@/persistence/notificationPersistence';

export type NotificationCategory = 'ride' | 'promo' | 'system' | 'safety';

export type NotificationIconName =
  | 'check-circle'
  | 'bell'
  | 'navigation'
  | 'package'
  | 'alert-circle'
  | 'shield'
  | 'map-pin'
  | 'gift'
  | 'clock';

export interface NotificationItem {
  id: string;
  type: NotificationCategory;
  icon: NotificationIconName;
  title: string;
  message: string;
  time: string;
  read: boolean;
  rideId?: string;
  // 'backend' items are real push records whose read-state is synced to the
  // server; locally-derived items (ride history, packages, static) are omitted
  // and stay local-only.
  source?: 'backend' | 'local';
}

export interface NotificationFeedContext {
  currentRide: Ride | null;
  pendingRequest: Ride | null;
  rideHistory: Ride[];
  driverId?: string;
  driverMode: boolean;
  entitlement: DriverEntitlement;
  rideCredits: number;
}

export interface NotificationsSnapshot {
  notifications: NotificationItem[];
  unreadCount: number;
}

export type { NotificationReadState };
