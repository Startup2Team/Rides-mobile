import { api } from './api';

export interface SubmitTicketPayload {
  subject: string;
  type: string;
  ride_id?: string;
}

export async function submitSupportTicket(payload: SubmitTicketPayload) {
  const { data } = await api.post('/customer/support/tickets', payload);
  return data;
}
