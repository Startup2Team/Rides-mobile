import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import React from 'react';
import type { DriverProfile, DriverVehicleProfile } from '@/types';
import { driverKeys } from '../keys';
import {
  useAddVehicleMutation,
  useDeleteVehicleMutation,
  useDriverVehicleQuery,
  useDriverVehiclesQuery,
  usePrimaryVehicleMutation,
  useUpdateVehicleMutation,
} from '../hooks/useDriverVehiclesQuery';

let vehicleState: DriverVehicleProfile[] = [];
let mockDriverProfileState: DriverProfile | null = null;

const mockGetVehicles = jest.fn(async () => vehicleState);
const mockAddVehicle = jest.fn(async (vehicle: DriverVehicleProfile) => {
  vehicleState = [vehicle, ...vehicleState.filter(item => item.id !== vehicle.id)];
});
const mockUpdateVehicle = jest.fn(async (vehicle: DriverVehicleProfile) => {
  vehicleState = vehicleState.some(item => item.id === vehicle.id)
    ? vehicleState.map(item => item.id === vehicle.id ? vehicle : item)
    : [vehicle, ...vehicleState];
});
const mockDeleteVehicle = jest.fn(async (vehicleId: string) => {
  vehicleState = vehicleState.filter(item => item.id !== vehicleId);
});
const mockSetPrimaryVehicle = jest.fn(async (vehicleId: string | null) => {
  if (!mockDriverProfileState) return;
  mockDriverProfileState = {
    ...mockDriverProfileState,
    activeVehicle: { vehicleId, selectedAt: vehicleId ? new Date('2026-06-28T00:00:00.000Z').toISOString() : undefined },
  };
});

jest.mock('@/data/repositories', () => ({
  vehicleRepository: {
    getVehicles: () => mockGetVehicles(),
    addVehicle: (vehicle: DriverVehicleProfile) => mockAddVehicle(vehicle),
    updateVehicle: (vehicle: DriverVehicleProfile) => mockUpdateVehicle(vehicle),
    deleteVehicle: (vehicleId: string) => mockDeleteVehicle(vehicleId),
    setPrimaryVehicle: (vehicleId: string | null) => mockSetPrimaryVehicle(vehicleId),
    setActiveVehicle: (vehicleId: string | null) => mockSetPrimaryVehicle(vehicleId),
  },
}));

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1', name: 'Driver User', phone: '+250788000000', mode: 'driver', isDriver: true },
    driverProfile: mockDriverProfileState,
    saveDriverProfile: jest.fn(async (profile: DriverProfile) => {
      mockDriverProfileState = profile;
    }),
    setActiveVehicle: mockSetPrimaryVehicle,
  }),
  useOptionalAuth: () => ({
    user: { id: 'user-1', name: 'Driver User', phone: '+250788000000', mode: 'driver', isDriver: true },
    driverProfile: mockDriverProfileState,
  }),
}));

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  return { client, wrapper };
}

function makeVehicle(id: string, plateNumber: string, status: DriverVehicleProfile['status'] = 'approved'): DriverVehicleProfile {
  return {
    id,
    vehicleType: 'moto',
    status,
    plateNumber,
    licenseNumber: '1234567890123456',
    brand: 'Yamaha',
    model: 'BWS',
    manufactureYear: 2020,
    submittedAt: '2026-06-08T09:00:00.000Z',
  };
}

