import { KIGALI_CENTER, type BookingFormDraft, type Coords, type DriverProfile, type DriverVehicleProfile, type PaymentMethod, type Ride, type RideLocation, type SavedLocation, type User } from '@/types';
import type {
  AuthRepository,
  BookingRepository,
  DriverRepository,
  MapRepository,
  NotificationRepository,
  PackageRepository,
  PaymentRepository,
  ProfileRepository,
  RideRepository,
  SavedLocationsRepository,
  SearchRepository,
  VehicleRepository,
} from '@/data/repositories/interfaces';
import {
  localAuthDataSource,
  localMapDataSource,
  localNotificationDataSource,
  localPackageDataSource,
  localPaymentDataSource,
  localProfileDataSource,
  localRideDataSource,
  localSavedLocationsDataSource,
  localSearchDataSource,
} from '@/data/sources/localDataSources';
import { createListenerSet } from '@/state/storeUtils';
import { MAX_SAVED_LOCATIONS } from '@/constants/savedLocations';
import type { NotificationReadState } from '@/persistence/notificationPersistence';
import { appendDriverVehicle, getDriverVehicles, setDriverActiveVehicle } from '@/domain/driverVehicles';

let bookingDraft: BookingFormDraft | null = null;
let recentSearchQueries: string[] = [];
let currentDriverProfile: DriverProfile | null = null;

const bookingListeners = createListenerSet<BookingFormDraft | null>();

export class LocalAuthRepository implements AuthRepository {
  async getCurrentUser() {
    return (await localAuthDataSource.loadStoredUser()).data;
  }

  async saveCurrentUser(user: User) {
    await localAuthDataSource.saveStoredUser(user);
  }

  async getDriverProfile() {
    currentDriverProfile = (await localAuthDataSource.loadStoredDriverProfile()).data;
    return currentDriverProfile;
  }

  async saveDriverProfile(profile: DriverProfile) {
    currentDriverProfile = profile;
    await localAuthDataSource.saveStoredDriverProfile(profile);
  }

  async clearSession() {
    bookingDraft = null;
    currentDriverProfile = null;
    recentSearchQueries = [];
  }
}

export class LocalProfileRepository implements ProfileRepository {
  async getProfileImage() {
    return (await localProfileDataSource.loadStoredProfileImage()).data ?? null;
  }

  async saveProfileImage(uri: string) {
    await localProfileDataSource.saveStoredProfileImage(uri);
  }

  async removeProfileImage() {
    await localProfileDataSource.removeStoredProfileImage();
  }
}

export class LocalBookingRepository implements BookingRepository {
  async getDraft() {
    return bookingDraft;
  }

  async saveDraft(draft: BookingFormDraft) {
    bookingDraft = draft;
    bookingListeners.notify(bookingDraft);
  }

  async clearDraft() {
    bookingDraft = null;
    bookingListeners.notify(bookingDraft);
  }
}

export class LocalRideRepository implements RideRepository {
  async appendRideHistory(completed: Ride) {
    await localRideDataSource.appendRideHistory(completed);
  }

  async loadRideHistory() {
    return (await localRideDataSource.loadRideHistory()) ?? null;
  }

  async getRideDetail(rideId: string) {
    const history = (await this.loadRideHistory()) ?? [];
    return history.find(ride => ride.id === rideId) ?? null;
  }

  async clearRideHistory() {
    return undefined;
  }
}

export class LocalSavedLocationsRepository implements SavedLocationsRepository {
  async listSavedLocations() {
    return (await localSavedLocationsDataSource.loadStoredSavedLocations()).data ?? [];
  }

  async replaceSavedLocations(next: SavedLocation[]) {
    await localSavedLocationsDataSource.saveStoredSavedLocations(next.slice(0, MAX_SAVED_LOCATIONS));
  }

  async saveLocation(location: RideLocation, label: string) {
    const cleanLabel = label.trim();
    if (!cleanLabel) return false;

    const existing = await this.listSavedLocations();
    const saved: SavedLocation = {
      ...location,
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      label: cleanLabel,
    };
    const next = [saved, ...existing.filter(place => place.label !== cleanLabel)].slice(0, MAX_SAVED_LOCATIONS);
    await this.replaceSavedLocations(next);
    return true;
  }

  async removeSavedLocation(id: string) {
    const next = (await this.listSavedLocations()).filter(location => location.id !== id);
    await this.replaceSavedLocations(next);
  }

  async clearSavedLocations() {
    await this.replaceSavedLocations([]);
  }
}

export class LocalDriverRepository implements DriverRepository {
  async getDriverProfile() {
    currentDriverProfile = (await localAuthDataSource.loadStoredDriverProfile()).data;
    return currentDriverProfile;
  }

  async saveDriverProfile(profile: DriverProfile) {
    currentDriverProfile = profile;
    await localAuthDataSource.saveStoredDriverProfile(profile);
  }

  async setOnlineState(isOnline: boolean) {
    const current = currentDriverProfile ?? (await this.getDriverProfile());
    if (!current) return;
    const next = { ...current, isOnline };
    await this.saveDriverProfile(next);
  }

  async clearDriverState() {
    currentDriverProfile = null;
  }
}

export class LocalVehicleRepository implements VehicleRepository {
  async getVehicles() {
    const profile = currentDriverProfile ?? (await this.getDriverProfile());
    return profile?.vehicles;
  }

  async setActiveVehicle(vehicleId: string | null) {
    await this.setPrimaryVehicle(vehicleId);
  }

