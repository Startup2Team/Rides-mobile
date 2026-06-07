export type VehicleType = 'moto' | 'rifani' | 'cab' | 'fuso' | 'hilux';
export type AppMode = 'customer' | 'driver';
export type DriverVerificationStatus = 'not_started' | 'draft' | 'pending_review' | 'approved' | 'rejected';
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

/** Snapshot of the booking form when a driver search starts or is cancelled. */
export interface BookingFormDraft {
  pickup: RideLocation;
  destination: RideLocation;
  destText: string;
  vehicleType: VehicleType;
}

export interface SavedLocation extends RideLocation {
  id: string;
  label: string;
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

export type PaymentProvider = 'mtn' | 'airtel' | 'cash';

export interface PaymentMethod {
  id: string;
  provider: PaymentProvider;
  label: string;
  phoneNumber?: string;
  isDefault: boolean;
}

export interface DriverProfile {
  verificationStatus?: Exclude<DriverVerificationStatus, 'not_started'>;
  vehicleType: VehicleType;
  plateNumber: string;
  licenseNumber: string;
  nationalId?: string;
  licenseExpiryDate?: string;
  insuranceExpiryDate?: string;
  authorizationExpiryDate?: string;
  province: string;
  district: string;
  sector: string;
  cell?: string;
  village?: string;
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
  rejectionReason?: string;
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
  rifani: 'moped',
  cab: 'car-side',
  hilux: 'pickup-truck',
  fuso: 'truck-trailer',
};

export const VEHICLE_LABELS: Record<VehicleType, string> = {
  moto: 'Moto',
  rifani: 'Rifani',
  cab: 'Cab',
  fuso: 'Fuso',
  hilux: 'Hilux',
};

export const VEHICLE_LABELS_FULL: Record<VehicleType, string> = {
  moto: 'Moto Bike',
  rifani: 'Rifani',
  cab: 'Cab Taxi',
  fuso: 'Heavy Fuso',
  hilux: 'Light Hilux',
};

export const VEHICLE_ICONS: Record<VehicleType, string> = {
  moto: 'motorcycle',
  rifani: 'motorcycle',
  cab: 'car',
  fuso: 'truck',
  hilux: 'truck',
};

export const VEHICLE_BASE_FARE: Record<VehicleType, number> = {
  moto: 500,
  rifani: 600,
  cab: 1500,
  fuso: 5000,
  hilux: 3000,
};

export const KIGALI_CENTER: Coords = {
  latitude: -1.9441,
  longitude: 30.0619,
};

export const MOCK_DRIVERS: MockDriver[] = [
  // Motos
  { id: 'd1', name: 'Jean Pierre', phone: '+250788111001', vehicleType: 'moto', plateNumber: 'RAD 001 A', location: { latitude: -1.9421, longitude: 30.0599 }, rating: 4.8, eta: 3 },
  { id: 'd2', name: 'Eric Nshimiye', phone: '+250788111002', vehicleType: 'moto', plateNumber: 'RAD 002 A', location: { latitude: -1.9380, longitude: 30.0560 }, rating: 4.7, eta: 4 },
  { id: 'd3', name: 'David Nkurunziza', phone: '+250788111003', vehicleType: 'moto', plateNumber: 'RAD 003 C', location: { latitude: -1.9431, longitude: 30.0649 }, rating: 4.7, eta: 4 },
  { id: 'd4', name: 'Patrick Uwimana', phone: '+250788111004', vehicleType: 'moto', plateNumber: 'RAD 004 D', location: { latitude: -1.9510, longitude: 30.0580 }, rating: 4.6, eta: 5 },
  { id: 'd5', name: 'Claude Bizimana', phone: '+250788111005', vehicleType: 'moto', plateNumber: 'RAD 005 E', location: { latitude: -1.9360, longitude: 30.0700 }, rating: 4.9, eta: 3 },
  { id: 'd6', name: 'Innocent Habimana', phone: '+250788111006', vehicleType: 'moto', plateNumber: 'RAD 006 F', location: { latitude: -1.9480, longitude: 30.0720 }, rating: 4.5, eta: 6 },
  { id: 'd7', name: 'Thierry Mugisha', phone: '+250788111007', vehicleType: 'moto', plateNumber: 'RAD 007 G', location: { latitude: -1.9550, longitude: 30.0650 }, rating: 4.8, eta: 4 },
  { id: 'd8', name: 'Olivier Niyonzima', phone: '+250788111008', vehicleType: 'moto', plateNumber: 'RAD 008 H', location: { latitude: -1.9400, longitude: 30.0530 }, rating: 4.6, eta: 5 },
  { id: 'd9', name: 'Alexis Rutaganda', phone: '+250788111009', vehicleType: 'moto', plateNumber: 'RAD 009 I', location: { latitude: -1.9320, longitude: 30.0610 }, rating: 4.7, eta: 7 },
  { id: 'd10', name: 'Fiston Nzeyimana', phone: '+250788111010', vehicleType: 'moto', plateNumber: 'RAD 010 J', location: { latitude: -1.9600, longitude: 30.0590 }, rating: 4.9, eta: 3 },

  { id: 'd31', name: 'Rifani Uwase', phone: '+250788111031', vehicleType: 'rifani', plateNumber: 'RAF 001 A', location: { latitude: -1.9415, longitude: 30.0605 }, rating: 4.8, eta: 4 },
  { id: 'd32', name: 'Emmanuel Niyonsaba', phone: '+250788111032', vehicleType: 'rifani', plateNumber: 'RAF 002 B', location: { latitude: -1.9495, longitude: 30.0675 }, rating: 4.7, eta: 5 },
  { id: 'd33', name: 'Fabrice Habimana', phone: '+250788111033', vehicleType: 'rifani', plateNumber: 'RAF 003 C', location: { latitude: -1.9335, longitude: 30.0545 }, rating: 4.9, eta: 3 },

  { id: 'd11', name: 'Marie Uwimana', phone: '+250788111011', vehicleType: 'cab', plateNumber: 'RAC 001 B', location: { latitude: -1.9461, longitude: 30.0639 }, rating: 4.9, eta: 5 },
  { id: 'd12', name: 'Alice Mukamana', phone: '+250788111012', vehicleType: 'cab', plateNumber: 'RAC 002 B', location: { latitude: -1.9451, longitude: 30.0590 }, rating: 4.6, eta: 7 },
  { id: 'd13', name: 'Solange Ingabire', phone: '+250788111013', vehicleType: 'cab', plateNumber: 'RAC 003 C', location: { latitude: -1.9390, longitude: 30.0680 }, rating: 4.8, eta: 5 },
  { id: 'd14', name: 'Diane Umubyeyi', phone: '+250788111014', vehicleType: 'cab', plateNumber: 'RAC 004 D', location: { latitude: -1.9530, longitude: 30.0700 }, rating: 4.7, eta: 6 },
  { id: 'd15', name: 'Gentil Nkusi', phone: '+250788111015', vehicleType: 'cab', plateNumber: 'RAC 005 E', location: { latitude: -1.9340, longitude: 30.0550 }, rating: 4.5, eta: 8 },
  { id: 'd16', name: 'Valens Hakizimana', phone: '+250788111016', vehicleType: 'cab', plateNumber: 'RAC 006 F', location: { latitude: -1.9580, longitude: 30.0620 }, rating: 4.9, eta: 4 },
  { id: 'd17', name: 'Josiane Mutesi', phone: '+250788111017', vehicleType: 'cab', plateNumber: 'RAC 007 G', location: { latitude: -1.9470, longitude: 30.0750 }, rating: 4.6, eta: 6 },
  { id: 'd18', name: 'Cedric Niyomugabo', phone: '+250788111018', vehicleType: 'cab', plateNumber: 'RAC 008 H', location: { latitude: -1.9300, longitude: 30.0640 }, rating: 4.8, eta: 5 },

  { id: 'd19', name: 'Robert Habimana', phone: '+250788111019', vehicleType: 'hilux', plateNumber: 'RAA 001 E', location: { latitude: -1.9411, longitude: 30.0629 }, rating: 4.9, eta: 6 },
  { id: 'd20', name: 'Samuel Ntwari', phone: '+250788111020', vehicleType: 'hilux', plateNumber: 'RAA 002 F', location: { latitude: -1.9500, longitude: 30.0560 }, rating: 4.7, eta: 7 },
  { id: 'd21', name: 'Bosco Tuyishime', phone: '+250788111021', vehicleType: 'hilux', plateNumber: 'RAA 003 G', location: { latitude: -1.9350, longitude: 30.0720 }, rating: 4.8, eta: 5 },
  { id: 'd22', name: 'Fidele Uwimana', phone: '+250788111022', vehicleType: 'hilux', plateNumber: 'RAA 004 H', location: { latitude: -1.9560, longitude: 30.0680 }, rating: 4.6, eta: 8 },
  { id: 'd23', name: 'Gaspard Nzabonimpa', phone: '+250788111023', vehicleType: 'hilux', plateNumber: 'RAA 005 I', location: { latitude: -1.9290, longitude: 30.0590 }, rating: 4.9, eta: 6 },
  { id: 'd24', name: 'Leonidas Murenzi', phone: '+250788111024', vehicleType: 'hilux', plateNumber: 'RAA 006 J', location: { latitude: -1.9620, longitude: 30.0640 }, rating: 4.7, eta: 7 },

  { id: 'd25', name: 'Augustin Nkurunziza', phone: '+250788111025', vehicleType: 'fuso', plateNumber: 'RAB 001 K', location: { latitude: -1.9440, longitude: 30.0570 }, rating: 4.8, eta: 10 },
  { id: 'd26', name: 'Theogene Bizumuremyi', phone: '+250788111026', vehicleType: 'fuso', plateNumber: 'RAB 002 L', location: { latitude: -1.9370, longitude: 30.0660 }, rating: 4.6, eta: 12 },
  { id: 'd27', name: 'Protais Habiyaremye', phone: '+250788111027', vehicleType: 'fuso', plateNumber: 'RAB 003 M', location: { latitude: -1.9540, longitude: 30.0730 }, rating: 4.7, eta: 11 },
  { id: 'd28', name: 'Sylvestre Nzeyimana', phone: '+250788111028', vehicleType: 'fuso', plateNumber: 'RAB 004 N', location: { latitude: -1.9310, longitude: 30.0580 }, rating: 4.9, eta: 9 },
  { id: 'd29', name: 'Modeste Uwimana', phone: '+250788111029', vehicleType: 'fuso', plateNumber: 'RAB 005 O', location: { latitude: -1.9590, longitude: 30.0610 }, rating: 4.5, eta: 13 },
  { id: 'd30', name: 'Celestin Nkusi', phone: '+250788111030', vehicleType: 'fuso', plateNumber: 'RAB 006 P', location: { latitude: -1.9420, longitude: 30.0760 }, rating: 4.8, eta: 10 },
];
