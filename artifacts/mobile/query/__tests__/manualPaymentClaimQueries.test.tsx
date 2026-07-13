import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import React from 'react';
import type { ManualPaymentClaim, PackagePaymentRepository } from '@/domains/package-payments';
import { EMPTY_DRIVER_ENTITLEMENT, createPackageOfferSnapshot } from '@/domain/driverRidePackages';
import { resolvePackageOffer } from '@/domain/driverRideCampaigns';
import { DRIVER_RIDE_PACKAGE_CATALOG } from '@/domain/driverRidePackageCatalog';
import { packagePaymentKeys } from '../keys/packagePaymentKeys';
import { useManualPaymentClaimQuery } from '../hooks/useManualPaymentClaimQuery';
import { useManualPaymentClaimsQuery } from '../hooks/useManualPaymentClaimsQuery';
import { useCancelManualPaymentClaimMutation, useCreateManualPaymentClaimMutation, useResubmitManualPaymentClaimMutation, useSubmitManualPaymentClaimMutation } from '../hooks/useManualPaymentClaimMutations';

const now = new Date('2026-07-06T10:00:00.000Z');
const vehicle = { vehicleId: 'vehicle-1', vehicleType: 'moto' as const };
const packageEntry = DRIVER_RIDE_PACKAGE_CATALOG.find(item => item.packageId === 'growth' && item.vehicleType === 'moto')!;
const offer = createPackageOfferSnapshot(
  resolvePackageOffer({
    package: packageEntry,
    vehicleType: 'moto',
    entitlement: EMPTY_DRIVER_ENTITLEMENT,
    now,
  }),
  vehicle,
  now,
);

const claim: ManualPaymentClaim = {
  id: 'RDP-2026-ABCDE',
  version: 2,
  driverId: 'driver-1',
  vehicleId: vehicle.vehicleId,
  vehicleType: vehicle.vehicleType,
  offerId: offer.offerId,
  packageId: offer.packageId,
  packageVersion: offer.packageVersion,
  packageName: offer.packageName,
  expectedAmountRwf: offer.priceRwf,
  provider: 'mtn',
  merchantCodeSnapshot: '0202565',
  payerPhoneNumber: '+250788000000',
  transactionReference: 'ABC123',
  status: 'submitted',
  createdAt: now.toISOString(),
  submittedAt: now.toISOString(),
  expiresAt: '2026-07-06T10:30:00.000Z',
  idempotencyKey: 'manual-payment-claim:RDP-2026-ABCDE',
  auditLog: [],
};

function createRepository(overrides: Partial<PackagePaymentRepository> = {}): PackagePaymentRepository {
  return {
    getPaymentConfiguration: jest.fn(),
    createManualPaymentClaim: jest.fn(),
    getManualPaymentClaim: jest.fn(),
    listDriverManualPaymentClaims: jest.fn(),
    submitManualPaymentClaim: jest.fn(),
    resubmitManualPaymentClaim: jest.fn(),
    cancelManualPaymentClaim: jest.fn(),
    ...overrides,
  } satisfies PackagePaymentRepository;
}

function createWrapper(queryClient: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('manual payment claim query hooks', () => {
  test('query keys are stable and include claim identity', () => {
    expect(packagePaymentKeys.claims()).toEqual(['package-payments', 'claims']);
    expect(packagePaymentKeys.claim(claim.id)).toEqual(['package-payments', 'claims', 'detail', claim.id]);
    expect(packagePaymentKeys.claimsList({ driverId: 'driver-1' })).toEqual(['package-payments', 'claims', 'list', { driverId: 'driver-1' }]);
  });

  test('list query maps claims and uses repository authority safely', async () => {
    const repository = createRepository({
      listDriverManualPaymentClaims: jest.fn().mockResolvedValue({ data: [claim], failure: null }),
    });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useManualPaymentClaimsQuery({ repository, driverId: 'driver-1' }), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(repository.listDriverManualPaymentClaims).toHaveBeenCalledWith('driver-1');
    expect(result.current.claims[0].authority).toBe('local_only_prototype');
    expect(result.current.refreshPolicy.refetchInterval).toBe(45_000);
  });

  test('detail query exposes presentation and does not poll terminal states', async () => {
    const repository = createRepository({
      getManualPaymentClaim: jest.fn().mockResolvedValue({ data: { ...claim, status: 'approved', reviewedAt: now.toISOString() }, failure: null }),
    });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useManualPaymentClaimQuery('RDP-2026-ABCDE', { repository }), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(repository.getManualPaymentClaim).toHaveBeenCalledWith('RDP-2026-ABCDE');
    expect(result.current.presentation?.title).toBe('Payment approved');
    expect(result.current.refreshPolicy.refetchInterval).toBe(false);
  });

  test('submit mutation invalidates claims and refetches on version conflict', async () => {
    const repository = createRepository({
      submitManualPaymentClaim: jest.fn().mockResolvedValue({
        data: null,
        failure: { code: 'claim_version_conflict', message: 'conflict' },
      }),
    });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const refetchSpy = jest.spyOn(queryClient, 'refetchQueries');
    const { result } = renderHook(() => useSubmitManualPaymentClaimMutation({ repository }), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({ claim });
    });

    expect(repository.submitManualPaymentClaim).toHaveBeenCalled();
    expect(refetchSpy).toHaveBeenCalledWith(expect.objectContaining({
      queryKey: packagePaymentKeys.claim(claim.id),
    }));
  });

  test('create mutation and cancel mutation remain repository driven', async () => {
    const repository = createRepository({
      createManualPaymentClaim: jest.fn().mockResolvedValue({ data: claim, failure: null }),
      cancelManualPaymentClaim: jest.fn().mockResolvedValue({ data: { ...claim, status: 'cancelled' }, failure: null }),
    });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const createHook = renderHook(() => useCreateManualPaymentClaimMutation({ repository }), {
      wrapper: createWrapper(queryClient),
    });
    const cancelHook = renderHook(() => useCancelManualPaymentClaimMutation({ repository }), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await createHook.result.current.mutateAsync({
        claimId: claim.id,
        driverId: claim.driverId,
        offer,
        provider: 'mtn',
        payerPhoneNumber: claim.payerPhoneNumber,
        transactionReference: claim.transactionReference,
      });
      await cancelHook.result.current.mutateAsync({ claim });
    });

    expect(repository.createManualPaymentClaim).toHaveBeenCalled();
    expect(repository.cancelManualPaymentClaim).toHaveBeenCalled();
  });

  test('resubmit mutation remains repository driven', async () => {
    const repository = createRepository({
      resubmitManualPaymentClaim: jest.fn().mockResolvedValue({ data: { ...claim, status: 'pending_review' }, failure: null }),
    });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useResubmitManualPaymentClaimMutation({ repository }), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({ claim: { ...claim, status: 'needs_clarification' } });
    });

    expect(repository.resubmitManualPaymentClaim).toHaveBeenCalled();
  });
});
