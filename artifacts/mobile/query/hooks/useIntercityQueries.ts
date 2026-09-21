import { useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { listBackendVehicles, type BackendDriverVehicle } from '@/services/driverVehicles';
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
  type IntercityBooking,
  type IntercityCorridor,
  type IntercityManifest,
  type IntercityTrip,
  type PublishIntercityTripInput,
} from '@/services/intercity';
import {
  eligibleIntercityVehicles,
  intercityVehicleEligibility,
} from '@/domains/intercity/eligibility';
import { intercityKeys } from '../keys';
import { queryPolicies } from '../policies';
import { usePolicyQuery } from './shared';

// Server state for Rides Intercity. Nothing here caches a seat count as app
// state: every screen reads the query cache, the cache is refetched on focus,
// and a write invalidates the trip it touched plus the search that listed it.

export function useIntercityCorridorsQuery(options: { enabled?: boolean } = {}) {
  return usePolicyQuery<IntercityCorridor[]>(queryPolicies.intercityCorridors, {
    queryKey: intercityKeys.corridors(),
    enabled: options.enabled ?? true,
    queryFn: () => listCorridors(),
  });
}

export function useIntercityTripSearchQuery(input: {
  corridor: string | null;
  date: string | null;
  seats: number;
  enabled?: boolean;
}) {
  const ready = Boolean(input.corridor && input.date) && (input.enabled ?? true);
  return usePolicyQuery<IntercityTrip[]>(queryPolicies.intercityTrips, {
    queryKey: intercityKeys.tripSearch(input.corridor ?? '', input.date ?? '', input.seats),
    enabled: ready,
    queryFn: () =>
      searchTrips({ corridor: input.corridor ?? '', date: input.date ?? '', seats: input.seats }),
  });
}

export function useIntercityTripQuery(tripId: string | null | undefined) {
  return usePolicyQuery<IntercityTrip>(queryPolicies.intercityTrip, {
    queryKey: intercityKeys.trip(tripId ?? ''),
    enabled: Boolean(tripId),
    queryFn: () => getTrip(tripId ?? ''),
  });
}

export function useIntercityBookingsQuery(options: { enabled?: boolean } = {}) {
  return usePolicyQuery<IntercityBooking[]>(queryPolicies.intercityBookings, {
    queryKey: intercityKeys.bookings(),
    enabled: options.enabled ?? true,
    queryFn: () => listBookings(),
  });
}

export function useIntercityBookingQuery(bookingId: string | null | undefined) {
  return usePolicyQuery<IntercityBooking>(queryPolicies.intercityBookings, {
    queryKey: intercityKeys.booking(bookingId ?? ''),
    enabled: Boolean(bookingId),
    queryFn: () => getBooking(bookingId ?? ''),
  });
}

/**
 * Invalidate everything a seat movement can have changed: the trip itself,
 * every corridor search that may have listed it, and the viewer's bookings.
 */
function useSeatInvalidation() {
  const queryClient = useQueryClient();
  return async (tripId?: string | null) => {
    if (tripId) {
      await queryClient.invalidateQueries({ queryKey: intercityKeys.trip(tripId) });
      await queryClient.invalidateQueries({ queryKey: intercityKeys.manifest(tripId) });
    }
    await queryClient.invalidateQueries({ queryKey: intercityKeys.trips() });
    await queryClient.invalidateQueries({ queryKey: intercityKeys.bookings() });
  };
}

export function useHoldSeatsMutation() {
  const invalidateSeats = useSeatInvalidation();
  return useMutation({
    mutationFn: (input: { tripId: string; seats: number; idempotencyKey?: string }) =>
      holdSeats(input),
    // Runs on failure too: a 409 means the seat counts on screen are already
    // wrong, so the refresh is part of the recovery, not a nicety.
    onSettled: async (_data, _error, variables) => {
      await invalidateSeats(variables.tripId);
    },
  });
}

export function useConfirmBookingMutation() {
  const invalidateSeats = useSeatInvalidation();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { bookingId: string; tripId: string }) => confirmBooking(input.bookingId),
    onSuccess: booking => {
      queryClient.setQueryData(intercityKeys.booking(booking.id), booking);
    },
    onSettled: async (_data, _error, variables) => {
      await invalidateSeats(variables.tripId);
    },
  });
}

