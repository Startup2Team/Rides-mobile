import * as api from '../contracts/api';
import * as mappers from '../mappers';
import { repositoryResolver } from '../adapters';

describe('backend api contracts', () => {
  test('api contract modules export dto definitions', () => {
    expect(api.RequestRideRequestDto).toBeDefined();
    expect(api.AddPaymentMethodRequestDto).toBeDefined();
    expect(api.SubmitDriverApplicationRequestDto).toBeDefined();
    expect(api.VehicleDto).toBeDefined();
    expect(api.GetVehicleRequestDto).toBeDefined();
    expect(api.AddVehicleRequestDto).toBeDefined();
    expect(api.PackageCatalogItemDto).toBeDefined();
    expect(api.PackageCampaignDto).toBeDefined();
    expect(api.PackageOfferDto).toBeDefined();
    expect(api.PackageEntitlementDto).toBeDefined();
    expect(api.PackageOfferSourceDto).toBeDefined();
    expect(api.PackageOfferSourceResponseDto).toBeDefined();
    expect(api.PackagePurchaseResponseDto).toBeDefined();
    expect(api.PackageMutationResponseDto).toBeDefined();
    expect(api.PackageCatalogResponseDto).toBeDefined();
    expect(api.PackageCampaignResponseDto).toBeDefined();
    expect(api.PackageAvailableOffersResponseDto).toBeDefined();
    expect(api.GetPackageEntitlementResponseDto).toBeDefined();
    expect(api.PackageCatalogRequestDto).toBeDefined();
    expect(api.PackageCampaignRequestDto).toBeDefined();
    expect(api.PackageOfferSourceRequestDto).toBeDefined();
    expect(api.PackageAvailableOffersRequestDto).toBeDefined();
    expect(api.PackageEntitlementRequestDto).toBeDefined();
    expect(api.PackagePurchaseListRequestDto).toBeDefined();
    expect(api.CreatePackagePurchaseRequestDto).toBeDefined();
    expect(api.UpdatePackagePurchaseStatusRequestDto).toBeDefined();
    expect(api.ActivatePackageRequestDto).toBeDefined();
    expect(api.DeductCreditRequestDto).toBeDefined();
    expect(api.PaymentMethodsMutationResponseDto).toBeDefined();
    expect(api.ApiIdempotencyMetadata).toBeDefined();
  });

  test('mapper modules export dto/domain/error contracts', () => {
    expect(typeof mappers.dtoToDomainRide).toBe('function');
    expect(typeof mappers.domainToDtoRide).toBe('function');
    expect(typeof mappers.errorToRepositoryFailureRide).toBe('function');
    expect(typeof mappers.dtoToDomainPayment).toBe('function');
    expect(typeof mappers.dtoToDomainPaymentMethod).toBe('function');
    expect(typeof mappers.dtoToDomainBillingProfile).toBe('function');
    expect(typeof mappers.dtoToDomainPackageCatalogEntry).toBe('function');
    expect(typeof mappers.dtoToDomainPackageCampaign).toBe('function');
    expect(typeof mappers.dtoToDomainPackageEntitlement).toBe('function');
    expect(typeof mappers.dtoToDomainPackagePurchase).toBe('function');
    expect(typeof mappers.domainToAddPaymentMethodDto).toBe('function');
    expect(typeof mappers.domainToUpdatePaymentMethodDto).toBe('function');
    expect(typeof mappers.domainToDeletePaymentMethodDto).toBe('function');
    expect(typeof mappers.domainToSetDefaultPaymentMethodDto).toBe('function');
    expect(typeof mappers.domainToCreatePackagePurchaseDto).toBe('function');
    expect(typeof mappers.domainToUpdatePackagePurchaseStatusDto).toBe('function');
    expect(typeof mappers.domainToActivatePackageDto).toBe('function');
    expect(typeof mappers.domainToDeductCreditDto).toBe('function');
    expect(typeof mappers.errorToRepositoryFailurePayment).toBe('function');
    expect(typeof mappers.errorToRepositoryFailurePackage).toBe('function');
  });

  test('write dtos preserve idempotency and correlation metadata', () => {
    const requestRide: api.RequestRideRequestDto = {
      rideId: 'ride-1',
      pickup: { address: 'Pickup', latitude: -1.94, longitude: 30.06 },
      destination: { address: 'Destination', latitude: -1.95, longitude: 30.07 },
      vehicleType: 'moto',
      requestedFare: 12000,
      idempotencyKey: 'ride:ride-1:request:customer-1',
      correlationId: 'corr-1',
      actorId: 'customer-1',
      actorRole: 'customer',
      clientTimestamp: '2026-07-02T10:00:00.000Z',
    };

    const addPaymentMethod: api.AddPaymentMethodRequestDto = {
      provider: 'mtn',
      label: 'MTN Mobile Money',
      phoneNumber: '788000000',
      isDefault: true,
      idempotencyKey: 'payment:add:1',
      correlationId: 'corr-2',
      actorId: 'user-1',
      actorRole: 'customer',
      clientTimestamp: '2026-07-02T10:00:00.000Z',
    };

    expect(requestRide.actorRole).toBe('customer');
    expect(addPaymentMethod.idempotencyKey).toContain('payment:add');
  });

  test('payment write dtos preserve idempotency correlation and actor metadata', () => {
    const updatePaymentMethod: api.UpdatePaymentMethodRequestDto = {
      methodId: 'mtn_1',
      label: 'Personal MTN',
      phoneNumber: '788000000',
      isDefault: false,
      idempotencyKey: 'payment:update:1',
      correlationId: 'corr-2b',
      actorId: 'user-1',
      actorRole: 'customer',
      clientTimestamp: '2026-07-02T10:00:00.000Z',
    };
    const defaultPaymentMethod: api.SetDefaultPaymentMethodRequestDto = {
      methodId: 'mtn_1',
      idempotencyKey: 'payment:default:1',
      correlationId: 'corr-2c',
      actorId: 'user-1',
      actorRole: 'customer',
      clientTimestamp: '2026-07-02T10:00:00.000Z',
    };

    expect(updatePaymentMethod.actorRole).toBe('customer');
    expect(defaultPaymentMethod.methodId).toBe('mtn_1');
  });

  test('package write dtos preserve idempotency correlation and actor metadata', () => {
    const createPurchase: api.CreatePackagePurchaseRequestDto = {
      packageId: 'growth',
      packageVersion: 'v1',
      packageName: 'Growth Package',
      offerId: 'offer-1',
      vehicleId: 'vehicle-1',
      vehicleType: 'moto',
      provider: 'mtn',
      phoneNumber: '0781234567',
      amount: 2_000,
      pricePaid: 2_000,
      ridesGranted: 60,
      bonusRidesGranted: 15,
      campaignId: 'camp-1',
      campaignName: 'Launch Sale',
      campaignType: 'global',
      campaignStatus: 'active',
      idempotencyKey: 'package:create:1',
      correlationId: 'corr-7',
      actorId: 'driver-1',
      actorRole: 'driver',
      clientTimestamp: '2026-07-02T10:00:00.000Z',
    };
    const deductCredit: api.DeductCreditRequestDto = {
      rideId: 'ride-1',
      vehicleId: 'vehicle-1',
      vehicleType: 'moto',
      credits: 1,
      packageActivationId: 'activation-1',
      idempotencyKey: 'package:deduct:1',
      correlationId: 'corr-8',
      actorId: 'driver-1',
      actorRole: 'driver',
      clientTimestamp: '2026-07-02T10:30:00.000Z',
    };

    expect(createPurchase.actorRole).toBe('driver');
    expect(deductCredit.rideId).toBe('ride-1');
  });

  test('vehicle api dtos preserve actor model and transport metadata', () => {
    const addVehicle: api.AddVehicleRequestDto = {
      vehicleType: 'moto',
      plateNumber: 'RAB 123A',
      licenseNumber: 'LIC-123',
      model: 'Bajaj',
      brand: 'TVS',
      idempotencyKey: 'vehicle:add:1',
      correlationId: 'corr-5',
      actorId: 'driver-1',
      actorRole: 'driver',
      clientTimestamp: '2026-07-02T10:00:00.000Z',
    };
    const setPrimary: api.SetPrimaryVehicleRequestDto = {
      vehicleId: 'vehicle-1',
      idempotencyKey: 'vehicle:primary:1',
      correlationId: 'corr-6',
      actorId: 'driver-1',
      actorRole: 'driver',
      clientTimestamp: '2026-07-02T10:00:00.000Z',
    };

    expect(addVehicle.actorRole).toBe('driver');
    expect(setPrimary.vehicleId).toBe('vehicle-1');
  });

  test('ride api dtos preserve actor model for lifecycle writes', () => {
    const acceptRide: api.AcceptRideRequestDto = {
      rideId: 'ride-1',
      driverId: 'driver-1',
      vehicleId: 'vehicle-1',
      acceptedFare: 10000,
      idempotencyKey: 'ride:ride-1:accept:driver-1',
      correlationId: 'corr-3',
      actorId: 'driver-1',
      actorRole: 'driver',
      clientTimestamp: '2026-07-02T10:00:00.000Z',
    };
    const completeRide: api.CompleteRideRequestDto = {
      rideId: 'ride-1',
      completedAt: '2026-07-02T10:30:00.000Z',
      idempotencyKey: 'ride:ride-1:complete:driver-1',
      correlationId: 'corr-4',
      actorId: 'driver-1',
      actorRole: 'driver',
      clientTimestamp: '2026-07-02T10:30:00.000Z',
    };

    expect(acceptRide.actorRole).toBe('driver');
    expect(completeRide.actorRole).toBe('driver');
  });

  test('default repository source remains local', () => {
    expect(repositoryResolver.getMode()).toBe('LOCAL');
  });
});