  async setPrimaryVehicle(vehicleId: string | null) {
    const profile = currentDriverProfile ?? (await this.getDriverProfile());
    if (!profile) return;
    currentDriverProfile = setDriverActiveVehicle(profile, vehicleId);
    await localAuthDataSource.saveStoredDriverProfile(currentDriverProfile);
  }

  async addVehicle(vehicle: DriverVehicleProfile) {
    const profile = currentDriverProfile ?? (await this.getDriverProfile());
    if (!profile) return;
    currentDriverProfile = appendDriverVehicle(profile, vehicle);
    await localAuthDataSource.saveStoredDriverProfile(currentDriverProfile);
  }

  async updateVehicle(vehicle: DriverVehicleProfile) {
    const profile = currentDriverProfile ?? (await this.getDriverProfile());
    if (!profile) return;
    const vehicles = getDriverVehicles(profile);
    currentDriverProfile = {
      ...profile,
      vehicles: vehicles.some(item => item.id === vehicle.id)
        ? vehicles.map(item => item.id === vehicle.id ? vehicle : item)
        : [...vehicles, vehicle],
    };
    await localAuthDataSource.saveStoredDriverProfile(currentDriverProfile);
  }

  async deleteVehicle(vehicleId: string) {
    const profile = currentDriverProfile ?? (await this.getDriverProfile());
    if (!profile) return;
    const vehicles = getDriverVehicles(profile).filter(item => item.id !== vehicleId);
    currentDriverProfile = {
      ...profile,
      vehicles,
      activeVehicle: profile.activeVehicle?.vehicleId === vehicleId ? { vehicleId: null } : profile.activeVehicle,
    };
    await localAuthDataSource.saveStoredDriverProfile(currentDriverProfile);
  }

  private async getDriverProfile() {
    currentDriverProfile = (await localAuthDataSource.loadStoredDriverProfile()).data;
    return currentDriverProfile;
  }
}

export class LocalPackageRepository implements PackageRepository {
  async getCatalog() {
    return (await localPackageDataSource.packageCatalogRepository.getCatalog()) ?? null;
  }

  async refreshCatalog() {
    return localPackageDataSource.packageCatalogRepository.refreshCatalog();
  }

  async getCampaigns() {
    return (await localPackageDataSource.packageCampaignRepository.getCampaigns()) ?? null;
  }

  async refreshCampaigns() {
    return localPackageDataSource.packageCampaignRepository.refreshCampaigns();
  }

  async getOfferSource() {
    return (await localPackageDataSource.packageOfferSourceRepository.getOfferSource()) ?? null;
  }

  async refreshOfferSource() {
    return localPackageDataSource.packageOfferSourceRepository.refreshOfferSource();
  }
}

export class LocalNotificationRepository implements NotificationRepository {
  async getReadState() {
    return localNotificationDataSource.loadNotificationReadState();
  }

  async saveReadState(state: NotificationReadState) {
    await localNotificationDataSource.saveNotificationReadState(state);
  }

  async markRead(notificationId: string) {
    const state = await this.getReadState();
    state.read.add(notificationId);
    state.unread.delete(notificationId);
    await this.saveReadState(state);
  }

  async markUnread(notificationId: string) {
    const state = await this.getReadState();
    state.unread.add(notificationId);
    state.read.delete(notificationId);
    await this.saveReadState(state);
  }

  async clear() {
    await this.saveReadState({ read: new Set(), unread: new Set() });
  }
}

export class LocalPaymentRepository implements PaymentRepository {
  async listPaymentMethods() {
    return (await localPaymentDataSource.loadStoredPaymentMethods()).data ?? [];
  }

  async savePaymentMethods(methods: PaymentMethod[]) {
    await localPaymentDataSource.saveStoredPaymentMethods(methods);
  }

  async addPaymentMethod(method: PaymentMethod) {
    const methods = await this.listPaymentMethods();
    await this.savePaymentMethods([method, ...methods.filter(item => item.id !== method.id)]);
  }

  async removePaymentMethod(methodId: string) {
    const methods = await this.listPaymentMethods();
    await this.savePaymentMethods(methods.filter(method => method.id !== methodId));
  }
}

export class LocalSearchRepository implements SearchRepository {
  async search(query: string, options?: { near?: Coords; limit?: number }) {
    const results = await localSearchDataSource.geocodeAddress(query, options?.near ?? KIGALI_CENTER);
    return typeof options?.limit === 'number' ? results.slice(0, options.limit) : results;
  }

  async saveRecentQuery(query: string) {
    const clean = query.trim();
    if (!clean) return;
    recentSearchQueries = [clean, ...recentSearchQueries.filter(item => item !== clean)].slice(0, 10);
  }

  async loadRecentQueries() {
    return recentSearchQueries.slice();
  }

  async clearRecentQueries() {
    recentSearchQueries = [];
  }
}

export class LocalMapRepository implements MapRepository {
  async reverseGeocode(coords: Coords) {
    return localMapDataSource.reverseGeocode(coords);
  }
}

export const authRepository = new LocalAuthRepository();
export const profileRepository = new LocalProfileRepository();
export const bookingRepository = new LocalBookingRepository();
export const rideRepository = new LocalRideRepository();
export const savedLocationsRepository = new LocalSavedLocationsRepository();
export const driverRepository = new LocalDriverRepository();
export const vehicleRepository = new LocalVehicleRepository();
export const packageRepository = new LocalPackageRepository();
export const notificationRepository = new LocalNotificationRepository();
export const paymentRepository = new LocalPaymentRepository();
export const searchRepository = new LocalSearchRepository();
export const mapRepository = new LocalMapRepository();