export function useCancelIntercityBookingMutation() {
  const invalidateSeats = useSeatInvalidation();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { bookingId: string; tripId: string }) => cancelBooking(input.bookingId),
    onSettled: async (_data, _error, variables) => {
      await queryClient.invalidateQueries({ queryKey: intercityKeys.booking(variables.bookingId) });
      await invalidateSeats(variables.tripId);
    },
  });
}

/* ------------------------------------------------------------------ */
/* Driver / operator                                                   */
/* ------------------------------------------------------------------ */

export function useDriverIntercityTripsQuery(options: { enabled?: boolean } = {}) {
  return usePolicyQuery<IntercityTrip[]>(queryPolicies.intercityTrips, {
    queryKey: intercityKeys.driverTrips(),
    enabled: options.enabled ?? true,
    queryFn: () => listDriverTrips(),
  });
}

export function useIntercityManifestQuery(tripId: string | null | undefined) {
  return usePolicyQuery<IntercityManifest>(queryPolicies.intercityManifest, {
    queryKey: intercityKeys.manifest(tripId ?? ''),
    enabled: Boolean(tripId),
    queryFn: () => getManifest(tripId ?? ''),
  });
}

/**
 * The backend vehicle rows (real UUIDs + `passenger_seats`). Publishing needs
 * the backend id, which the local multi-vehicle model does not carry.
 */
export function useIntercityDriverVehiclesQuery(options: { enabled?: boolean } = {}) {
  return usePolicyQuery<BackendDriverVehicle[]>(queryPolicies.driverVehicles, {
    queryKey: intercityKeys.driverVehicles(),
    enabled: options.enabled ?? true,
    queryFn: () => listBackendVehicles(),
  });
}

/**
 * Whether this driver may publish an intercity trip at all.
 *
 * Reads the same `/driver/vehicles` cache the publish form uses, so gating the
 * entry point costs no extra request. It returns `unknown` while the list is
 * unresolved (cold start / offline), and callers keep the door OPEN in that
 * case — the intercity screen has its own designed state for every outcome.
 */
export function useIntercityEligibility(options: { enabled?: boolean } = {}) {
  const vehiclesQuery = useIntercityDriverVehiclesQuery(options);
  const vehicles = vehiclesQuery.data;
  // Memoised: `eligibleVehicles` feeds a selection effect, and a fresh array
  // every render would re-run it on every render.
  const eligibleVehicles = useMemo(() => eligibleIntercityVehicles(vehicles), [vehicles]);
  return {
    eligibility: intercityVehicleEligibility(vehicles),
    eligibleVehicles,
    isLoading: vehiclesQuery.isLoading,
    refetch: vehiclesQuery.refetch,
  };
}

export function usePublishIntercityTripMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PublishIntercityTripInput) => publishTrip(input),
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: intercityKeys.driverTrips() });
      await queryClient.invalidateQueries({ queryKey: intercityKeys.trips() });
    },
  });
}

export function useBoardPassengerMutation() {
  const invalidateSeats = useSeatInvalidation();
  return useMutation({
    mutationFn: (input: { tripId: string; bookingId: string }) =>
      boardPassenger(input.tripId, input.bookingId),
    onSettled: async (_data, _error, variables) => {
      await invalidateSeats(variables.tripId);
    },
  });
}

export function useMarkNoShowMutation() {
  const invalidateSeats = useSeatInvalidation();
  return useMutation({
    mutationFn: (input: { tripId: string; bookingId: string }) =>
      markNoShow(input.tripId, input.bookingId),
    onSettled: async (_data, _error, variables) => {
      await invalidateSeats(variables.tripId);
    },
  });
}

export function useIntercityTripLifecycleMutation() {
  const invalidateSeats = useSeatInvalidation();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { tripId: string; action: 'start' | 'complete' | 'cancel'; reason?: string }) => {
      if (input.action === 'start') return startTrip(input.tripId);
      if (input.action === 'complete') return completeTrip(input.tripId);
      return cancelTrip(input.tripId, input.reason ?? '');
    },
    onSettled: async (_data, _error, variables) => {
      await queryClient.invalidateQueries({ queryKey: intercityKeys.driverTrips() });
      await invalidateSeats(variables.tripId);
    },
  });
}
