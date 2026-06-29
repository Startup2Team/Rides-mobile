import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth, useOptionalAuth } from '@/context/AuthContext';
import { vehicleRepository } from '@/data/repositories';
import { appendDriverVehicle, getDriverVehicles, setDriverActiveVehicle } from '@/domain/driverVehicles';
import type { DriverVehicleProfile } from '@/types';
import { driverKeys } from '../keys';
import { queryPolicies } from '../policies';
import { usePolicyQuery } from './shared';

function getResolvedUserId(userId?: string | null, fallback?: string | null) {
  return userId ?? fallback ?? 'anonymous';
}

function updateVehicleList(cache: DriverVehicleProfile[] | undefined, updater: (vehicle: DriverVehicleProfile) => DriverVehicleProfile) {
  return cache?.map(updater) ?? [];
}

function buildVehicleQueryKey(userId?: string | null) {
  return driverKeys.vehicles(userId);
}

export function useDriverVehiclesQuery(userId?: string | null) {
  const auth = useOptionalAuth();
  const user = auth?.user ?? null;
  const resolvedUserId = getResolvedUserId(userId, user?.id);

  return usePolicyQuery(queryPolicies.driverVehicle, {
    queryKey: buildVehicleQueryKey(resolvedUserId),
    enabled: Boolean(resolvedUserId),
    queryFn: async () => (await vehicleRepository.getVehicles()) ?? [],
  });
}

export function useDriverVehicleQuery(vehicleId: string | null | undefined, userId?: string | null) {
  const auth = useOptionalAuth();
  const user = auth?.user ?? null;
  const resolvedUserId = getResolvedUserId(userId, user?.id);

  return usePolicyQuery(queryPolicies.driverVehicles, {
    queryKey: vehicleId ? driverKeys.vehicle(vehicleId) : buildVehicleQueryKey(resolvedUserId),
    enabled: Boolean(resolvedUserId && vehicleId),
    queryFn: async () => {
      const vehicles = (await vehicleRepository.getVehicles()) ?? [];
      return vehicles.find(vehicle => vehicle.id === vehicleId) ?? null;
    },
  });
}

export function useAddVehicleMutation() {
  const queryClient = useQueryClient();
  const { user, driverProfile, saveDriverProfile } = useAuth();
  const userId = getResolvedUserId(user?.id);

  return useMutation({
    mutationFn: async (vehicle: DriverVehicleProfile) => {
      await vehicleRepository.addVehicle(vehicle);
      const nextProfile = driverProfile ? appendDriverVehicle(driverProfile, vehicle) : null;
      if (nextProfile) await saveDriverProfile(nextProfile);
      return vehicle;
    },
    onMutate: async vehicle => {
      const listKey = buildVehicleQueryKey(userId);
      const vehicleKey = driverKeys.vehicle(vehicle.id);
      const previousList = queryClient.getQueryData<DriverVehicleProfile[]>(listKey) ?? [];
      const previousVehicle = queryClient.getQueryData<DriverVehicleProfile | null>(vehicleKey) ?? null;

      const nextList = previousList.some(item => item.id === vehicle.id)
        ? updateVehicleList(previousList, item => item.id === vehicle.id ? vehicle : item)
        : [vehicle, ...previousList];

      queryClient.setQueryData(listKey, nextList);
      queryClient.setQueryData(vehicleKey, vehicle);

      return { previousList, previousVehicle, vehicleId: vehicle.id };
    },
    onError: (_error, _vehicle, context) => {
      if (!context) return;
      queryClient.setQueryData(buildVehicleQueryKey(userId), context.previousList);
      queryClient.setQueryData(driverKeys.vehicle(context.vehicleId), context.previousVehicle);
    },
    onSettled: async (_data, _error, vehicle) => {
      await queryClient.invalidateQueries({ queryKey: buildVehicleQueryKey(userId) });
      await queryClient.invalidateQueries({ queryKey: driverKeys.vehicle(vehicle.id) });
      await queryClient.invalidateQueries({ queryKey: driverKeys.profile() });
    },
  });
}

