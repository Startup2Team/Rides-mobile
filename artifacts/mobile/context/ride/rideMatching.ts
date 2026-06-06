import {
  MOCK_DRIVERS,
  MockDriver,
  NegotiationMessage,
  Ride,
  RideLocation,
  VehicleType,
} from '@/types';
import {
  DRIVER_MATCH_MIN_DELAY_MS,
  DRIVER_MATCH_RANDOM_DELAY_MS,
} from './rideConstants';
import { calcDistance, calcFare } from './rideFare';
import { generateRideId } from './rideUtils';

export function getDriverMatchDelay(): number {
  return DRIVER_MATCH_MIN_DELAY_MS + Math.random() * DRIVER_MATCH_RANDOM_DELAY_MS;
}

export function pickMockDriver(vehicleType: VehicleType): MockDriver {
  const matching = MOCK_DRIVERS.filter(driver => driver.vehicleType === vehicleType);
  return matching.length > 0
    ? matching[Math.floor(Math.random() * matching.length)]
    : MOCK_DRIVERS[Math.floor(Math.random() * MOCK_DRIVERS.length)];
}

export function buildInitialNegotiationMessages(
  pickup: RideLocation,
  destination: RideLocation,
): NegotiationMessage[] {
  const isGeneric = pickup.locationType === 'generic' || destination.locationType === 'generic';
  if (!isGeneric) return [];

  const destLabel = destination.address ?? 'Unknown location';
  return [{
    id: generateRideId(),
    sender: 'system',
    type: 'text',
    text: `My destination is ${destLabel}. Please let me know your price.`,
    timestamp: new Date().toISOString(),
  }];
}

export function buildInitialDriverOffer(
  vehicleType: VehicleType,
  distance: number,
): NegotiationMessage {
  const amount = Math.round((calcFare(vehicleType, distance) * (1 + (Math.random() * 0.3))) / 100) * 100;
  return {
    id: generateRideId(),
    sender: 'driver',
    type: 'offer',
    amount,
    timestamp: new Date().toISOString(),
  };
}

export function buildMockRideRequest(): Ride {
  const pickup: RideLocation = {
    address: 'Kimironko Market',
    latitude: -1.9365,
    longitude: 30.1011,
    locationType: 'precise',
  };
  const destination: RideLocation = {
    address: 'Kigali City Tower',
    latitude: -1.9438,
    longitude: 30.0616,
    locationType: 'precise',
  };
  const distance = calcDistance(pickup, destination);

  return {
    id: generateRideId(),
    customerId: 'mock_customer',
    customerName: 'Amina K.',
    customerPhone: '+250788000000',
    vehicleType: 'moto',
    pickup,
    destination,
    status: 'searching',
    distance: parseFloat(distance.toFixed(2)),
    duration: Math.round(distance * 3 + 5),
    suggestedFare: calcFare('moto', distance),
    negotiation: [],
    createdAt: new Date().toISOString(),
  };
}
