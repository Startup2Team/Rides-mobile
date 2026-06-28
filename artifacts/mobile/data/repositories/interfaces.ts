import type { GeocodeSuggestion } from '@/services/geocoding';
import type {
  BookingFormDraft,
  Coords,
  DriverProfile,
  DriverVehicleProfile,
  PaymentMethod,
  Ride,
  RideLocation,
  SavedLocation,
  User,
  VehicleType,
} from '@/types';
import type { DriverRidePackageCampaign } from '@/domain/driverRideCampaigns';
import type { DriverRidePackageCatalogEntry } from '@/domain/driverRidePackageCatalog';
import type { PackageOfferSourceCache } from '@/persistence/packageSyncPersistence';
import type { NotificationReadState } from '@/persistence/notificationPersistence';

export type RepositorySourceKind = 'local' | 'remote' | 'hybrid' | 'cache' | 'memory';

export type RepositoryErrorCode =
  | 'not_found'
  | 'validation_failed'
  | 'conflict'
  | 'offline'
  | 'unavailable'
  | 'unknown';

export interface RepositoryError {
  code: RepositoryErrorCode;
  message: string;
  retryable: boolean;
  cause?: unknown;
}

export interface RepositoryResult<T> {
  data: T | null;
  source: RepositorySourceKind;
  error: RepositoryError | null;
}

export interface AuthRepository {
  getCurrentUser(): Promise<User | null>;
  saveCurrentUser(user: User): Promise<void>;
  getDriverProfile(): Promise<DriverProfile | null>;
  saveDriverProfile(profile: DriverProfile): Promise<void>;
  clearSession(): Promise<void>;
}

export interface ProfileRepository {
  getProfileImage(): Promise<string | null>;
  saveProfileImage(uri: string): Promise<void>;
  removeProfileImage(): Promise<void>;
}

export interface BookingRepository {
  getDraft(): Promise<BookingFormDraft | null>;
  saveDraft(draft: BookingFormDraft): Promise<void>;
  clearDraft(): Promise<void>;
}

export interface RideRepository {
  appendRideHistory(completed: Ride): Promise<void>;
  loadRideHistory(): Promise<Ride[] | null>;
  clearRideHistory(): Promise<void>;
}

export interface SavedLocationsRepository {
  listSavedLocations(): Promise<SavedLocation[]>;
  replaceSavedLocations(next: SavedLocation[]): Promise<void>;
  saveLocation(location: RideLocation, label: string): Promise<boolean>;
  removeSavedLocation(id: string): Promise<void>;
  clearSavedLocations(): Promise<void>;
}

export interface DriverRepository {
  getDriverProfile(): Promise<DriverProfile | null>;
  saveDriverProfile(profile: DriverProfile): Promise<void>;
  setOnlineState(isOnline: boolean): Promise<void>;
  clearDriverState(): Promise<void>;
}

export interface VehicleRepository {
  getVehicles(): Promise<DriverProfile['vehicles']>;
  setActiveVehicle(vehicleId: string | null): Promise<void>;
  setPrimaryVehicle(vehicleId: string | null): Promise<void>;
  addVehicle(vehicle: DriverVehicleProfile): Promise<void>;
  updateVehicle(vehicle: DriverVehicleProfile): Promise<void>;
  deleteVehicle(vehicleId: string): Promise<void>;
}

export interface PackageRepository {
  getCatalog(): Promise<DriverRidePackageCatalogEntry[] | null>;
  refreshCatalog(): Promise<DriverRidePackageCatalogEntry[]>;
  getCampaigns(): Promise<DriverRidePackageCampaign[] | null>;
  refreshCampaigns(): Promise<DriverRidePackageCampaign[]>;
  getOfferSource(): Promise<PackageOfferSourceCache | null>;
  refreshOfferSource(): Promise<PackageOfferSourceCache>;
}

export interface NotificationRepository {
  getReadState(): Promise<NotificationReadState>;
  saveReadState(state: NotificationReadState): Promise<void>;
  markRead(notificationId: string): Promise<void>;
  markUnread(notificationId: string): Promise<void>;
  clear(): Promise<void>;
}

export interface PaymentRepository {
  listPaymentMethods(): Promise<PaymentMethod[]>;
  savePaymentMethods(methods: PaymentMethod[]): Promise<void>;
  addPaymentMethod(method: PaymentMethod): Promise<void>;
  removePaymentMethod(methodId: string): Promise<void>;
}

export interface SearchRepository {
  search(query: string, options?: { near?: Coords; limit?: number }): Promise<GeocodeSuggestion[]>;
  saveRecentQuery(query: string): Promise<void>;
  loadRecentQueries(): Promise<string[]>;
  clearRecentQueries(): Promise<void>;
}

export interface MapRepository {
  reverseGeocode(coords: Coords): Promise<RideLocation | null>;
}