describe('vehicle query layer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    vehicleState = [
      makeVehicle('driver-vehicle:moto:rad-001-a', 'RAD 001 A'),
      makeVehicle('driver-vehicle:cab:rac-002-a', 'RAC 002 A', 'pending_review'),
    ];
    mockDriverProfileState = {
      vehicleType: 'moto',
      plateNumber: 'RAD 001 A',
      licenseNumber: '1234567890123456',
      province: 'City of Kigali',
      district: 'Gasabo',
      sector: 'Kacyiru',
      momoCode: '250788000000',
      momoProvider: 'mtn',
      dob: '01/01/1990',
      verificationStatus: 'approved',
      isOnline: false,
      isVerified: true,
      acceptanceRate: 100,
      completedRides: 0,
      dailyRides: 0,
      dailyDeclines: 0,
      policyAccepted: true,
      earningsTotal: 0,
      vehicles: vehicleState,
      activeVehicle: { vehicleId: vehicleState[0].id },
    };
    mockGetVehicles.mockImplementation(async () => vehicleState);
    mockAddVehicle.mockImplementation(async (vehicle: DriverVehicleProfile) => {
      vehicleState = [vehicle, ...vehicleState.filter(item => item.id !== vehicle.id)];
      return undefined;
    });
    mockUpdateVehicle.mockImplementation(async (vehicle: DriverVehicleProfile) => {
      vehicleState = vehicleState.some(item => item.id === vehicle.id)
        ? vehicleState.map(item => item.id === vehicle.id ? vehicle : item)
        : [vehicle, ...vehicleState];
      return undefined;
    });
    mockDeleteVehicle.mockImplementation(async (vehicleId: string) => {
      vehicleState = vehicleState.filter(item => item.id !== vehicleId);
      return undefined;
    });
    mockSetPrimaryVehicle.mockImplementation(async (vehicleId: string | null) => {
      if (!mockDriverProfileState) return undefined;
      mockDriverProfileState = {
        ...mockDriverProfileState,
        activeVehicle: { vehicleId, selectedAt: vehicleId ? '2026-06-28T00:00:00.000Z' : undefined },
      };
      return undefined;
    });
  });

  test('loads the driver vehicle list and individual vehicle projections through the repository', async () => {
    const { client, wrapper } = createWrapper();

    const listHook = renderHook(() => useDriverVehiclesQuery('user-1'), { wrapper });
    const detailHook = renderHook(() => useDriverVehicleQuery('driver-vehicle:moto:rad-001-a', 'user-1'), { wrapper });

    await waitFor(() => expect(listHook.result.current.isFetched).toBe(true));
    await waitFor(() => expect(detailHook.result.current.isFetched).toBe(true));

    expect(listHook.result.current.data).toEqual(vehicleState);
    expect(detailHook.result.current.data).toEqual(vehicleState[0]);
    expect(client.getQueryData(driverKeys.vehicles('user-1'))).toEqual(vehicleState);
    expect(client.getQueryData(driverKeys.vehicle('driver-vehicle:moto:rad-001-a'))).toEqual(vehicleState[0]);
  });

  test('optimistically adds a vehicle and rolls back on repository failure', async () => {
    const { client, wrapper } = createWrapper();
    client.setQueryData(driverKeys.vehicles('user-1'), vehicleState);
    client.setQueryData(driverKeys.vehicle('driver-vehicle:moto:rad-001-a'), vehicleState[0]);

    const hook = renderHook(() => useAddVehicleMutation(), { wrapper });
    const nextVehicle = makeVehicle('driver-vehicle:hilux:rah-999-a', 'RAH 999 A');

    await act(async () => {
      await hook.result.current.mutateAsync(nextVehicle);
    });

    expect(client.getQueryData<DriverVehicleProfile[]>(driverKeys.vehicles('user-1'))?.[0]).toEqual(nextVehicle);
    expect(client.getQueryData<DriverVehicleProfile | null>(driverKeys.vehicle(nextVehicle.id))).toEqual(nextVehicle);
    expect(mockAddVehicle).toHaveBeenCalledWith(nextVehicle);

    mockAddVehicle.mockRejectedValueOnce(new Error('add failed'));
    await expect(hook.result.current.mutateAsync(makeVehicle('driver-vehicle:fuso:rab-123-a', 'RAB 123 A'))).rejects.toThrow('add failed');
    expect(client.getQueryData<DriverVehicleProfile[]>(driverKeys.vehicles('user-1'))).toEqual(vehicleState);
  });

  test('optimistically updates and deletes vehicles, then rolls back on failure', async () => {
    const { client, wrapper } = createWrapper();
    const firstVehicleId = vehicleState[0].id;
    const secondVehicleId = vehicleState[1].id;
    client.setQueryData(driverKeys.vehicles('user-1'), vehicleState);
    client.setQueryData(driverKeys.profile(), mockDriverProfileState);

    const updateHook = renderHook(() => useUpdateVehicleMutation(), { wrapper });
    const updatedVehicle = { ...vehicleState[0], plateNumber: 'RAD 002 A' };
    await act(async () => {
      await updateHook.result.current.mutateAsync(updatedVehicle);
    });
    expect(client.getQueryData<DriverVehicleProfile[]>(driverKeys.vehicles('user-1'))?.[0]).toEqual(updatedVehicle);
    expect(mockUpdateVehicle).toHaveBeenCalledWith(updatedVehicle);

    mockUpdateVehicle.mockRejectedValueOnce(new Error('update failed'));
    await expect(updateHook.result.current.mutateAsync({ ...updatedVehicle, plateNumber: 'RAD 003 A' })).rejects.toThrow('update failed');
    expect(client.getQueryData<DriverVehicleProfile[]>(driverKeys.vehicles('user-1'))?.[0]).toEqual(updatedVehicle);

    const deleteHook = renderHook(() => useDeleteVehicleMutation(), { wrapper });
    await act(async () => {
      await deleteHook.result.current.mutateAsync(secondVehicleId);
    });
    expect(client.getQueryData<DriverVehicleProfile[]>(driverKeys.vehicles('user-1'))?.some(item => item.id === secondVehicleId)).toBe(false);
    expect(mockDeleteVehicle).toHaveBeenCalledWith(secondVehicleId);

    mockDeleteVehicle.mockRejectedValueOnce(new Error('delete failed'));
    await expect(deleteHook.result.current.mutateAsync(firstVehicleId)).rejects.toThrow('delete failed');
    expect(client.getQueryData<DriverVehicleProfile[]>(driverKeys.vehicles('user-1'))?.some(item => item.id === firstVehicleId)).toBe(true);
  });

  test('updates the active vehicle optimistically and rolls back on failure', async () => {
    const { client, wrapper } = createWrapper();
    client.setQueryData(driverKeys.profile(), mockDriverProfileState);
    client.setQueryData(driverKeys.vehicles('user-1'), vehicleState);
    const firstVehicleId = vehicleState[0].id;
    const secondVehicleId = vehicleState[1].id;

    const hook = renderHook(() => usePrimaryVehicleMutation(), { wrapper });
    await act(async () => {
      await hook.result.current.mutateAsync(secondVehicleId);
    });

    expect(client.getQueryData<DriverProfile>(driverKeys.profile())?.activeVehicle?.vehicleId).toBe(secondVehicleId);
    expect(mockSetPrimaryVehicle).toHaveBeenCalledWith(secondVehicleId);

    mockSetPrimaryVehicle.mockRejectedValueOnce(new Error('primary failed'));
    await expect(hook.result.current.mutateAsync(firstVehicleId)).rejects.toThrow('primary failed');
    expect(client.getQueryData<DriverProfile>(driverKeys.profile())?.activeVehicle?.vehicleId).toBe(secondVehicleId);
  });
});
