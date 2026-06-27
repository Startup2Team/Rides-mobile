import type { AppMode } from '@/types';

export type { AppMode, DriverProfile, User } from '@/types';

export type LanguagePreference = string;

export interface ProfilePhoto {
  uri: string | null;
  updatedAt?: string;
  source?: 'camera' | 'gallery' | 'system' | 'unknown';
}

export interface NotificationPreferences {
  rideUpdates?: boolean;
  paymentReceipts?: boolean;
  packageUpdates?: boolean;
  marketing?: boolean;
}

export interface AccountSettings {
  preferredLanguage?: LanguagePreference;
  notificationPreferences?: NotificationPreferences;
}

export interface ProfilePreferences {
  preferredLanguage?: LanguagePreference;
  notificationPreferences?: NotificationPreferences;
  accountSettings?: AccountSettings;
}

export interface ProfileIdentity {
  userId: string;
  fullName: string;
  phoneNumber: string;
  email?: string;
  profilePhoto?: ProfilePhoto | null;
  preferredLanguage?: LanguagePreference;
  notificationPreferences?: NotificationPreferences;
}

export interface UserProfile extends ProfileIdentity {
  mode?: AppMode;
  isDriver?: boolean;
  createdAt?: string;
  preferences?: ProfilePreferences;
}
