import * as Location from 'expo-location';
import { geocodeAddress } from '@/services/geocoding';
import {
  loadStoredDriverProfile,
  loadStoredUser,
  saveStoredDriverProfile,
  saveStoredUser,
} from '@/persistence/authPersistence';
import {
  loadStoredProfileImage,
  removeStoredProfileImage,
  saveStoredProfileImage,
} from '@/persistence/profilePersistence';
import { loadStoredSavedLocations, saveStoredSavedLocations } from '@/persistence/savedLocationsPersistence';
import { loadNotificationReadState, saveNotificationReadState } from '@/persistence/notificationPersistence';
import { loadStoredPaymentMethods, saveStoredPaymentMethods } from '@/persistence/paymentPersistence';
import {
  packageCampaignRepository,
  packageCatalogRepository,
  packageOfferSourceRepository,
} from '@/services/packageSyncRepositories';
import type { Coords, RideLocation } from '@/types';
import { appendRideHistory, loadRideHistory } from '@/data/sources/localRideDataSource';

export const localAuthDataSource = {
  loadStoredUser,
  saveStoredUser,
  loadStoredDriverProfile,
  saveStoredDriverProfile,
};

export const localProfileDataSource = {
  loadStoredProfileImage,
  saveStoredProfileImage,
  removeStoredProfileImage,
};

export const localSavedLocationsDataSource = {
  loadStoredSavedLocations,
  saveStoredSavedLocations,
};

export const localRideDataSource = {
  loadRideHistory,
  appendRideHistory,
};

export const localNotificationDataSource = {
  loadNotificationReadState,
  saveNotificationReadState,
};

export const localPaymentDataSource = {
  loadStoredPaymentMethods,
  saveStoredPaymentMethods,
};

export const localPackageDataSource = {
  packageCatalogRepository,
  packageCampaignRepository,
  packageOfferSourceRepository,
};

export const localSearchDataSource = {
  geocodeAddress,
  async loadRecentQueries() {
    return [] as string[];
  },
  async saveRecentQuery() {
    return undefined;
  },
  async clearRecentQueries() {
    return undefined;
  },
};

export const localMapDataSource = {
  async reverseGeocode(coords: Coords): Promise<RideLocation | null> {
    const [geo] = await Location.reverseGeocodeAsync(coords).catch(() => [null]);
    if (!geo) return null;
    const address = [geo.name, geo.street, geo.city, geo.region].filter(Boolean).join(', ');
    return {
      latitude: coords.latitude,
      longitude: coords.longitude,
      address: address || undefined,
    };
  },
};
