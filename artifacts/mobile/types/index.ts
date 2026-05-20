export type VehicleType = 'moto' | 'cab' | 'fuso' | 'hilux';
export type AppMode = 'customer' | 'driver';

export type RideStatus =
  | 'idle'
  | 'searching'
  | 'driver_assigned'
  | 'negotiating'
  | 'confirmed'
  | 'arriving'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export interface Coords {
  latitude: number;
  longitude: number;
}

export interface RideLocation extends Coords {
  address?: string;
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
  city: string;
  momoCode: string;
  dob: string;
  isOnline: boolean;
  isVerified: boolean;
  acceptanceRate: number;
  completedRides: number;
  dailyRides: number;
  dailyDeclines: number;
  policyAccepted: boolean;
  policyAcceptedAt?: string;
  earningsTotal: number;
}

export interface NegotiationMessage {
  id: string;
  sender: 'customer' | 'driver';
  amount: number;
  timestamp: string;
  isFinal: boolean;
}

export interface MockDriver {
  id: string;
  name: string;
  phone: string;
  vehicleType: VehicleType;
  plateNumber: string;
  location: Coords;
  rating: number;
  eta: number;
}

export interface Ride {
  id: string;
  customerId: string;
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
}

export const VEHICLE_LABELS: Record<VehicleType, string> = {
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

export const MOCK_DRIVERS: MockDriver[] = [
  {
    id: 'd1',
    name: 'Jean Pierre',
    phone: '+250788111001',
    vehicleType: 'moto',
    plateNumber: 'RAC 001 A',
    location: { latitude: -1.9421, longitude: 30.0599 },
    rating: 4.8,
    eta: 3,
  },
  {
    id: 'd2',
    name: 'Marie Uwimana',
    phone: '+250788111002',
    vehicleType: 'cab',
    plateNumber: 'RAB 002 B',
    location: { latitude: -1.9461, longitude: 30.0639 },
    rating: 4.9,
    eta: 5,
  },
  {
    id: 'd3',
    name: 'David Nkurunziza',
    phone: '+250788111003',
    vehicleType: 'moto',
    plateNumber: 'RAC 003 C',
    location: { latitude: -1.9431, longitude: 30.0649 },
    rating: 4.7,
    eta: 4,
  },
  {
    id: 'd4',
    name: 'Alice Mukamana',
    phone: '+250788111004',
    vehicleType: 'cab',
    plateNumber: 'RAB 004 D',
    location: { latitude: -1.9451, longitude: 30.059 },
    rating: 4.6,
    eta: 7,
  },
  {
    id: 'd5',
    name: 'Robert Habimana',
    phone: '+250788111005',
    vehicleType: 'hilux',
    plateNumber: 'RAD 005 E',
    location: { latitude: -1.9411, longitude: 30.0629 },
    rating: 4.9,
    eta: 6,
  },
];
