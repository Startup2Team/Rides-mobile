jest.mock('@/data/repositories', () => ({
  vehicleRepository: {
    getVehicles: jest.fn(),
    setActiveVehicle: jest.fn(),
    setPrimaryVehicle: jest.fn(),
    addVehicle: jest.fn(),
    updateVehicle: jest.fn(),
    deleteVehicle: jest.fn(),
  },
}));

import { vehicleRepository, useVehicle, useVehicles } from '..';

describe('vehicle domain', () => {
  test('exports the repository and query compatibility hooks', () => {
    expect(vehicleRepository).toBeDefined();
    expect(useVehicles).toEqual(expect.any(Function));
    expect(useVehicle).toEqual(expect.any(Function));
  });
});
