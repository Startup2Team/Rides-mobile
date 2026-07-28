import type { Ride } from '@/types';
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
});
