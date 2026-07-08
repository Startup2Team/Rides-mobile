import { packageRepository, getDriverEntitlement, saveDriverEntitlement } from '../repository';
import {
  useActivatePackageMutation,
  useAvailablePackageOffersQuery,
  useCreatePackagePurchaseMutation,
  useDeductRideCreditMutation,
  useDriverEntitlementsQuery,
  useDriverPackagePurchasesQuery,
  usePackageCampaignsQuery,
  usePackageCatalogQuery,
  usePackagesQuery,
  useUpdatePackagePurchaseStatusMutation,
} from '../hooks';

describe('packages domain exports', () => {
  test('exposes repository helpers and query-backed hooks', () => {
    expect(typeof packageRepository.getOfferSource).toBe('function');
    expect(typeof getDriverEntitlement).toBe('function');
    expect(typeof saveDriverEntitlement).toBe('function');
    expect(typeof usePackageCatalogQuery).toBe('function');
    expect(typeof usePackageCampaignsQuery).toBe('function');
    expect(typeof useDriverEntitlementsQuery).toBe('function');
    expect(typeof useDriverPackagePurchasesQuery).toBe('function');
    expect(typeof useAvailablePackageOffersQuery).toBe('function');
    expect(typeof usePackagesQuery).toBe('function');
    expect(typeof useCreatePackagePurchaseMutation).toBe('function');
    expect(typeof useUpdatePackagePurchaseStatusMutation).toBe('function');
    expect(typeof useActivatePackageMutation).toBe('function');
    expect(typeof useDeductRideCreditMutation).toBe('function');
  });
});
