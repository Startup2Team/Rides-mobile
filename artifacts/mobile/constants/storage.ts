export type StorageClassification = 'sensitive' | 'internal' | 'cacheable';

export const STORAGE_KEYS = {
  user: '@rides_user',
  driverProfile: '@rides_driver_profile',
  driverOnboardingDraft: '@rides_driver_onboarding_draft',
  driverDocuments: '@rides_driver_documents',
  verificationSubmissions: '@rides_verification_submissions',
  driverEntitlement: '@rides_driver_entitlement',
  driverRatings: '@rides_driver_ratings',
  driverDailyGoals: '@rides_driver_daily_goals',
  referralEvents: '@rides_referral_events',
  rideHistory: '@rides_history',
  profileImage: '@rides_profile_image',
  paymentMethods: '@rides_payment_methods',
  packagePaymentClaims: '@rides_package_payment_claims',
  savedLocations: '@rides_saved_locations',
  packageCatalogCache: '@rides_package_catalog_cache',
  packageCampaignCache: '@rides_package_campaign_cache',
  packageOfferSourceCache: '@rides_package_offer_source_cache',
  lockedPackageOffers: '@rides_locked_package_offers',
  roleSync: '@rides_role_sync',
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
    STORAGE_KEYS.driverOnboardingDraft,
    STORAGE_KEYS.driverDocuments,
    STORAGE_KEYS.verificationSubmissions,
    STORAGE_KEYS.driverEntitlement,
    STORAGE_KEYS.driverRatings,
    STORAGE_KEYS.driverDailyGoals,
    STORAGE_KEYS.rideHistory,
    STORAGE_KEYS.profileImage,
    STORAGE_KEYS.paymentMethods,
    STORAGE_KEYS.packagePaymentClaims,
    STORAGE_KEYS.savedLocations,
    STORAGE_KEYS.lockedPackageOffers,
  ],
  internal: [STORAGE_KEYS.referralEvents, STORAGE_KEYS.roleSync],
  cacheable: [
    STORAGE_KEYS.packageCatalogCache,
    STORAGE_KEYS.packageCampaignCache,
    STORAGE_KEYS.packageOfferSourceCache,
  ],
} as const satisfies Record<StorageClassification, readonly string[]>;

export const SENSITIVE_STORAGE_KEYS = STORAGE_CLASSIFICATION.sensitive;
