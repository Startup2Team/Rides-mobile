import { getAppBackendClient } from '@/data/remote/client/appBackendClient';

// Real backend fare negotiation under /api/v1/customer/rides/{id}/negotiation/*.
// Both sides propose amounts / send messages until someone accepts or declines.

// Mirrors the app's NegotiationMessage domain vocabulary (see types/index.ts):
//   actorRole ← backend `sender`   ("customer" | "driver" | "system")
//   kind      ← backend `type`     ("offer" | "text")
// plus the offer outcome (`response`: ACCEPTED | DECLINED | ...) and `isFinal`.
export interface NegotiationEntry {
  id: string;
  rideId: string;
  actorRole: string; // customer | driver | system
  kind: string; // offer | text
  amount: number | null;
  text: string | null;
  response: string | null; // ACCEPTED | DECLINED | ... (offers only)
  isFinal: boolean;
  createdAt: string;
}

// Backend negotiation/history entry (internal/negotiation/service.go HistoryEntry).
// Note: the backend does NOT send a ride_id here — the caller already knows it
// from context, so we thread it in via the mapper.
export interface NegotiationHistoryEntryDto {
  id: string;
  type?: string; // "offer" | "text"
  sender?: string; // "customer" | "driver" | "system"
  amount?: number | null;
  response?: string | null;
  text?: string | null;
  is_final?: boolean;
  timestamp?: unknown; // RFC3339 string in practice; typed loosely as backend uses interface{}
}

interface Envelope<T> {
  data: T;
}

export function mapNegotiationHistoryEntry(
  dto: NegotiationHistoryEntryDto,
  rideId: string,
): NegotiationEntry {
  return {
    id: dto.id,
    rideId,
    actorRole: dto.sender ?? '',
    kind: dto.type ?? '',
    amount: dto.amount ?? null,
    text: dto.text ?? null,
    response: dto.response ?? null,
    isFinal: dto.is_final ?? false,
    createdAt: typeof dto.timestamp === 'string' ? dto.timestamp : '',
  };
}

const base = (rideId: string) => `/v1/customer/rides/${rideId}/negotiation`;

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
