export type DomainName =
  | 'auth'
  | 'profile'
  | 'booking'
  | 'ride'
  | 'driver'
  | 'vehicle'
  | 'saved-locations'
  | 'packages'
  | 'notifications'
  | 'payments'
  | 'search'
  | 'map'
  | 'shared';

export interface DomainOwnershipEntry {
  domain: DomainName;
  owns: string[];
  mustNotOwn: string[];
  currentFiles: string[];
  futureFiles: string[];
  canonicalRepository: string;
  canonicalStore: string | null;
  serverStateStrategy: 'query' | 'repository' | 'event-projection' | 'context' | 'manual' | 'shared';
}

export const DOMAIN_OWNERSHIP: Record<DomainName, DomainOwnershipEntry> = {
  auth: {
    domain: 'auth',
    owns: ['session', 'identity', 'role projection', 'logout boundary'],
    mustNotOwn: ['booking draft', 'saved locations', 'active ride truth'],
    currentFiles: ['context/AuthContext.tsx', 'persistence/authPersistence.ts', 'app/login.tsx'],
    futureFiles: ['domains/auth', 'data/repositories/interfaces.ts'],
    canonicalRepository: 'AuthRepository',
    canonicalStore: null,
    serverStateStrategy: 'repository',
  },
  profile: {
    domain: 'profile',
    owns: ['user profile', 'profile image', 'contact settings'],
    mustNotOwn: ['driver verification state', 'ride lifecycle'],
    currentFiles: ['persistence/profilePersistence.ts', 'components/ProfileAvatarCircle.tsx', 'app/profile.tsx'],
    futureFiles: ['domains/profile', 'data/repositories/interfaces.ts'],
    canonicalRepository: 'ProfileRepository',
    canonicalStore: null,
    serverStateStrategy: 'repository',
  },
  booking: {
    domain: 'booking',
    owns: ['booking draft', 'pickup draft', 'destination draft', 'selected vehicle'],
    mustNotOwn: ['driver verification state', 'saved-place persistence', 'ride history'],
    currentFiles: ['state/bookingStore.ts', 'context/ride/RideProvider.tsx', 'app/location-search.tsx'],
    futureFiles: ['domains/booking', 'state/bookingStore.ts'],
    canonicalRepository: 'BookingRepository',
    canonicalStore: 'bookingStore',
    serverStateStrategy: 'manual',
  },
  ride: {
    domain: 'ride',
    owns: ['active ride', 'ride history', 'ride lifecycle events', 'matching projection'],
    mustNotOwn: ['booking draft', 'driver verification state', 'package catalog'],
    currentFiles: ['context/ride/RideProvider.tsx', 'context/ride/rideContract.ts', 'context/ride/ridePersistence.ts'],
    futureFiles: ['domains/ride', 'data/repositories/interfaces.ts'],
    canonicalRepository: 'RideRepository',
    canonicalStore: null,
    serverStateStrategy: 'event-projection',
  },
  driver: {
    domain: 'driver',
    owns: ['driver profile', 'availability', 'driver session', 'driver onboarding projection'],
    mustNotOwn: ['customer booking draft', 'saved location CRUD', 'ride history'],
    currentFiles: ['context/DriverEntitlementContext.tsx', 'context/AuthContext.tsx', 'app/(driver)/index.tsx'],
    futureFiles: ['domains/driver', 'data/repositories/interfaces.ts'],
    canonicalRepository: 'DriverRepository',
    canonicalStore: 'driverSessionStore',
    serverStateStrategy: 'repository',
  },
  vehicle: {
    domain: 'vehicle',
    owns: ['vehicle list', 'active vehicle selection', 'vehicle verification projection'],
    mustNotOwn: ['booking draft', 'package catalog', 'ride lifecycle'],
    currentFiles: ['domain/driverVehicles.ts', 'persistence/driverProfilePersistence.ts', 'app/driver-vehicles.tsx'],
    futureFiles: ['domains/vehicle', 'data/repositories/interfaces.ts'],
    canonicalRepository: 'VehicleRepository',
    canonicalStore: null,
    serverStateStrategy: 'repository',
  },
  'saved-locations': {
    domain: 'saved-locations',
    owns: ['saved place CRUD', 'saved-place ordering', 'saved-place validation'],
    mustNotOwn: ['search drafts', 'booking truth', 'notification state'],
    currentFiles: ['context/SavedLocationsContext.tsx', 'persistence/savedLocationsPersistence.ts', 'app/saved-place-selector.tsx'],
    futureFiles: ['domains/saved-locations', 'data/repositories/interfaces.ts'],
    canonicalRepository: 'SavedLocationsRepository',
    canonicalStore: null,
    serverStateStrategy: 'repository',
  },
  packages: {
    domain: 'packages',
    owns: ['package catalog', 'campaigns', 'entitlements', 'package offer source'],
    mustNotOwn: ['ride lifecycle', 'customer booking draft', 'saved locations'],
    currentFiles: ['context/PackageSyncContext.tsx', 'services/packageSyncRepositories.ts', 'domain/driverRidePackages.ts'],
    futureFiles: ['domains/packages', 'data/repositories/interfaces.ts'],
    canonicalRepository: 'PackageRepository',
    canonicalStore: null,
    serverStateStrategy: 'repository',
  },
  notifications: {
    domain: 'notifications',
    owns: ['notification read state', 'notification feed projection'],
    mustNotOwn: ['ride lifecycle truth', 'booking draft', 'package entitlements'],
    currentFiles: ['persistence/notificationPersistence.ts', 'app/notifications.tsx', 'components/HomeTopHeader.tsx'],
    futureFiles: ['domains/notifications', 'data/repositories/interfaces.ts'],
    canonicalRepository: 'NotificationRepository',
    canonicalStore: null,
    serverStateStrategy: 'repository',
  },
  payments: {
    domain: 'payments',
    owns: ['payment methods', 'wallet metadata', 'transaction history'],
    mustNotOwn: ['driver verification truth', 'ride lifecycle', 'saved locations'],
    currentFiles: ['persistence/paymentPersistence.ts', 'app/payment-methods.tsx'],
    futureFiles: ['domains/payments', 'data/repositories/interfaces.ts'],
    canonicalRepository: 'PaymentRepository',
    canonicalStore: null,
    serverStateStrategy: 'repository',
  },
  search: {
    domain: 'search',
    owns: ['search query draft', 'suggestion selection', 'recent search session'],
    mustNotOwn: ['saved place persistence', 'ride truth', 'profile identity'],
    currentFiles: ['state/searchStore.ts', 'components/home/LocationSearchOverlay.tsx', 'app/location-search.tsx'],
    futureFiles: ['domains/search', 'data/repositories/interfaces.ts'],
    canonicalRepository: 'SearchRepository',
    canonicalStore: 'searchStore',
    serverStateStrategy: 'manual',
  },
  map: {
    domain: 'map',
    owns: ['map picker session', 'map picker selection', 'reverse geocode projection'],
    mustNotOwn: ['booking history', 'saved-place persistence', 'ride event truth'],
    currentFiles: ['state/mapPickerStore.ts', 'context/MapPickerContext.tsx', 'app/map-picker.tsx'],
    futureFiles: ['domains/map', 'data/repositories/interfaces.ts'],
    canonicalRepository: 'MapRepository',
    canonicalStore: 'mapPickerStore',
    serverStateStrategy: 'manual',
  },
  shared: {
    domain: 'shared',
    owns: ['cross-cutting primitives', 'shared types', 'shared UI contracts'],
    mustNotOwn: ['domain canonical state', 'repository implementation details'],
    currentFiles: ['types/index.ts', 'state/storeUtils.ts', 'constants/*.ts'],
    futureFiles: ['domains/shared'],
    canonicalRepository: 'SharedPrimitives',
    canonicalStore: null,
    serverStateStrategy: 'shared',
  },
} as const;

export const DOMAIN_NAMES = Object.keys(DOMAIN_OWNERSHIP) as DomainName[];
