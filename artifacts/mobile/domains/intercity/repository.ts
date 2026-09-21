import {
  boardPassenger,
  cancelBooking,
  cancelTrip,
  completeTrip,
  confirmBooking,
  getBooking,
  getManifest,
  getTrip,
  holdSeats,
  listBookings,
  listCorridors,
  listDriverTrips,
  markNoShow,
  publishTrip,
  searchTrips,
  startTrip,
} from '@/services/intercity';

// The single seam between intercity screens and the backend. Every field the
// UI renders passes through `services/intercity.ts`, which is where
// `sellable_seats` is dropped on the floor (see the note there) — screens
// never see the raw DTO, so they cannot leak an operator's credit balance.
export const intercityRepository = {
  listCorridors,
  searchTrips,
  getTrip,
  holdSeats,
  confirmBooking,
  listBookings,
  getBooking,
  cancelBooking,
  publishTrip,
  listDriverTrips,
  getManifest,
  boardPassenger,
  markNoShow,
  startTrip,
  completeTrip,
  cancelTrip,
} as const;

export type IntercityRepository = typeof intercityRepository;
