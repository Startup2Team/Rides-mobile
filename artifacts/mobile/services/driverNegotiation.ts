import { getAppBackendClient } from '@/data/remote/client/appBackendClient';
import {
  mapNegotiationHistoryEntry,
  type NegotiationEntry,
  type NegotiationHistoryEntryDto,
} from '@/services/negotiation';

// Driver side of fare negotiation under /api/v1/driver/rides/{id}/negotiation/*.
// Adds lock-fare (fix a manual fare) and initiate-call vs the customer side.
// Shares the history DTO + mapper with the customer side (same backend shape).

interface Envelope<T> {
  data: T;
}

const base = (rideId: string) => `/v1/driver/rides/${rideId}/negotiation`;

export async function proposeFare(rideId: string, amount: number): Promise<void> {
  await getAppBackendClient().post(`${base(rideId)}/propose`, { body: { amount } });
}

export async function acceptFare(rideId: string): Promise<void> {
  await getAppBackendClient().post(`${base(rideId)}/accept`, {});
}

export async function declineFare(rideId: string): Promise<void> {
  await getAppBackendClient().post(`${base(rideId)}/decline`, {});
}

export async function sendNegotiationMessage(rideId: string, text: string): Promise<void> {
  await getAppBackendClient().post(`${base(rideId)}/message`, { body: { text } });
}

export async function getNegotiationHistory(rideId: string): Promise<NegotiationEntry[]> {
  const response = await getAppBackendClient().get<Envelope<NegotiationHistoryEntryDto[] | null>>(
    `${base(rideId)}/history`,
  );
  return (response.data.data ?? []).map(entry => mapNegotiationHistoryEntry(entry, rideId));
}

// Driver-only: lock a manual (non-negotiated) fare.
export async function lockManualFare(rideId: string, amount: number): Promise<void> {
  await getAppBackendClient().post(`${base(rideId)}/lock-fare`, { body: { amount } });
}

// Driver-only: signal an in-app/phone call to the customer.
export async function initiateCall(rideId: string): Promise<void> {
  await getAppBackendClient().post(`${base(rideId)}/initiate-call`, {});
}
