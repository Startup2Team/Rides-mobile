import { getAppBackendClient } from '@/data/remote/client/appBackendClient';
import { fromBackendTransportType, toBackendTransportType } from '@/constants/vehicles';
import type { VehicleType } from '@/types';

// Real backend driver vehicles: /api/v1/driver/vehicles (multi-vehicle CRUD +
// activate). The backend is authoritative for which vehicle is active and
// enforces the "no switch during an active ride" rule (409).

// Per-vehicle approval status (backend migration 089). Narrower than the
// driver-level verificationStatus — see internal/driver/vehicles.go
// VehicleStatus* constants. Not yet reconciled into the local
// DriverVehicleProfile.status model (domain/driverVehicles.ts derives that
// from the driver-level status for every vehicle); callers that need the
// literal per-vehicle truth (e.g. right after an edit) should read this
// field directly off the fresh response rather than the reconciled list.
export type BackendVehicleApprovalStatus = 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';

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
  approvalStatus: BackendVehicleApprovalStatus | null;
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
  approval_status?: string | null;
}

interface Envelope<T> {
  data: T;
}

function toApprovalStatus(raw: string | null | undefined): BackendVehicleApprovalStatus | null {
  return raw === 'PENDING_REVIEW' || raw === 'APPROVED' || raw === 'REJECTED' ? raw : null;
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
    approvalStatus: toApprovalStatus(dto.approval_status),
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

export interface UpdateBackendVehicleInput {
  plateNumber?: string;
  brand?: string | null;
  model?: string | null;
  manufactureYear?: number | null;
  passengerSeats?: number | null;
  loadCapacityKg?: number | null;
}

// PATCH /driver/vehicles/{id} — edits core vehicle-identity fields. Unlike the
// best-effort create/activate/delete helpers in this file, this is NOT
// best-effort: the backend is the sole owner of these fields, editing
// plate/capacity can reset the vehicle's approval_status to PENDING_REVIEW,
// and the backend rejects the call with 409 VEHICLE_LOCKED_ON_RIDE while this
// is the active vehicle on an active ride. Callers must surface both outcomes
// to the driver rather than swallowing them (no fake success).
export async function updateBackendVehicle(
  vehicleId: string,
  input: UpdateBackendVehicleInput,
): Promise<BackendDriverVehicle> {
  const body: Record<string, unknown> = {};
  if (input.plateNumber !== undefined) body.plate_number = input.plateNumber;
  if (input.brand !== undefined) body.make = input.brand;
  if (input.model !== undefined) body.model = input.model;
  if (input.manufactureYear !== undefined) body.year = input.manufactureYear;
  if (input.passengerSeats !== undefined) body.passenger_seats = input.passengerSeats;
  if (input.loadCapacityKg !== undefined) body.load_capacity_kg = input.loadCapacityKg;
  const response = await getAppBackendClient().patch<Envelope<VehicleDto>>(`/v1/driver/vehicles/${vehicleId}`, {
    body,
  });
  return toDomain(response.data.data);
}

// Edit reconciled by the vehicle's CURRENT plate (local ids are app-generated,
// not backend UUIDs — same reconciliation the delete/activate helpers below
// use). Throws when there is no backend match or the backend rejects the
// edit: an edit is a driver-visible mutation, not a best-effort sync, so the
// caller must show the real outcome instead of silently no-op'ing.
export async function updateVehicleByPlate(
  currentPlateNumber: string,
  input: UpdateBackendVehicleInput,
): Promise<BackendDriverVehicle> {
  const target = normalizePlate(currentPlateNumber);
  const match = (await listBackendVehicles()).find(vehicle => normalizePlate(vehicle.plateNumber) === target);
  if (!match) {
    throw new Error('VEHICLE_NOT_REGISTERED');
  }
  return updateBackendVehicle(match.id, input);
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
