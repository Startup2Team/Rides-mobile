import type { Ride } from '@/types';
import type { CustomerRide } from '@/services/rides';
import {
  appendNegotiationEvent,
  applyDriverMatched,
  applyLifecycleEvent,
  buildDriverRequestFromPayload,
  isDriverRequestEvent,
  isLifecycleEvent,
  lifecycleStatusForEvent,
  localStatusFromBackend,
  parseDriverCoords,
  rideFromActiveRideSnapshot,
} from '../rideBackendSync';

// Payloads below mirror the real backend WebSocket events captured against a
// live ride (SEARCHING → matched → confirmed → en-route → arrived → started →
// completed), so this test doubles as a contract guard for the event shapes.

function baseRide(overrides: Partial<Ride> = {}): Ride {
  return {
    id: 'local-1',
    backendRideId: 'srv-1',
    customerId: 'cust-1',
    customerName: 'Cust',
    vehicleType: 'moto',
    pickup: { latitude: -1.9441, longitude: 30.0619, address: 'Kigali Center', locationType: 'precise' },
    destination: { latitude: -1.9536, longitude: 30.0606, address: 'Nyamirambo', locationType: 'precise' },
    status: 'searching',
    distance: 2.1,
    duration: 12,
    suggestedFare: 1500,
    negotiation: [],
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('rideBackendSync', () => {
  test('maps lifecycle event types to local statuses', () => {
    expect(lifecycleStatusForEvent('driver_en_route')).toBe('arriving');
    expect(lifecycleStatusForEvent('ride_started')).toBe('in_progress');
    expect(lifecycleStatusForEvent('ride_completed')).toBe('completed');
    expect(isLifecycleEvent('driver_arrived')).toBe(true);
    expect(isLifecycleEvent('driver_location')).toBe(false);
  });

  test('maps backend status snapshot to local status', () => {
    expect(localStatusFromBackend('DRIVER_EN_ROUTE')).toBe('arriving');
    expect(localStatusFromBackend('IN_PROGRESS')).toBe('in_progress');
    expect(localStatusFromBackend('WAT')).toBeUndefined();
  });

  test('parses driver coords from a driver_matched payload', () => {
    expect(parseDriverCoords({ lat: -1.9441, lng: 30.0619 })).toEqual({ latitude: -1.9441, longitude: 30.0619 });
    expect(parseDriverCoords({})).toBeNull();
  });

  test('applyDriverMatched merges the real matched payload into the ride', () => {
    const next = applyDriverMatched(baseRide(), {
      driver_id: 'drv-1',
      driver_name: 'Drv',
      driver_phone: '+250780000333',
      vehicle_plate: 'RAD3750A',
      lat: -1.9441,
      lng: 30.0619,
      transport_type: 'MOTO_BIKE',
    });
    expect(next.status).toBe('negotiating');
    expect(next.driverId).toBe('drv-1');
    expect(next.driverName).toBe('Drv');
    expect(next.driver?.plateNumber).toBe('RAD3750A');
    expect(next.driver?.location).toEqual({ latitude: -1.9441, longitude: 30.0619 });
  });

  test('applyLifecycleEvent carries the final fare on completion', () => {
    const confirmed = applyLifecycleEvent(baseRide({ status: 'negotiating' }), 'ride_confirmed', { agreed_fare: 1500 });
    expect(confirmed.status).toBe('confirmed');
    expect(confirmed.agreedFare).toBe(1500);

    const completed = applyLifecycleEvent(baseRide({ status: 'in_progress' }), 'ride_completed', {
      agreed_fare: 1500,
      final_fare: 1500,
      night_applied: true,
    });
    expect(completed.status).toBe('completed');
    expect(completed.agreedFare).toBe(1500);
    expect(completed.completedAt).toBeTruthy();
  });

  test('appendNegotiationEvent adds the counterparty offer but skips own echoes', () => {
    const fromDriver = appendNegotiationEvent(baseRide(), { actor_role: 'DRIVER', amount: 1600 }, 'customer');
    expect(fromDriver.negotiation).toHaveLength(1);
    expect(fromDriver.negotiation[0]).toMatchObject({ sender: 'driver', type: 'offer', amount: 1600 });

    const ownEcho = appendNegotiationEvent(baseRide(), { actor_role: 'CUSTOMER', amount: 1400 }, 'customer');
    expect(ownEcho.negotiation).toHaveLength(0);
  });

  test('buildDriverRequestFromPayload builds a request from the real ride_request payload', () => {
    expect(isDriverRequestEvent('ride_request')).toBe(true);
    const request = buildDriverRequestFromPayload(
      {
        ride_id: 'srv-9',
        customer_name: 'Cust',
        customer_phone: '+250780000444',
        pickup_lat: -1.9441,
        pickup_lng: 30.0619,
        pickup_address: 'Kigali Center',
        dest_lat: -1.9536,
        dest_lng: 30.0606,
        dest_address: 'Nyamirambo',
        distance_km: 0,
        suggested_fare: 864.5,
        transport_type: 'MOTO_BIKE',
      },
      { vehicleId: 'veh-1', vehicleType: 'moto' },
    );
    expect(request).not.toBeNull();
    expect(request?.backendRideId).toBe('srv-9');
    expect(request?.vehicleType).toBe('moto');
    expect(request?.suggestedFare).toBe(864.5);
    expect(request?.matchedVehicleId).toBe('veh-1');

    expect(buildDriverRequestFromPayload({ ride_id: 'x' })).toBeNull();
  });

  test('buildDriverRequestFromPayload reads the server offer window when present', () => {
    const base = {
      ride_id: 'srv-9',
      pickup_lat: -1.9441,
      pickup_lng: 30.0619,
      dest_lat: -1.9536,
      dest_lng: 30.0606,
      transport_type: 'MOTO_BIKE',
    };
    expect(buildDriverRequestFromPayload({ ...base, window_seconds: 25 })?.offerWindowSeconds).toBe(25);
    // Absent / zero windows leave the field unset so the screen fallback applies.
    expect(buildDriverRequestFromPayload(base)?.offerWindowSeconds).toBeUndefined();
    expect(buildDriverRequestFromPayload({ ...base, window_seconds: 0 })?.offerWindowSeconds).toBeUndefined();
  });

  // Snapshot mirroring a real GET /customer|driver/rides/active response after
  // mapping through services/rides.toDomain.
  function activeSnapshot(overrides: Partial<CustomerRide> = {}): CustomerRide {
    return {
      id: 'srv-77',
      status: 'IN_PROGRESS',
      vehicleType: 'moto',
      customerId: 'cust-9',
      customerName: 'Cust',
      customerPhone: '+250780000555',
      customerRating: 4.6,
      driverId: 'drv-3',
      driverName: 'Drv',
      driverPhone: '+250780000333',
      driverRating: 4.9,
      driverPlate: 'RAD3750A',
      pickup: { lat: -1.9441, lng: 30.0619, address: 'Kigali Center' },
      destination: { lat: -1.9536, lng: 30.0606, address: 'Nyamirambo' },
      estimatedDistanceKm: 2.4,
      customerInitialFare: 1200,
      agreedFare: 1500,
      estimatedFareRwf: 1300,
      finalFareRwf: null,
      cancelReason: null,
      driverArrivedAt: '2026-08-12T08:00:00Z',
      startedAt: '2026-08-12T08:02:00Z',
      completedAt: null,
      createdAt: '2026-08-12T07:55:00Z',
      updatedAt: '2026-08-12T08:02:00Z',
      ...overrides,
    };
  }

  describe('rideFromActiveRideSnapshot', () => {
    test('rehydrates a customer mid-trip ride with driver, fare, and timestamps', () => {
      const ride = rideFromActiveRideSnapshot(activeSnapshot(), 'customer');
      expect(ride).not.toBeNull();
      expect(ride).toMatchObject({
        backendRideId: 'srv-77',
        status: 'in_progress',
        vehicleType: 'moto',
        distance: 2.4,
        suggestedFare: 1200,
        agreedFare: 1500,
        driverId: 'drv-3',
        driverName: 'Drv',
        arrivedAt: '2026-08-12T08:00:00Z',
        waitStartedAt: '2026-08-12T08:00:00Z',
        createdAt: '2026-08-12T07:55:00Z',
      });
      expect(ride?.pickup).toMatchObject({ latitude: -1.9441, longitude: 30.0619, address: 'Kigali Center' });
      expect(ride?.destination).toMatchObject({ latitude: -1.9536, longitude: 30.0606, address: 'Nyamirambo' });
      expect(ride?.driver).toMatchObject({
        id: 'drv-3',
        name: 'Drv',
        phone: '+250780000333',
        plateNumber: 'RAD3750A',
        rating: 4.9,
      });
      expect(ride?.negotiation).toEqual([]);
    });

    test('rehydrates the driver side with the customer identity instead', () => {
      const ride = rideFromActiveRideSnapshot(activeSnapshot({ status: 'DRIVER_ARRIVED' }), 'driver');
      expect(ride).toMatchObject({
        status: 'arrived',
        customerId: 'cust-9',
        customerName: 'Cust',
        customerPhone: '+250780000555',
        customerRating: 4.6,
        driverId: 'drv-3',
      });
      expect(ride?.driver).toBeUndefined();
    });

    test('promotes a customer MATCHED snapshot into negotiation, like the live event', () => {
      const ride = rideFromActiveRideSnapshot(activeSnapshot({ status: 'MATCHED' }), 'customer');
      expect(ride?.status).toBe('negotiating');
    });

    test('refuses non-resumable snapshots', () => {
      expect(rideFromActiveRideSnapshot(activeSnapshot({ status: 'COMPLETED' }), 'customer')).toBeNull();
      expect(rideFromActiveRideSnapshot(activeSnapshot({ status: 'CANCELLED' }), 'driver')).toBeNull();
      expect(rideFromActiveRideSnapshot(activeSnapshot({ status: 'NOT_A_STATUS' }), 'customer')).toBeNull();
      // MATCHED is an unaccepted offer on the driver side — owned by the
      // ride_request flow, not resume.
      expect(rideFromActiveRideSnapshot(activeSnapshot({ status: 'MATCHED' }), 'driver')).toBeNull();
    });

    test('falls back to computed distance and fare when the snapshot omits them', () => {
      const ride = rideFromActiveRideSnapshot(
        activeSnapshot({ estimatedDistanceKm: null, customerInitialFare: null, estimatedFareRwf: null }),
        'customer',
      );
      expect(ride?.distance).toBeGreaterThan(0);
      expect(ride?.suggestedFare).toBeGreaterThan(0);
    });
  });
});
