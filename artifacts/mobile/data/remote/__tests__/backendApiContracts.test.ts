import * as api from '../contracts/api';
import * as mappers from '../mappers';
import { repositoryResolver } from '../adapters';

describe('backend api contracts', () => {
  test('api contract modules export dto definitions', () => {
    expect(api.RequestRideRequestDto).toBeDefined();
    expect(api.AddPaymentMethodRequestDto).toBeDefined();
    expect(api.SubmitDriverApplicationRequestDto).toBeDefined();
    expect(api.ApiIdempotencyMetadata).toBeDefined();
  });

  test('mapper modules export dto/domain/error contracts', () => {
    expect(typeof mappers.dtoToDomainRide).toBe('function');
    expect(typeof mappers.domainToDtoRide).toBe('function');
    expect(typeof mappers.errorToRepositoryFailureRide).toBe('function');
    expect(typeof mappers.dtoToDomainPayment).toBe('function');
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
