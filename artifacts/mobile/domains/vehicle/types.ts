import type { DriverVehicleDocumentReviewStatus, DriverVehicleProfile, DriverVehicleStatus, VehicleType } from '@/types';

export type Vehicle = DriverVehicleProfile;
export type VehiclePhoto = NonNullable<DriverVehicleProfile['photos']>;
export type PlateNumber = string;
export type VehicleStatus = DriverVehicleStatus;
export type VehicleVerificationStatus = DriverVehicleDocumentReviewStatus;
export type { VehicleType };
