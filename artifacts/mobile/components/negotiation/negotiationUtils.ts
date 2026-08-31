export const MAX_OFFERS = 3;
export const WARNING = '#FF9500';
export const INPUT_DOCK_HEIGHT = 64;
export const DRIVER_TYPING_DELAY_MS = 450;
// Mirrors the backend's negotiation/message contract (1-500 chars).
export const MAX_NEGOTIATION_MESSAGE_LENGTH = 500;

export type NegotiationStatusTone = 'neutral' | 'active' | 'waiting' | 'limit';

export function formatFare(amount?: number) {
  // Fares are whole RWF — round defensively so a float never renders decimals.
  return amount ? `${Math.round(amount).toLocaleString()} RWF` : '--';
}

export function formatMessageTime(timestamp: string) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
