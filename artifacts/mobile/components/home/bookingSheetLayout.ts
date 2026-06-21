export const BOOKING_SHEET_MIN_HEIGHT = 224;

export function getBookingSheetMaxHeight(screenHeight: number) {
  return Math.round(screenHeight * 0.76);
}

export function resolveBookingSheetHeight(
  contentHeight: number,
  explicitHeight: number | undefined,
  maxHeight: number,
) {
  return Math.max(
    BOOKING_SHEET_MIN_HEIGHT,
    Math.min(explicitHeight ?? contentHeight, maxHeight),
  );
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
