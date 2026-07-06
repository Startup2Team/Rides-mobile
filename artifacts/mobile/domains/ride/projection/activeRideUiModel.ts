import type { Ride, RideStatus as AppRideStatus } from '@/types';
import type { ActiveRideReadModel, RidePhase } from '../readModels';

export interface ActiveRideUiSummary {
  source: 'live' | 'projected';
  statusLabel: AppRideStatus;
  phaseLabel: string;
  etaText: string | null;
  statusMessage: string;
}

function mapProjectedStatusToRideStatus(status: ActiveRideReadModel['status']): AppRideStatus {
  switch (status) {
    case 'requested':
      return 'searching';
    case 'matching':
      return 'driver_assigned';
    case 'offered':
      return 'negotiating';
    case 'accepted':
      return 'confirmed';
    case 'driver_en_route':
      return 'arriving';
    case 'driver_arrived':
      return 'arrived';
    case 'started':
      return 'in_progress';
    case 'completed':
      return 'completed';
    case 'fare_finalized':
    case 'payment_authorized':
    case 'payment_completed':
    case 'rating_submitted':
      return 'completed';
    case 'cancelled':
      return 'cancelled';
    case 'timeout':
      return 'cancelled';
    default:
      return 'searching';
  }
}

function mapProjectedPhaseToLabel(phase: RidePhase | null | undefined, status: AppRideStatus): string {
  if (phase) {
    return phase.replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase());
  }

  switch (status) {
    case 'searching':
    case 'driver_assigned':
    case 'negotiating':
      return 'Matching';
    case 'confirmed':
    case 'arriving':
    case 'arrived':
      return 'Accepted';
    case 'in_progress':
      return 'Active';
    case 'completed':
    case 'cancelled':
      return 'Closed';
    default:
      return 'Live';
  }
}

function mapStatusMessage(status: AppRideStatus) {
  switch (status) {
    case 'searching':
      return 'Looking for a driver';
    case 'driver_assigned':
    case 'negotiating':
    case 'confirmed':
      return 'Ride confirmed';
    case 'arriving':
      return 'Driver is on the way';
    case 'arrived':
      return 'Your driver has arrived!';
    case 'in_progress':
      return 'Heading to destination';
    case 'completed':
      return 'Ride completed!';
    case 'cancelled':
      return 'Ride cancelled';
    default:
      return 'Ride confirmed';
  }
}

export function mapProjectedActiveRideToRideLike(
  liveRide: Ride | null,
  projectedRide: ActiveRideReadModel | null,
): Ride | null {
  if (!projectedRide) return liveRide;

  const rideStatus = mapProjectedStatusToRideStatus(projectedRide.status);
  const customerName = projectedRide.customer.displayName ?? liveRide?.customerName ?? 'Customer';
  const driverName = projectedRide.driver?.displayName ?? liveRide?.driverName ?? 'Driver';
  const driverEta = projectedRide.etaMinutes ?? liveRide?.driver?.eta ?? 0;
  const driverLocation = liveRide?.driver?.location ?? {
    latitude: projectedRide.pickup.latitude,
    longitude: projectedRide.pickup.longitude,
  };

  return {
    id: projectedRide.rideId,
    customerId: projectedRide.customer.userId,
    customerName,
    customerPhone: liveRide?.customerPhone ?? '',
    customerImage: liveRide?.customerImage,
    customerRating: liveRide?.customerRating,
    driverId: projectedRide.driver?.userId ?? liveRide?.driverId,
    driverName,
    driver: projectedRide.driver || liveRide?.driver
      ? {
          id: projectedRide.driver?.userId ?? liveRide?.driver?.id ?? projectedRide.driver?.userId ?? 'driver',
          name: driverName,
          phone: liveRide?.driver?.phone ?? '',
          vehicleType: liveRide?.driver?.vehicleType ?? liveRide?.vehicleType ?? 'moto',
          plateNumber: liveRide?.driver?.plateNumber ?? '',
          profileImage: liveRide?.driver?.profileImage,
          location: driverLocation,
          rating: liveRide?.driver?.rating ?? 0,
          eta: driverEta,
        }
      : undefined,
    vehicleType: liveRide?.vehicleType ?? 'moto',
    vehicleId: liveRide?.vehicleId,
    requestedVehicleType: liveRide?.requestedVehicleType,
    matchedVehicleType: liveRide?.matchedVehicleType,
    matchedVehicleId: liveRide?.matchedVehicleId,
    pickup: {
      ...projectedRide.pickup,
      locationType: liveRide?.pickup.locationType,
    },
    destination: {
      ...projectedRide.destination,
      locationType: liveRide?.destination.locationType,
    },
    status: rideStatus,
    distance: liveRide?.distance ?? 0,
    duration: liveRide?.duration ?? 0,
    suggestedFare: liveRide?.suggestedFare ?? projectedRide.fare?.amount ?? 0,
    agreedFare: liveRide?.agreedFare ?? projectedRide.fare?.amount,
    negotiation: liveRide?.negotiation ?? [],
    createdAt: liveRide?.createdAt ?? projectedRide.updatedAt,
    completedAt: liveRide?.completedAt ?? projectedRide.fare?.finalizedAt ?? undefined,
    arrivedAt: liveRide?.arrivedAt ?? projectedRide.updatedAt ?? undefined,
    waitStartedAt: liveRide?.waitStartedAt ?? undefined,
  };
}

export function createActiveRideUiSummary(
  selectedRide: Ride | null,
  projectedRide: ActiveRideReadModel | null,
  source: 'live' | 'projected',
): ActiveRideUiSummary {
  const statusLabel = selectedRide?.status ?? 'searching';
  const phaseLabel = projectedRide
    ? mapProjectedPhaseToLabel(projectedRide.phase, selectedRide?.status ?? 'searching')
    : mapProjectedPhaseToLabel(null, selectedRide?.status ?? 'searching');
  const etaText = selectedRide?.driver?.eta != null
    ? `${selectedRide.driver.eta} min`
    : projectedRide?.etaMinutes != null
      ? `${projectedRide.etaMinutes} min`
      : null;

  return {
    source,
    statusLabel,
    phaseLabel,
    etaText,
    statusMessage: mapStatusMessage(selectedRide?.status ?? 'searching'),
  };
}

export function mapProjectedStatusToUIStatus(status: ActiveRideReadModel['status']): Ride['status'] {
  return mapProjectedStatusToRideStatus(status);
}
