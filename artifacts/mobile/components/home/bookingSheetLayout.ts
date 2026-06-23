/** @deprecated Pre-measure estimate only — not a post-layout floor. */
export const BOOKING_SHEET_MIN_HEIGHT = 224;

export function getBookingSheetMaxHeight(screenHeight: number) {
  return Math.round(screenHeight * 0.76);
}

export function resolveBookingSheetHeight(
  contentHeight: number,
  explicitHeight: number | undefined,
  maxHeight: number,
) {
  const target = Math.round(explicitHeight ?? contentHeight);
  return Math.min(Math.max(1, target), maxHeight);
}

export function getBookingLayoutKey({
  showBooking,
  destination,
  destinationText,
  routeVisible,
}: {
  showBooking: boolean;
  destination: boolean;
  destinationText: string;
  routeVisible: boolean;
}) {
  return [
    showBooking ? 'open' : 'closed',
    destination ? 'destination' : 'pickup',
    destinationText.trim().length > 0 ? 'text' : 'blank',
    routeVisible ? 'route' : 'noroute',
  ].join(':');
}

export function getBookingSheetInstanceKey(sessionId: number, layoutKey: string) {
  return `${sessionId}:${layoutKey}`;
}
