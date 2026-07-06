import { getAppBackendClient } from '@/data/remote/client/appBackendClient';

// Real backend fare negotiation under /api/v1/customer/rides/{id}/negotiation/*.
// Both sides propose amounts / send messages until someone accepts or declines.

export interface NegotiationEntry {
  id: string;
  rideId: string;
  actorRole: string; // CUSTOMER | DRIVER
  kind: string; // proposal | message | accept | decline | ...
  amount: number | null;
  text: string | null;
  createdAt: string;
}

interface NegotiationEntryDto {
  id: string;
  ride_id: string;
  actor_role?: string;
  role?: string;
  kind?: string;
  type?: string;
  amount: number | null;
  text: string | null;
  created_at: string;
}

interface Envelope<T> {
  data: T;
}

function toEntry(dto: NegotiationEntryDto): NegotiationEntry {
  return {
    id: dto.id,
    rideId: dto.ride_id,
    actorRole: dto.actor_role ?? dto.role ?? '',
    kind: dto.kind ?? dto.type ?? '',
    amount: dto.amount ?? null,
    text: dto.text ?? null,
    createdAt: dto.created_at,
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
  const response = await getAppBackendClient().get<Envelope<NegotiationEntryDto[] | null>>(
    `${base(rideId)}/history`,
  );
  return (response.data.data ?? []).map(toEntry);
}
