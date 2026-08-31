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

function createTextMessage(sender: 'customer' | 'driver', text: string, id: string): NegotiationMessage {
  return {
    id,
    sender,
    type: 'text',
    text,
    timestamp: new Date().toISOString(),
    // Optimistic bubble: not confirmed delivered yet. Flipped to 'sent' or
    // 'failed' by setNegotiationMessageDeliveryStatus once the backend call
    // settles — never rendered as if it were already delivered.
    deliveryStatus: 'pending',
  };
}

// Optimistically show the local user's own free-text negotiation message.
// Mirrors addCustomerCounterOffer/addDriverOffer: only while NEGOTIATING (the
// backend rejects the message call otherwise), the real thread stays in sync
// via the WS `negotiation_text` event / history replay on resume.
//
// `id` is caller-supplied so a retry can pass back the SAME id: when it
// already exists in the thread this replaces that bubble in place (reset to
// 'pending') instead of appending a duplicate. Omit it for a first send.
export function addCustomerTextMessage(
  ride: Ride | null,
  text: string,
  id: string = generateRideId(),
): Ride | null {
  if (!ride || ride.status !== 'negotiating') return ride;
  const trimmed = text.trim();
  if (!trimmed) return ride;
  return { ...ride, negotiation: upsertMessage(ride.negotiation, createTextMessage('customer', trimmed, id)) };
}

export function addDriverTextMessage(
  ride: Ride | null,
  text: string,
  id: string = generateRideId(),
): Ride | null {
  if (!ride || ride.status !== 'negotiating') return ride;
  const trimmed = text.trim();
  if (!trimmed) return ride;
  return { ...ride, negotiation: upsertMessage(ride.negotiation, createTextMessage('driver', trimmed, id)) };
}

// Replace an existing message with the same id in place (retry), or append
// if it's not there yet (first send).
function upsertMessage(negotiation: NegotiationMessage[], message: NegotiationMessage): NegotiationMessage[] {
  const existingIndex = negotiation.findIndex(existing => existing.id === message.id);
  if (existingIndex === -1) return [...negotiation, message];
  const next = [...negotiation];
  next[existingIndex] = message;
  return next;
}

// Settle an optimistic message's delivery state once the backend call
// resolves. No-op if the ride/message is gone (e.g. history replay already
// rebuilt the thread from server truth during this await).
export function setNegotiationMessageDeliveryStatus(
  ride: Ride | null,
  id: string,
  deliveryStatus: 'sent' | 'failed',
): Ride | null {
  if (!ride) return ride;
  const index = ride.negotiation.findIndex(message => message.id === id);
  if (index === -1) return ride;
  const negotiation = [...ride.negotiation];
  negotiation[index] = { ...negotiation[index], deliveryStatus };
  return { ...ride, negotiation };
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
