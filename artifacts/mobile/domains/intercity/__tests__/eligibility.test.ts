import type { BackendDriverVehicle } from '@/services/driverVehicles';
import {
  eligibleIntercityVehicles,
  intercityVehicleEligibility,
  showsIntercityEntryPoint,
} from '../eligibility';

function vehicle(overrides: Partial<BackendDriverVehicle> = {}): BackendDriverVehicle {
  return {
    id: 'veh-1',
    vehicleTypeCode: 'COASTER',
    vehicleType: null,
    plateNumber: 'RAC 123 A',
    isActive: true,
    brand: null,
    model: null,
    manufactureYear: null,
    passengerSeats: 18,
    loadCapacityKg: null,
    approvalStatus: 'APPROVED',
    intercityEligible: true,
    ...overrides,
  };
}

describe('intercity vehicle eligibility', () => {
  test('a moto-only driver never sees the intercity entry point', () => {
    const moto = vehicle({ id: 'moto', vehicleTypeCode: 'MOTO_BIKE', passengerSeats: 1, intercityEligible: false });
    expect(intercityVehicleEligibility([moto])).toBe('ineligible');
    expect(showsIntercityEntryPoint('ineligible')).toBe(false);
  });

  test('a Coaster driver does', () => {
    expect(intercityVehicleEligibility([vehicle()])).toBe('eligible');
    expect(showsIntercityEntryPoint('eligible')).toBe(true);
  });

  // The eligibility flag is SERVER-derived. A payload that omits it is not
  // evidence of eligibility, and the mapper already resolves it to false.
  test('a mixed fleet is eligible as soon as one vehicle qualifies', () => {
    const moto = vehicle({ id: 'moto', intercityEligible: false, isActive: true });
    const hiace = vehicle({ id: 'hiace', intercityEligible: true, isActive: false });
    expect(intercityVehicleEligibility([moto, hiace])).toBe('eligible');
    // The publish form only ever offers the qualifying vehicles, active first.
    expect(eligibleIntercityVehicles([moto, hiace]).map(v => v.id)).toEqual(['hiace']);
  });

  test('an unresolved vehicle list keeps the door open rather than hiding it', () => {
    // Offline / cold start: a failed request must not look like an ineligible
    // driver, or the menu item silently disappears on a bad network.
    expect(intercityVehicleEligibility(undefined)).toBe('unknown');
    expect(showsIntercityEntryPoint('unknown')).toBe(true);
  });

  test('a driver with no vehicle keeps the door open — the screen tells them to add one', () => {
    expect(intercityVehicleEligibility([])).toBe('no-vehicle');
    expect(showsIntercityEntryPoint('no-vehicle')).toBe(true);
  });

  test('the active vehicle is offered first', () => {
    const inactive = vehicle({ id: 'a', isActive: false });
    const active = vehicle({ id: 'b', isActive: true });
    expect(eligibleIntercityVehicles([inactive, active]).map(v => v.id)).toEqual(['b', 'a']);
  });
});
