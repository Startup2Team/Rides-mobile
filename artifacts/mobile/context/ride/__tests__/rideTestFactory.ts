import type { NegotiationMessage, Ride } from '@/types';

export function createRide(overrides: Partial<Ride> = {}): Ride {
  return {
    id: 'ride-1',
    customerId: 'customer-1',
    customerName: 'Customer',
    customerPhone: '+250788000000',
    vehicleType: 'moto',
    pickup: {
      address: 'Pickup',
      latitude: -1.94,
      longitude: 30.06,
      locationType: 'precise',
    },
    destination: {
      address: 'Destination',
      latitude: -1.95,
      longitude: 30.08,
      locationType: 'precise',
    },
    status: 'negotiating',
    distance: 3,
    duration: 14,
    suggestedFare: 1200,
    negotiation: [],
    createdAt: '2026-06-06T10:00:00.000Z',
    ...overrides,
  };
}

export function createOffer(
  sender: 'customer' | 'driver',
  amount: number,
  id: string,
): NegotiationMessage {
  return {
    id,
    sender,
    type: 'offer',
    amount,
    timestamp: '2026-06-06T10:00:00.000Z',
  };
}
