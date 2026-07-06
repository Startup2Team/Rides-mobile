import { z } from 'zod';
import { STORAGE_KEYS } from '@/constants/storage';
import type { ManualPaymentClaim } from '@/domains/package-payments';
import { manualPaymentClaimsSchema } from './storageSchemas';
import { loadSecureStorage, saveSecureStorage } from './secureStorage';

const manualPaymentClaimsStorageSchema = manualPaymentClaimsSchema as unknown as z.ZodType<ManualPaymentClaim[], z.ZodTypeDef, unknown>;

export const loadStoredManualPaymentClaims = () =>
  loadSecureStorage<ManualPaymentClaim[]>(STORAGE_KEYS.packagePaymentClaims, manualPaymentClaimsStorageSchema);

export const saveStoredManualPaymentClaims = (claims: ManualPaymentClaim[]) =>
  saveSecureStorage(STORAGE_KEYS.packagePaymentClaims, claims);
