import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import React from 'react';
import { InMemoryPackagePaymentRepository } from '@/domains/package-payments';
import {
  DEFAULT_SAFE_PACKAGE_PAYMENT_CONFIGURATION,
  type PackagePaymentConfiguration,
  type PackagePaymentOutcome,
  type PackagePaymentRepository,
} from '@/domains/package-payments';
import { reportOperationalWarning } from '@/observability/monitoring';
import { packagePaymentConfigurationQueryPolicy, packagePaymentKeys } from '../keys/packagePaymentKeys';
import { usePackagePaymentConfigQuery } from '../hooks/usePackagePaymentConfigQuery';

jest.mock('@/observability/monitoring', () => ({
  reportOperationalWarning: jest.fn(),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

function repository(outcome: PackagePaymentOutcome<PackagePaymentConfiguration> | Promise<PackagePaymentOutcome<PackagePaymentConfiguration>>) {
  return {
    getPaymentConfiguration: jest.fn().mockResolvedValue(outcome),
    createManualPaymentClaim: jest.fn(),
    getManualPaymentClaim: jest.fn(),
    listDriverManualPaymentClaims: jest.fn(),
    submitManualPaymentClaim: jest.fn(),
    resubmitManualPaymentClaim: jest.fn(),
    cancelManualPaymentClaim: jest.fn(),
  } satisfies PackagePaymentRepository;
}

describe('usePackagePaymentConfigQuery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('falls back to automatic when no repository data is available', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => usePackagePaymentConfigQuery({
      repository: new InMemoryPackagePaymentRepository(null),
    }), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.configuration.mode).toBe('automatic');
    expect(result.current.fallbackConfiguration).toEqual(DEFAULT_SAFE_PACKAGE_PAYMENT_CONFIGURATION);
    expect(result.current.isFallbackUsed).toBe(true);
  });

  test('returns repository config when it is valid', async () => {
    const config: PackagePaymentConfiguration = {
      mode: 'manual',
      version: '2026-07-06',
      updatedAt: '2026-07-06T10:00:00.000Z',
      manual: {
        providers: [{
          provider: 'mtn',
          merchantCode: '0202565',
          ussdTemplate: '*182*8*1*{merchantCode}*{amount}#',
          enabled: true,
        }],
        claimExpiresAfterMinutes: 30,
        transactionReferenceRequired: true,
        proofImageEnabled: true,
      },
    };
    const wrapper = createWrapper();
    const repo = repository({ data: config, failure: null });
    const { result } = renderHook(() => usePackagePaymentConfigQuery({ repository: repo }), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.configuration).toEqual(config);
    expect(result.current.rawConfiguration).toEqual(config);
    expect(result.current.failure).toBeNull();
    expect(result.current.isFallbackUsed).toBe(false);
    expect(repo.getPaymentConfiguration).toHaveBeenCalledTimes(1);
  });

  test('falls back to automatic when repository returns malformed config', async () => {
    const wrapper = createWrapper();
    const repo = repository({
      data: {
        mode: 'manual',
        version: '',
        updatedAt: 'invalid',
      } as never,
      failure: null,
    });
    const { result } = renderHook(() => usePackagePaymentConfigQuery({ repository: repo }), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.configuration.mode).toBe('automatic');
    expect(result.current.rawConfiguration).toEqual({
      mode: 'manual',
      version: '',
      updatedAt: 'invalid',
    });
    expect(result.current.isFallbackUsed).toBe(true);
  });

  test('falls back to automatic when repository fails', async () => {
    const wrapper = createWrapper();
    const repo = {
      getPaymentConfiguration: jest.fn().mockRejectedValue(new Error('offline')),
      createManualPaymentClaim: jest.fn(),
      getManualPaymentClaim: jest.fn(),
      listDriverManualPaymentClaims: jest.fn(),
      submitManualPaymentClaim: jest.fn(),
      resubmitManualPaymentClaim: jest.fn(),
      cancelManualPaymentClaim: jest.fn(),
    } satisfies PackagePaymentRepository;
    const { result } = renderHook(() => usePackagePaymentConfigQuery({ repository: repo }), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.configuration.mode).toBe('automatic');
    expect(result.current.failure?.code).toBe('repository_unavailable');
    expect(result.current.isFallbackUsed).toBe(true);
  });

  test('reads manual and disabled modes without changing checkout behavior', async () => {
    const manualConfig: PackagePaymentConfiguration = {
      mode: 'manual',
      version: '2026-07-06',
      updatedAt: '2026-07-06T10:00:00.000Z',
      manual: {
        providers: [{
          provider: 'airtel',
          merchantCode: '3378888',
          ussdTemplate: '*182*8*1*{merchantCode}*{amount}#',
          enabled: true,
        }],
        claimExpiresAfterMinutes: 30,
        transactionReferenceRequired: true,
        proofImageEnabled: true,
      },
    };
    const disabledConfig: PackagePaymentConfiguration = {
      mode: 'disabled',
      version: '2026-07-06',
      updatedAt: '2026-07-06T10:00:00.000Z',
    };
    const manualRepo = repository({ data: manualConfig, failure: null });
    const disabledRepo = repository({ data: disabledConfig, failure: null });

    const manualHook = renderHook(() => usePackagePaymentConfigQuery({ repository: manualRepo }), { wrapper: createWrapper() });
    const disabledHook = renderHook(() => usePackagePaymentConfigQuery({ repository: disabledRepo }), { wrapper: createWrapper() });

    await waitFor(() => expect(manualHook.result.current.isLoading).toBe(false));
    await waitFor(() => expect(disabledHook.result.current.isLoading).toBe(false));

    expect(manualHook.result.current.configuration.mode).toBe('manual');
    expect(disabledHook.result.current.configuration.mode).toBe('disabled');
    expect(manualRepo.getPaymentConfiguration).toHaveBeenCalledTimes(1);
    expect(disabledRepo.getPaymentConfiguration).toHaveBeenCalledTimes(1);
  });

  test('exposes query key and cache policy', () => {
    expect(packagePaymentKeys.configuration()).toEqual(['package-payments', 'configuration']);
    expect(packagePaymentConfigurationQueryPolicy).toMatchObject({
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      retry: false,
    });
  });

  test('emits sanitized telemetry without sensitive fields', async () => {
    const wrapper = createWrapper();
    const repo = repository({
      data: {
        mode: 'manual',
        version: '2026-07-06',
        updatedAt: '2026-07-06T10:00:00.000Z',
        manual: {
          providers: [{
            provider: 'mtn',
            merchantCode: '0202565',
            ussdTemplate: '*182*8*1*{merchantCode}*{amount}#',
            enabled: true,
          }],
          claimExpiresAfterMinutes: 30,
          transactionReferenceRequired: true,
          proofImageEnabled: true,
        },
      },
      failure: null,
    });

    const { result } = renderHook(() => usePackagePaymentConfigQuery({ repository: repo }), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const payloads = (reportOperationalWarning as jest.Mock).mock.calls.map(call => call[1]);
    const combined = JSON.stringify(payloads);
    expect(combined).not.toContain('0202565');
    expect(combined).not.toContain('3378888');
    expect(combined).not.toContain('+250');
    expect(combined).not.toContain('proof');
    expect(combined).not.toContain('support');
    expect(combined).toContain('manual');
  });
});
