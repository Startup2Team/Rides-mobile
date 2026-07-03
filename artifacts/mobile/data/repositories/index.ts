export {
  authRepository,
  bookingRepository,
  driverRepository,
  mapRepository,
  notificationRepository,
  packageRepository,
  paymentRepository,
  profileRepository,
  rideRepository,
  searchRepository,
  vehicleRepository,
} from '@/data/adapters/localRepositories';
export { savedLocationsRepository } from './savedLocationsRepositoryFactory';
export { createSavedLocationsRepository, getSavedLocationsRepository, resetSavedLocationsRepositoryForTests } from './savedLocationsRepositoryFactory';
export type {
  AuthRepository,
  BookingRepository,
  DriverRepository,
  MapRepository,
  NotificationRepository,
  PackageRepository,
  PaymentRepository,
  ProfileRepository,
  RepositoryError,
  RepositoryErrorCode,
  RepositoryResult,
  RepositorySourceKind,
  RideRepository,
  SavedLocationsRepository,
  SearchRepository,
  VehicleRepository,
} from '@/data/repositories/interfaces';
