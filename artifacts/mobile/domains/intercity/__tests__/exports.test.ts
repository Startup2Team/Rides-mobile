import { intercityRepository } from '../repository';
import {
  useBoardPassengerMutation,
  useCancelIntercityBookingMutation,
  useConfirmBookingMutation,
  useDriverIntercityTripsQuery,
  useHoldSeatsMutation,
  useIntercityBookingQuery,
  useIntercityBookingsQuery,
  useIntercityCorridorsQuery,
  useIntercityDriverVehiclesQuery,
  useIntercityManifestQuery,
  useIntercityTripLifecycleMutation,
  useIntercityTripQuery,
  useIntercityTripSearchQuery,
  useMarkNoShowMutation,
  usePublishIntercityTripMutation,
} from '../hooks';

describe('intercity domain exports', () => {
  test('exposes the whole booking and operator surface through one repository', () => {
    const expected = [
      'listCorridors',
      'searchTrips',
      'getTrip',
      'holdSeats',
      'confirmBooking',
      'listBookings',
      'getBooking',
      'cancelBooking',
      'publishTrip',
      'listDriverTrips',
      'getManifest',
      'boardPassenger',
      'markNoShow',
      'startTrip',
      'completeTrip',
      'cancelTrip',
    ] as const;
    expected.forEach(name => {
      expect(typeof intercityRepository[name]).toBe('function');
    });
  });

  test('exposes query-backed hooks for every screen', () => {
    [
      useIntercityCorridorsQuery,
      useIntercityTripSearchQuery,
      useIntercityTripQuery,
      useIntercityBookingsQuery,
      useIntercityBookingQuery,
      useHoldSeatsMutation,
      useConfirmBookingMutation,
      useCancelIntercityBookingMutation,
      useDriverIntercityTripsQuery,
      useIntercityManifestQuery,
      useIntercityDriverVehiclesQuery,
      usePublishIntercityTripMutation,
      useBoardPassengerMutation,
      useMarkNoShowMutation,
      useIntercityTripLifecycleMutation,
    ].forEach(hook => {
      expect(typeof hook).toBe('function');
    });
  });
});
