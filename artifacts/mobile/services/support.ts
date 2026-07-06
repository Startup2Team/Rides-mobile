import { getAppBackendClient } from '@/data/remote/client/appBackendClient';

// Real backend support tickets: POST /api/v1/customer/support/tickets.

export interface SupportTicketInput {
  subject: string;
  type: string; // e.g. ride_issue, payment, account, other
  rideId?: string | null;
}

export async function submitSupportTicket(input: SupportTicketInput): Promise<void> {
  const body: Record<string, unknown> = {
    subject: input.subject,
    type: input.type,
  };
  if (input.rideId) body.ride_id = input.rideId;
  await getAppBackendClient().post('/v1/customer/support/tickets', { body });
}
