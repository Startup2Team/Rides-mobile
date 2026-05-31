export type VehicleType = 'moto' | 'cab' | 'fuso' | 'hilux';
export type AppMode = 'customer' | 'driver';
export type LocationType = 'precise' | 'generic';

export type RideStatus =
  | 'idle'
  | 'searching'
  | 'driver_assigned'
  | 'negotiating'
  | 'confirmed'
  | 'arriving'
  | 'arrived'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export interface Coords {
  latitude: number;
  longitude: number;
}

export interface RideLocation extends Coords {
  address?: string;
  locationType?: LocationType;
}

export interface User {
  id: string;
  name: string;
  phone: string;
  email?: string;
  mode: AppMode;
  isDriver: boolean;
  createdAt: string;
}

export interface DriverProfile {
  vehicleType: VehicleType;
  plateNumber: string;
  licenseNumber: string;
  province: string;
  district: string;
  sector: string;
  city?: string;
  momoCode: string;
  merchantCode?: string;
  momoProvider: 'mtn' | 'airtel';
  dob: string;
  profileImage?: string;
  isOnline: boolean;
  isVerified: boolean;
  acceptanceRate: number;
  completedRides: number;
  dailyRides: number;
  dailyDeclines: number;
  policyAccepted: boolean;
  policyAcceptedAt?: string;
  earningsTotal: number;
  passengerSeats?: number;
  loadCapacityKg?: number;
}

export interface NegotiationMessage {
  id: string;
  sender: 'customer' | 'driver' | 'system';
  type: 'offer' | 'text';
  amount?: number;
  text?: string;
  timestamp: string;
  isFinal?: boolean;
}

export interface MockDriver {
  id: string;
  name: string;
  phone: string;
  vehicleType: VehicleType;
  plateNumber: string;
  profileImage?: string;
  location: Coords;
  rating: number;
  eta: number;
}

export interface Ride {
  id: string;
  customerId: string;
  customerName?: string;
  customerPhone?: string;
  driverId?: string;
  driver?: MockDriver;
  vehicleType: VehicleType;
  pickup: RideLocation;
  destination: RideLocation;
  status: RideStatus;
  distance: number;
  duration: number;
  suggestedFare: number;
  agreedFare?: number;
  negotiation: NegotiationMessage[];
  createdAt: string;
  completedAt?: string;
  arrivedAt?: string;
  waitStartedAt?: string;
}

export const VEHICLE_MCI: Record<VehicleType, string> = {
  moto: 'moped',
  cab: 'car-side',
  hilux: 'pickup-truck',
  fuso: 'truck-trailer',
};

export const VEHICLE_LABELS: Record<VehicleType, string> = {
  moto: 'Moto',
  cab: 'Cab',
  fuso: 'Fuso',
  hilux: 'Hilux',
};

export const VEHICLE_LABELS_FULL: Record<VehicleType, string> = {
  moto: 'Moto Bike',
  cab: 'Cab Taxi',
  fuso: 'Heavy Fuso',
  hilux: 'Light Hilux',
};

export const VEHICLE_ICONS: Record<VehicleType, string> = {
  moto: 'motorcycle',
  cab: 'car',
  fuso: 'truck',
  hilux: 'truck',
};

export const VEHICLE_BASE_FARE: Record<VehicleType, number> = {
  moto: 500,
  cab: 1500,
  fuso: 5000,
  hilux: 3000,
};

export const KIGALI_CENTER: Coords = {
  latitude: -1.9441,
  longitude: 30.0619,
};

