import { getAppBackendClient } from '@/data/remote/client/appBackendClient';
import { fromBackendTransportType, toBackendTransportType } from '@/constants/vehicles';
import type { VehicleType } from '@/types';

// Real backend driver vehicles: /api/v1/driver/vehicles (multi-vehicle CRUD +
// activate). The backend is authoritative for which vehicle is active and
// enforces the "no switch during an active ride" rule (409).

export interface BackendDriverVehicle {
  id: string;
  vehicleTypeCode: string;
  vehicleType: VehicleType | null;
  plateNumber: string;
  isActive: boolean;
  brand: string | null;
  model: string | null;
  manufactureYear: number | null;
  passengerSeats: number | null;
  loadCapacityKg: number | null;
}

interface VehicleDto {
  id: string;
  vehicle_type_code: string;
  plate_number: string;
  is_active: boolean;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  passenger_seats?: number | null;
  load_capacity_kg?: number | null;
}

interface Envelope<T> {
  data: T;
}

function toDomain(dto: VehicleDto): BackendDriverVehicle {
  return {
    id: dto.id,
    vehicleTypeCode: dto.vehicle_type_code,
    vehicleType: fromBackendTransportType(dto.vehicle_type_code),
    plateNumber: dto.plate_number,
    isActive: dto.is_active,
    brand: dto.make ?? null,
    model: dto.model ?? null,
    manufactureYear: dto.year ?? null,
    passengerSeats: dto.passenger_seats ?? null,
    loadCapacityKg: dto.load_capacity_kg ?? null,
  };
}

function normalizePlate(plate: string): string {
  return plate.replace(/\s+/g, '').toUpperCase();
}

export async function listBackendVehicles(): Promise<BackendDriverVehicle[]> {
  const response = await getAppBackendClient().get<Envelope<VehicleDto[] | null>>('/v1/driver/vehicles');
  return (response.data.data ?? []).map(toDomain);
}

export async function activateBackendVehicle(vehicleId: string): Promise<void> {
  await getAppBackendClient().post(`/v1/driver/vehicles/${vehicleId}/activate`, {});
}

export interface CreateBackendVehicleInput {
  vehicleType: VehicleType;
  plateNumber: string;
  brand?: string | null;
  model?: string | null;
  manufactureYear?: number | null;
}

// POST /driver/vehicles — register a vehicle on the backend. Idempotent by plate:
// if the plate is already registered we return the existing row instead of
// creating a duplicate (the local model may re-submit the same vehicle).
export async function createBackendVehicle(input: CreateBackendVehicleInput): Promise<BackendDriverVehicle> {
  const target = normalizePlate(input.plateNumber);
  const existing = (await listBackendVehicles()).find(vehicle => normalizePlate(vehicle.plateNumber) === target);
  if (existing) return existing;
  const code = toBackendTransportType(input.vehicleType);
  const body: Record<string, unknown> = {
    transport_type: code,
    vehicle_type_code: code,
    plate_number: input.plateNumber,
  };
  // The backend stores make/model/year — send them so vehicles added on this
  // device don't come back stripped ("Year pending") on other devices.
  if (input.brand?.trim()) body.make = input.brand.trim();
  if (input.model?.trim()) body.model = input.model.trim();
  if (typeof input.manufactureYear === 'number' && Number.isFinite(input.manufactureYear)) {
    body.year = input.manufactureYear;
  }
  const response = await getAppBackendClient().post<Envelope<VehicleDto>>('/v1/driver/vehicles', {
    body,
  });
  return toDomain(response.data.data);
}

// Best-effort registration used by the add-vehicle flow: never throws, so an
// offline/unreachable backend still lets the local (verification) flow proceed.
export async function ensureBackendVehicle(input: CreateBackendVehicleInput): Promise<boolean> {
  try {
    await createBackendVehicle(input);
    return true;
  } catch {
    return false;
  }
}

export async function deleteBackendVehicle(vehicleId: string): Promise<void> {
  await getAppBackendClient().delete(`/v1/driver/vehicles/${vehicleId}`);
}

// Delete reconciled by plate (local ids are app-generated, not backend UUIDs).
export async function deleteVehicleByPlate(plateNumber: string): Promise<boolean> {
  const target = normalizePlate(plateNumber);
  const match = (await listBackendVehicles()).find(vehicle => normalizePlate(vehicle.plateNumber) === target);
  if (!match) return false;
  await deleteBackendVehicle(match.id);
  return true;
}

// The local multi-vehicle model keys vehicles by an app-generated stable id
// (plate/license hash), not the backend UUID, so we reconcile by plate number.
// Best-effort: resolves false when there is no backend match or the backend is
// unreachable, letting the local switch stand so the UI still works offline.
export async function activateVehicleByPlate(plateNumber: string): Promise<boolean> {
  const target = normalizePlate(plateNumber);
  const vehicles = await listBackendVehicles();
  const match = vehicles.find(vehicle => normalizePlate(vehicle.plateNumber) === target);
  if (!match) return false;
  if (match.isActive) return true;
  await activateBackendVehicle(match.id);
  return true;
}
