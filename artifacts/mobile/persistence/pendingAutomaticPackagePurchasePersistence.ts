import { z } from 'zod';
import { STORAGE_KEYS } from '@/constants/storage';
import { loadSecureStorage, removeSecureStorage, saveSecureStorage } from './secureStorage';

// Tracks an in-flight AUTOMATIC MoMo package purchase (POST
// /driver/packages/purchase, status PENDING) so a force-kill or app-switch mid
// payment resumes polling the SAME purchase instead of losing track of a real
// MoMo charge the driver may have already approved with their PIN. The server
// is still the source of truth either way — this is only so the UI can find the
// purchase id again; a lost record never blocks the purchase from settling
// (the driver's backend-authoritative ride-credit balance updates regardless).
//
// Keyed by `${vehicleId}:${packageId}` (NOT the offer id, which is re-minted
// every time the driver opens the payment screen) so re-entering the same
// package purchase after a cold start finds the outstanding attempt and never
// opens a second MoMo charge for it.

const pendingPurchaseSchema = z.object({
  purchaseId: z.string(),
  vehicleId: z.string(),
  packageId: z.string(),
  createdAt: z.string(),
});

export type PendingAutomaticPackagePurchase = z.infer<typeof pendingPurchaseSchema>;

const storeSchema = z.record(z.string(), pendingPurchaseSchema);

// Abandon a resumable record after this long — the sandbox/gateway will have
// long since settled or timed the charge out, so resuming it would just spin a
// dead poll. The server-side purchase itself is unaffected.
const MAX_RESUMABLE_AGE_MS = 24 * 60 * 60 * 1000;

function keyFor(vehicleId: string, packageId: string) {
  return `${vehicleId}:${packageId}`;
}

async function loadStore(): Promise<Record<string, PendingAutomaticPackagePurchase>> {
  return (await loadSecureStorage<Record<string, PendingAutomaticPackagePurchase>>(
    STORAGE_KEYS.pendingAutomaticPackagePurchases,
    storeSchema,
  )).data ?? {};
}

export async function savePendingAutomaticPackagePurchase(
  entry: PendingAutomaticPackagePurchase,
): Promise<void> {
  const store = await loadStore();
  await saveSecureStorage(STORAGE_KEYS.pendingAutomaticPackagePurchases, {
    ...store,
    [keyFor(entry.vehicleId, entry.packageId)]: entry,
  });
}

export async function loadPendingAutomaticPackagePurchase(
  vehicleId: string,
  packageId: string,
): Promise<PendingAutomaticPackagePurchase | null> {
  const store = await loadStore();
  const entry = store[keyFor(vehicleId, packageId)] ?? null;
  if (!entry) return null;
  const age = Date.now() - new Date(entry.createdAt).getTime();
  if (!Number.isFinite(age) || age > MAX_RESUMABLE_AGE_MS) {
    await clearPendingAutomaticPackagePurchase(vehicleId, packageId);
    return null;
  }
  return entry;
}

export async function clearPendingAutomaticPackagePurchase(
  vehicleId: string,
  packageId: string,
): Promise<void> {
  const store = await loadStore();
  const key = keyFor(vehicleId, packageId);
  if (!(key in store)) return;
  const next = { ...store };
  delete next[key];
  if (Object.keys(next).length === 0) {
    await removeSecureStorage(STORAGE_KEYS.pendingAutomaticPackagePurchases);
  } else {
    await saveSecureStorage(STORAGE_KEYS.pendingAutomaticPackagePurchases, next);
  }
}
