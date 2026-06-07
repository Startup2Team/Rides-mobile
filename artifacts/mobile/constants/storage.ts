export type StorageClassification = 'sensitive' | 'internal' | 'cacheable';

export const STORAGE_KEYS = {
  user: '@rides_user',
  driverProfile: '@rides_driver_profile',
  rideHistory: '@rides_history',
  profileImage: '@rides_profile_image',
  paymentMethods: '@rides_payment_methods',
  savedLocations: '@rides_saved_locations',
} as const;

/**
 * Sensitive: identity, payment, profile media, or precise location/ride records.
 * Internal: non-public operational state that is not currently persisted.
 * Cacheable: replaceable, non-sensitive data that may use AsyncStorage.
 */
export const STORAGE_CLASSIFICATION = {
  sensitive: [
    STORAGE_KEYS.user,
    STORAGE_KEYS.driverProfile,
    STORAGE_KEYS.rideHistory,
    STORAGE_KEYS.profileImage,
    STORAGE_KEYS.paymentMethods,
    STORAGE_KEYS.savedLocations,
  ],
  internal: [],
  cacheable: [],
} as const satisfies Record<StorageClassification, readonly string[]>;

export const SENSITIVE_STORAGE_KEYS = STORAGE_CLASSIFICATION.sensitive;
