import { z } from 'zod';
import { STORAGE_KEYS } from '@/constants/storage';
import type { ReferralEvent } from '@/domain/referrals';
import { loadVersionedStorage, saveVersionedStorage } from './versionedStorage';

const referralEventSchema = z.object({
  id: z.string(),
  name: z.enum([
    'referral_link_created',
    'referral_qr_displayed',
    'referral_link_shared',
    'referral_link_opened',
    'referral_install_attributed',
    'referral_signup_completed',
  ]),
  userId: z.string(),
  referralId: z.string(),
  referralLink: z.string(),
  method: z.enum(['copy', 'share', 'open', 'display']).optional(),
  createdAt: z.string(),
  platform: z.enum(['ios', 'android', 'web']),
});

const referralEventStoreSchema = z.array(referralEventSchema);

export async function loadStoredReferralEvents() {
  return loadVersionedStorage<ReferralEvent[]>(STORAGE_KEYS.referralEvents, referralEventStoreSchema);
}

export async function saveStoredReferralEvents(events: ReferralEvent[]) {
  return saveVersionedStorage(STORAGE_KEYS.referralEvents, events);
}

export async function appendStoredReferralEvent(event: ReferralEvent) {
  const stored = await loadStoredReferralEvents();
  const next = [...(stored.data ?? []), event];
  await saveStoredReferralEvents(next);
  return next;
}