export function useUpdateVehicleMutation() {
  const queryClient = useQueryClient();
  const { user, driverProfile, saveDriverProfile } = useAuth();
  const userId = getResolvedUserId(user?.id);

  return useMutation({
    mutationFn: async (vehicle: DriverVehicleProfile) => {
      await vehicleRepository.updateVehicle(vehicle);
      const nextProfile = driverProfile
        ? {
            ...driverProfile,
            vehicles: getDriverVehicles(driverProfile).some(item => item.id === vehicle.id)
              ? getDriverVehicles(driverProfile).map(item => item.id === vehicle.id ? vehicle : item)
              : [...getDriverVehicles(driverProfile), vehicle],
          }
        : null;
      if (nextProfile) await saveDriverProfile(nextProfile);
      return vehicle;
    },
    onMutate: async vehicle => {
      const listKey = buildVehicleQueryKey(userId);
      const vehicleKey = driverKeys.vehicle(vehicle.id);
      const previousList = queryClient.getQueryData<DriverVehicleProfile[]>(listKey) ?? [];
      const previousVehicle = queryClient.getQueryData<DriverVehicleProfile | null>(vehicleKey) ?? null;

      const nextList = previousList.some(item => item.id === vehicle.id)
        ? previousList.map(item => item.id === vehicle.id ? vehicle : item)
        : [vehicle, ...previousList];

      queryClient.setQueryData(listKey, nextList);
      queryClient.setQueryData(vehicleKey, vehicle);

      return { previousList, previousVehicle, vehicleId: vehicle.id };
    },
    onError: (_error, _vehicle, context) => {
      if (!context) return;
      queryClient.setQueryData(buildVehicleQueryKey(userId), context.previousList);
      queryClient.setQueryData(driverKeys.vehicle(context.vehicleId), context.previousVehicle);
    },
    onSettled: async (_data, _error, vehicle) => {
      await queryClient.invalidateQueries({ queryKey: buildVehicleQueryKey(userId) });
      await queryClient.invalidateQueries({ queryKey: driverKeys.vehicle(vehicle.id) });
      await queryClient.invalidateQueries({ queryKey: driverKeys.profile() });
    },
  });
}

export function useDeleteVehicleMutation() {
  const queryClient = useQueryClient();
  const { user, driverProfile, saveDriverProfile } = useAuth();
  const userId = getResolvedUserId(user?.id);

  return useMutation({
    mutationFn: async (vehicleId: string) => {
      await vehicleRepository.deleteVehicle(vehicleId);
      if (driverProfile) {
        const nextProfile = {
          ...driverProfile,
          vehicles: getDriverVehicles(driverProfile).filter(item => item.id !== vehicleId),
          activeVehicle: driverProfile.activeVehicle?.vehicleId === vehicleId ? { vehicleId: null } : driverProfile.activeVehicle,
        };
        await saveDriverProfile(nextProfile);
      }
      return vehicleId;
    },
    onMutate: async vehicleId => {
      const listKey = buildVehicleQueryKey(userId);
      const vehicleKey = driverKeys.vehicle(vehicleId);
      const previousList = queryClient.getQueryData<DriverVehicleProfile[]>(listKey) ?? [];
      const previousVehicle = queryClient.getQueryData<DriverVehicleProfile | null>(vehicleKey) ?? null;
      const nextList = previousList.filter(item => item.id !== vehicleId);
      queryClient.setQueryData(listKey, nextList);
      queryClient.setQueryData(vehicleKey, null);
      return { previousList, previousVehicle, vehicleId };
    },
    onError: (_error, _vehicleId, context) => {
      if (!context) return;
      queryClient.setQueryData(buildVehicleQueryKey(userId), context.previousList);
      queryClient.setQueryData(driverKeys.vehicle(context.vehicleId), context.previousVehicle);
    },
    onSettled: async (_data, _error, vehicleId) => {
      await queryClient.invalidateQueries({ queryKey: buildVehicleQueryKey(userId) });
      await queryClient.invalidateQueries({ queryKey: driverKeys.vehicle(vehicleId) });
      await queryClient.invalidateQueries({ queryKey: driverKeys.profile() });
    },
  });
}

export function usePrimaryVehicleMutation() {
  const queryClient = useQueryClient();
  const { user, driverProfile, setActiveVehicle } = useAuth();
  const userId = getResolvedUserId(user?.id);

  return useMutation({
    mutationFn: async (vehicleId: string | null) => {
      await vehicleRepository.setPrimaryVehicle(vehicleId);
      await setActiveVehicle(vehicleId);
      return vehicleId;
    },
    onMutate: async vehicleId => {
      const listKey = buildVehicleQueryKey(userId);
      const previousList = queryClient.getQueryData<DriverVehicleProfile[]>(listKey) ?? [];
      const previousProfile = queryClient.getQueryData(driverKeys.profile());
      const nextProfile = driverProfile ? setDriverActiveVehicle(driverProfile, vehicleId) : null;
      if (nextProfile) {
        queryClient.setQueryData(driverKeys.profile(), nextProfile);
      }
      return { previousList, previousProfile, vehicleId };
    },
    onError: (_error, _vehicleId, context) => {
      if (!context) return;
      queryClient.setQueryData(buildVehicleQueryKey(userId), context.previousList);
      queryClient.setQueryData(driverKeys.profile(), context.previousProfile);
    },
    onSettled: async (_data, _error, vehicleId) => {
      await queryClient.invalidateQueries({ queryKey: buildVehicleQueryKey(userId) });
      if (vehicleId) {
        await queryClient.invalidateQueries({ queryKey: driverKeys.vehicle(vehicleId) });
      }
      await queryClient.invalidateQueries({ queryKey: driverKeys.profile() });
    },
  });
}
