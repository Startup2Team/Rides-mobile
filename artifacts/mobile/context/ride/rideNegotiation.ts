import { NegotiationMessage, Ride } from '@/types';
import { NEGOTIATION_OFFER_LIMIT } from './rideConstants';
import { generateRideId } from './rideUtils';

function createOfferMessage(
  sender: 'customer' | 'driver',
  amount: number,
  isFinal?: boolean,
): NegotiationMessage {
  return {
    id: generateRideId(),
    sender,
    type: 'offer',
    amount,
    timestamp: new Date().toISOString(),
    ...(isFinal ? { isFinal: true } : {}),
  };
}

export function addCustomerCounterOffer(ride: Ride | null, amount: number): Ride | null {
  if (!ride) return null;
  const customerMessages = ride.negotiation.filter(
    message => message.sender === 'customer' && message.type === 'offer',
  );
  if (customerMessages.length >= NEGOTIATION_OFFER_LIMIT) return ride;

  return { ...ride, negotiation: [...ride.negotiation, createOfferMessage('customer', amount)] };
}

export function respondToCustomerCounterOffer(ride: Ride | null, amount: number): Ride | null {
  if (!ride || ride.status !== 'negotiating') return ride;
  const driverMessages = ride.negotiation.filter(
    message => message.sender === 'driver' && message.type === 'offer',
  );
  if (driverMessages.length >= NEGOTIATION_OFFER_LIMIT) return ride;

  const shouldAccept = amount >= ride.suggestedFare * 0.85 || Math.random() > 0.6;
  if (shouldAccept) {
    return {
      ...ride,
      status: 'confirmed',
      agreedFare: amount,
      negotiation: [...ride.negotiation, createOfferMessage('driver', amount, true)],
    };
  }

  const counter = Math.round((amount * 1.12) / 100) * 100;
  const driverAmount = Math.min(counter, Math.round(ride.suggestedFare * 1.1 / 100) * 100);
  return {
    ...ride,
    negotiation: [...ride.negotiation, createOfferMessage('driver', driverAmount)],
  };
}

export function acceptLatestDriverOffer(ride: Ride | null): Ride | null {
  if (!ride) return null;
  const lastDriverMsg = [...ride.negotiation].reverse().find(
    message => message.sender === 'driver' && message.type === 'offer',
  );
  if (!lastDriverMsg?.amount) return ride;
  return { ...ride, status: 'confirmed', agreedFare: lastDriverMsg.amount };
}

export function addDriverOffer(ride: Ride | null, amount: number): Ride | null {
  if (!ride || ride.status !== 'negotiating') return ride;
  const driverMessages = ride.negotiation.filter(
    message => message.sender === 'driver' && message.type === 'offer',
  );
  if (driverMessages.length >= NEGOTIATION_OFFER_LIMIT) return ride;

  return { ...ride, negotiation: [...ride.negotiation, createOfferMessage('driver', amount)] };
}

export function acceptLatestCustomerOffer(ride: Ride | null): Ride | null {
  if (!ride) return null;
  const lastCustomerMsg = [...ride.negotiation].reverse().find(
    message => message.sender === 'customer' && message.type === 'offer',
  );
  if (!lastCustomerMsg?.amount) return ride;

  return {
    ...ride,
    status: 'confirmed',
    agreedFare: lastCustomerMsg.amount,
    negotiation: [
      ...ride.negotiation,
      createOfferMessage('driver', lastCustomerMsg.amount, true),
    ],
  };
}

export function addCustomerAutoReply(ride: Ride | null, driverAmount: number): Ride | null {
  if (!ride || ride.status !== 'negotiating') return ride;
  const customerMessages = ride.negotiation.filter(
    message => message.sender === 'customer' && message.type === 'offer',
  );
  if (customerMessages.length >= NEGOTIATION_OFFER_LIMIT) return ride;

  // Accept straight away ~40% of the time, otherwise counter slightly lower
  const shouldAccept = Math.random() < 0.4;
  if (shouldAccept) {
    return {
      ...ride,
      negotiation: [...ride.negotiation, createOfferMessage('customer', driverAmount)],
    };
  }

  const counter = Math.round((driverAmount * 0.88) / 100) * 100;
  return {
    ...ride,
    negotiation: [...ride.negotiation, createOfferMessage('customer', Math.max(counter, 100))],
  };
}

export function acceptRideWithFare(ride: Ride | null, amount: number): Ride | null {
  if (!ride) return null;
  return { ...ride, status: 'confirmed', agreedFare: amount };
}
