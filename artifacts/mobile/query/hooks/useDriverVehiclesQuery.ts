import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth, useOptionalAuth } from '@/context/AuthContext';
import { vehicleRepository } from '@/data/repositories';
import { activateVehicleByPlate, deleteVehicleByPlate, ensureBackendVehicle, listBackendVehicles } from '@/services/driverVehicles';
import { ConflictError } from '@/data/remote/contracts/backendErrors';
import { appendDriverVehicle, getDriverVehicles, reconcileDriverVehicles, setDriverActiveVehicle } from '@/domain/driverVehicles';
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
    // Backend is authoritative for which vehicles exist + their approval; local
    // storage supplies the rich data (documents/photos/license). Reconcile the
    // two so a vehicle can't stay stuck 'pending_review' after backend approval.
    // Falls back to local when the backend is unreachable (offline).
    queryFn: async () => {
      const local = (await vehicleRepository.getVehicles()) ?? [];
      try {
        const backend = await listBackendVehicles();
        return reconcileDriverVehicles(
          local,
          backend,
          auth?.driverProfile?.verificationStatus ?? null,
        );
      } catch {
        return local;
      }
    },
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
      // Mirror the registration to the backend (POST /v1/driver/vehicles),
      // matched/deduped by plate. Best-effort: never blocks the local add.
      void ensureBackendVehicle({ vehicleType: vehicle.vehicleType, plateNumber: vehicle.plateNumber });
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
      const removedPlate = driverProfile
        ? getDriverVehicles(driverProfile).find(item => item.id === vehicleId)?.plateNumber ?? null
        : null;
      await vehicleRepository.deleteVehicle(vehicleId);
      if (driverProfile) {
        const nextProfile = {
          ...driverProfile,
          vehicles: getDriverVehicles(driverProfile).filter(item => item.id !== vehicleId),
          activeVehicle: driverProfile.activeVehicle?.vehicleId === vehicleId ? { vehicleId: null } : driverProfile.activeVehicle,
        };
        await saveDriverProfile(nextProfile);
      }
      // Mirror the removal to the backend, matched by plate (best-effort).
      if (removedPlate) {
        void deleteVehicleByPlate(removedPlate).catch(() => {});
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
      // Backend is authoritative for the active vehicle and rejects a switch
      // during an active ride (409). Attempt the backend activation first so a
      // conflict blocks the local switch; other failures (offline) fall through.
      if (vehicleId && driverProfile) {
        const plate = getDriverVehicles(driverProfile).find(item => item.id === vehicleId)?.plateNumber ?? null;
        if (plate) {
          try {
            await activateVehicleByPlate(plate);
          } catch (error) {
            if (error instanceof ConflictError) throw error;
            // Non-conflict failure: keep working offline via the local switch.
          }
        }
      }
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
