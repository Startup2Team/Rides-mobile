export const intercityKeys = {
  all: ['intercity'] as const,
  corridors: () => ['intercity', 'corridors'] as const,
  trips: () => ['intercity', 'trips'] as const,
  tripSearch: ((corridor: string, date: string, seats: number) =>
    ['intercity', 'trips', corridor, date, seats] as const) as (
    corridor: string,
    date: string,
    seats: number,
  ) => readonly ['intercity', 'trips', string, string, number],
  trip: ((tripId: string) => ['intercity', 'trip', tripId] as const) as (
    tripId: string,
  ) => readonly ['intercity', 'trip', string],
  bookings: () => ['intercity', 'bookings'] as const,
  booking: ((bookingId: string) => ['intercity', 'booking', bookingId] as const) as (
    bookingId: string,
  ) => readonly ['intercity', 'booking', string],
  driverTrips: () => ['intercity', 'driver', 'trips'] as const,
  manifest: ((tripId: string) => ['intercity', 'manifest', tripId] as const) as (
    tripId: string,
  ) => readonly ['intercity', 'manifest', string],
  driverVehicles: () => ['intercity', 'driver', 'vehicles'] as const,
} as const;
