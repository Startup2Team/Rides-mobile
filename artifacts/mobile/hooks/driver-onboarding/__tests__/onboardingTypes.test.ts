import { getRequiredVehiclePhotoKeys, getVehicleBrandModelPlaceholders } from '../onboardingTypes';

describe('getVehicleBrandModelPlaceholders', () => {
  test('returns moto placeholders', () => {
    expect(getVehicleBrandModelPlaceholders('moto')).toEqual({ brand: 'Yamaha', model: 'BWS' });
  });

  test('returns rifani placeholders', () => {
    expect(getVehicleBrandModelPlaceholders('rifani')).toEqual({ brand: 'Bajaj', model: 'Boxer' });
  });

  test('returns heavy vehicle placeholders', () => {
    expect(getVehicleBrandModelPlaceholders('fuso')).toEqual({ brand: 'Mitsubishi', model: 'Canter' });
  });

  test('returns the correct required vehicle photo keys', () => {
    expect(getRequiredVehiclePhotoKeys('moto')).toEqual([]);
    expect(getRequiredVehiclePhotoKeys('rifani')).toEqual([]);
    expect(getRequiredVehiclePhotoKeys('cab')).toEqual(['outside', 'inside']);
    expect(getRequiredVehiclePhotoKeys('hilux')).toEqual(['outside']);
    expect(getRequiredVehiclePhotoKeys('fuso')).toEqual(['outside']);
  });
});
