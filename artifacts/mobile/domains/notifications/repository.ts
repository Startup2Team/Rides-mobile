import type { DriverEntitlement } from '@/domain/driverRidePackages';
import { getPackagePurchaseSnapshot, type DriverEntitlement as DriverEntitlementType } from '@/domain/driverRidePackages';
import { notificationRepository as baseNotificationRepository } from '@/data/repositories';
import type { Ride } from '@/types';
import type {
  NotificationFeedContext,
  NotificationItem,
  NotificationReadState,
} from './types';
import { APPLE_SYSTEM_BLUE_HEX } from '@/constants/systemColors';

export const notificationRepository = baseNotificationRepository;

export type { NotificationFeedContext, NotificationItem, NotificationReadState } from './types';

const TYPE_ICON_COLOR: Record<NotificationItem['type'], string> = {
  ride: APPLE_SYSTEM_BLUE_HEX.light,
  promo: '#FFB800',
  system: '#007AFF',
  safety: '#FF3B30',
};

function buildRideNotifications(rideHistory: { id: string; destination?: { address?: string }; agreedFare?: number; completedAt?: string }[]): NotificationItem[] {
  return rideHistory.slice(0, 5).map(ride => ({
    id: `ride_${ride.id}`,
    type: 'ride' as const,
    icon: 'check-circle',
    title: 'Ride completed',
    message: `Your ride to ${ride.destination?.address ?? 'destination'} was completed. Fare: ${ride.agreedFare?.toLocaleString() ?? '—'} RWF`,
    time: ride.completedAt ?? new Date().toISOString(),
    read: true,
    rideId: ride.id,
  }));
}

function buildDriverNotifications({
  currentRide,
  driverId,
  entitlement,
  pendingRequest,
  rideHistory,
  rideCredits,
}: {
  currentRide: Ride | null;
  driverId?: string;
  entitlement: DriverEntitlementType;
  pendingRequest: Ride | null;
  rideHistory: Ride[];
  rideCredits: number;
}): NotificationItem[] {
  const tripNotifications = rideHistory
    .filter(ride => ride.status === 'completed' && ride.driverId === driverId)
    .slice(0, 5)
    .map(ride => ({
      id: `driver_ride_${ride.id}`,
      type: 'ride' as const,
      icon: 'check-circle' as const,
      title: 'Trip completed',
      message: `Trip to ${ride.destination?.address ?? 'destination'} completed. Ride revenue: ${ride.agreedFare?.toLocaleString() ?? '—'} RWF`,
      time: ride.completedAt ?? ride.createdAt,
      read: true,
      rideId: ride.id,
    }));

  const liveTripNotifications: NotificationItem[] = [];
  if (pendingRequest) {
    liveTripNotifications.push({
      id: `driver_request_${pendingRequest.id}`,
      type: 'ride',
      icon: 'bell',
      title: 'New ride request',
      message: `${pendingRequest.pickup.address ?? 'Pickup'} to ${pendingRequest.destination.address ?? 'destination'}`,
      time: pendingRequest.createdAt,
      read: false,
      rideId: pendingRequest.id,
    });
  } else if (currentRide && !['completed', 'cancelled', 'idle'].includes(currentRide.status)) {
    liveTripNotifications.push({
      id: `driver_active_${currentRide.id}`,
      type: 'ride',
      icon: 'navigation',
      title: 'Active trip',
      message: `${currentRide.pickup.address ?? 'Pickup'} to ${currentRide.destination.address ?? 'destination'}`,
      time: currentRide.createdAt,
      read: false,
      rideId: currentRide.id,
    });
  }

  const packageNotifications = entitlement.purchaseHistory.slice(0, 3).map(purchase => {
    const purchaseSnapshot = getPackagePurchaseSnapshot(purchase);
    const successful = purchase.status === 'successful';
    return {
      id: `driver_package_${purchase.transactionId}`,
      type: successful ? 'system' as const : 'safety' as const,
      icon: successful ? 'package' as const : 'alert-circle' as const,
      title: successful ? 'Ride package activated' : 'Ride package update',
      message: successful
        ? `${purchaseSnapshot?.packageName ?? purchase.packageId} is active with ${purchaseSnapshot?.ridesGranted ?? purchase.ridesGranted ?? 0} rides.`
        : `${purchaseSnapshot?.packageName ?? purchase.packageId} payment status: ${purchase.status}.`,
      time: purchase.completedAt ?? purchase.purchasedAt ?? purchase.createdAt,
      read: successful,
    };
  });

  const creditNotifications: NotificationItem[] = [];
  if (rideCredits <= 5) {
    creditNotifications.push({
      id: `driver_low_credits_${rideCredits}`,
      type: rideCredits === 0 ? 'safety' : 'system',
      icon: 'alert-circle',
      title: rideCredits === 0 ? 'No rides left' : 'Rides running low',
      message: rideCredits === 0
        ? 'View ride packages to continue receiving ride requests.'
        : `${rideCredits} rides left. View packages before they run out.`,
      time: entitlement.updatedAt || new Date().toISOString(),
      read: false,
    });
  }

  return [...liveTripNotifications, ...creditNotifications, ...packageNotifications, ...tripNotifications];
}

const STATIC_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'safety_1',
    type: 'safety',
    icon: 'shield',
    title: 'Safety reminder',
    message: 'Always confirm the plate number and driver name before starting your ride.',
    time: new Date(Date.now() - 3600000).toISOString(),
    read: false,
  },
  {
    id: 'system_1',
    type: 'system',
    icon: 'map-pin',
    title: 'Drivers nearby',
    message: 'Moto and cab drivers are available around your area right now.',
    time: new Date(Date.now() - 7200000).toISOString(),
    read: true,
  },
  {
    id: 'promo_1',
    type: 'promo',
    icon: 'gift',
    title: 'Weekend promo',
    message: 'Get 15% off your next 2 rides this weekend.',
    time: new Date(Date.now() - 26 * 3600000).toISOString(),
    read: true,
  },
  {
    id: 'system_2',
    type: 'system',
    icon: 'clock',
    title: 'App update',
    message: 'Performance and reliability improvements are now live.',
    time: new Date(Date.now() - 4 * 24 * 3600000).toISOString(),
    read: true,
  },
];

export async function listNotifications(input: NotificationFeedContext): Promise<NotificationItem[]> {
  const state = await notificationRepository.getReadState();
  const modeNotifications = input.driverMode
    ? buildDriverNotifications({
        currentRide: input.currentRide,
        driverId: input.driverId,
        entitlement: input.entitlement,
        pendingRequest: input.pendingRequest,
        rideHistory: input.rideHistory,
        rideCredits: input.rideCredits,
      })
    : [...STATIC_NOTIFICATIONS, ...buildRideNotifications(input.rideHistory)];

  return modeNotifications
    .map(notification => {
      if (state.unread.has(notification.id)) return { ...notification, read: false };
      if (state.read.has(notification.id)) return { ...notification, read: true };
      return notification;
    })
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
}

export async function getUnreadNotificationCount(input: NotificationFeedContext): Promise<number> {
  const notifications = await listNotifications(input);
  return notifications.filter(notification => !notification.read).length;
}

export function getNotificationAccentColor(type: NotificationItem['type']) {
  return TYPE_ICON_COLOR[type];
}

export { createRemoteNotificationRepositoryPrototype, createNotificationShadowRepository } from '@/data/remote/repositories/RemoteNotificationRepository';
