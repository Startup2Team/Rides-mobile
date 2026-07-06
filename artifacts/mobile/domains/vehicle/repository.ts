import { vehicleRepository as baseVehicleRepository } from '@/data/repositories';

export const vehicleRepository = baseVehicleRepository;

export type { VehicleRepository } from '@/data/repositories/interfaces';
export { createRemoteVehicleRepositoryPrototype, createVehicleShadowRepository } from '@/data/remote/repositories/RemoteVehicleRepository';
