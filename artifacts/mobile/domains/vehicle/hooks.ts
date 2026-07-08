import { useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getDriverVehicles, getVehicleById } from '@/domain/driverVehicles';
import { useAddVehicleMutation, useDeleteVehicleMutation, useDriverVehicleQuery, useDriverVehiclesQuery, usePrimaryVehicleMutation, useUpdateVehicleMutation } from '@/query/hooks/useDriverVehiclesQuery';
import type { Vehicle } from './types';

export function useVehicles() {
  const { driverProfile } = useAuth();
  const vehiclesQuery = useDriverVehiclesQuery();
  const addVehicle = useAddVehicleMutation();
  const updateVehicle = useUpdateVehicleMutation();
  const deleteVehicle = useDeleteVehicleMutation();
  const primaryVehicle = usePrimaryVehicleMutation();
  const fallbackVehicles = getDriverVehicles(driverProfile);
  const vehicles = vehiclesQuery.data ?? fallbackVehicles;

  return {
    vehicles,
    isLoading: vehiclesQuery.isLoading && vehiclesQuery.data == null && fallbackVehicles.length === 0,
    isRefreshing: vehiclesQuery.isFetching,
    refreshVehicles: vehiclesQuery.refetch,
    addVehicle: addVehicle.mutateAsync,
    updateVehicle: updateVehicle.mutateAsync,
    deleteVehicle: deleteVehicle.mutateAsync,
    setPrimaryVehicle: primaryVehicle.mutateAsync,
  };
}

export function useVehicle(vehicleId?: string | null) {
  const { driverProfile } = useAuth();
  const vehicleQuery = useDriverVehicleQuery(vehicleId);
  const fallbackVehicle = getVehicleById(driverProfile, vehicleId);
  return useMemo(() => vehicleQuery.data ?? fallbackVehicle ?? null, [fallbackVehicle, vehicleQuery.data]);
}

export type { Vehicle };
