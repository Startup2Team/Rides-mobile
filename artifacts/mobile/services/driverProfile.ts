import { getAppBackendClient } from '@/data/remote/client/appBackendClient';
import { toBackendTransportType, fromBackendTransportType } from '@/constants/vehicles';
import type { VehicleType } from '@/types';

// Real backend driver profile + application under /api/v1/driver.

export interface DriverProfile {
  id: string;
  userId: string;
  vehicleType: VehicleType | null;
  vehiclePlate: string;
  licenseNumber: string;
  city: string;
  momoPayCode: string;
  momoProvider: string;
  province: string;
  district: string;
  sector: string;
  cell: string;
  village: string;
  passengerSeats: number | null;
  loadCapacityKg: number | null;
  approvalStatus: string; // PENDING | APPROVED | REJECTED | SUSPENDED
  rejectionReason: string | null;
  isOnline: boolean;
  acceptanceRate: number;
  totalRides: number;
  policyAccepted: boolean;
}

interface DriverProfileDto {
  id: string;
  user_id: string;
  transport_type: string;
  vehicle_plate: string;
  license_number: string;
  city: string;
  momo_pay_code: string;
  momo_provider: string;
  province: string;
  district: string;
  sector: string;
  cell: string;
  village: string;
  passenger_seats?: number | null;
  load_capacity_kg?: number | null;
  approval_status: string;
  rejection_reason?: string | null;
  is_online: boolean;
  acceptance_rate: number;
  total_rides: number;
  policy_accepted: boolean;
}

interface Envelope<T> {
  data: T;
}

function toDomain(dto: DriverProfileDto): DriverProfile {
  return {
    id: dto.id,
    userId: dto.user_id,
    vehicleType: fromBackendTransportType(dto.transport_type),
    vehiclePlate: dto.vehicle_plate,
    licenseNumber: dto.license_number,
    city: dto.city,
    momoPayCode: dto.momo_pay_code,
    momoProvider: dto.momo_provider,
    province: dto.province,
    district: dto.district,
    sector: dto.sector,
    cell: dto.cell,
    village: dto.village,
    passengerSeats: dto.passenger_seats ?? null,
    loadCapacityKg: dto.load_capacity_kg ?? null,
    approvalStatus: dto.approval_status,
    rejectionReason: dto.rejection_reason ?? null,
    isOnline: dto.is_online,
    acceptanceRate: dto.acceptance_rate,
    totalRides: dto.total_rides,
    policyAccepted: dto.policy_accepted,
  };
}

export async function getDriverProfile(): Promise<DriverProfile> {
  const response = await getAppBackendClient().get<Envelope<DriverProfileDto>>('/v1/driver/profile');
  return toDomain(response.data.data);
}

export interface DriverProfileUpdate {
  city?: string;
  momoPayCode?: string;
  momoProvider?: 'mtn' | 'airtel';
  fcmToken?: string | null;
}

export async function updateDriverProfile(patch: DriverProfileUpdate): Promise<void> {
  const body: Record<string, unknown> = {};
  if (patch.city !== undefined) body.city = patch.city;
  if (patch.momoPayCode !== undefined) body.momo_pay_code = patch.momoPayCode;
  if (patch.momoProvider !== undefined) body.momo_provider = patch.momoProvider;
  if (patch.fcmToken !== undefined) body.fcm_token = patch.fcmToken;
  await getAppBackendClient().put('/v1/driver/profile', { body });
}

export interface DriverApplicationInput {
  vehicleType: VehicleType;
  vehiclePlate: string;
  licenseNumber: string;
  dateOfBirth: string; // YYYY-MM-DD
  city: string;
  momoPayCode: string;
  momoProvider: 'mtn' | 'airtel';
  province: string;
  district: string;
  sector: string;
  cell: string;
  village: string;
  // National ID (FEAT-onboarding-fields): the form already collects and
  // requires these client-side, so they're always sent — even though the
  // backend only enforces them as mandatory behind NATIONAL_ID_REQUIRED
  // (staged rollout). Required here, not optional, so a caller can't
  // silently drop them again.
  nationalIdNumber: string;
  nationalIdCountry: 'RW' | 'UG';
  gender?: 'male' | 'female' | 'other';
  passengerSeats?: number;
  loadCapacityKg?: number;
  licenseExpiryDate?: string;
  insuranceExpiryDate?: string;
  authorizationExpiryDate?: string;
}

// POST /driver/apply — creates the driver application (status PENDING → admin review).
export async function applyAsDriver(input: DriverApplicationInput): Promise<void> {
  const body: Record<string, unknown> = {
    transport_type: toBackendTransportType(input.vehicleType),
    vehicle_plate: input.vehiclePlate,
    license_number: input.licenseNumber,
    date_of_birth: input.dateOfBirth,
    city: input.city,
    momo_pay_code: input.momoPayCode,
    momo_provider: input.momoProvider,
    province: input.province,
    district: input.district,
    sector: input.sector,
    cell: input.cell,
    village: input.village,
    national_id_number: input.nationalIdNumber,
    national_id_country: input.nationalIdCountry,
  };
  if (input.gender) body.gender = input.gender;
  if (input.passengerSeats !== undefined) body.passenger_seats = input.passengerSeats;
  if (input.loadCapacityKg !== undefined) body.load_capacity_kg = input.loadCapacityKg;
  if (input.licenseExpiryDate) body.license_expiry_date = input.licenseExpiryDate;
  if (input.insuranceExpiryDate) body.insurance_expiry_date = input.insuranceExpiryDate;
  if (input.authorizationExpiryDate) body.authorization_expiry_date = input.authorizationExpiryDate;
  await getAppBackendClient().post('/v1/driver/apply', { body });
}

export async function acceptDriverPolicy(): Promise<void> {
  await getAppBackendClient().post('/v1/driver/policy/accept', {});
}
