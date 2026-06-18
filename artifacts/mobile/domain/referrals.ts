import { Platform } from 'react-native';
import type { User } from '@/types';

export const REFERRAL_EVENT_NAMES = {
  linkCreated: 'referral_link_created',
  qrDisplayed: 'referral_qr_displayed',
  linkShared: 'referral_link_shared',
  linkOpened: 'referral_link_opened',
  installAttributed: 'referral_install_attributed',
  signupCompleted: 'referral_signup_completed',
} as const;

export type ReferralEventName = typeof REFERRAL_EVENT_NAMES[keyof typeof REFERRAL_EVENT_NAMES];

export interface ReferralEvent {
  id: string;
  name: ReferralEventName;
  userId: string;
  referralId: string;
  referralLink: string;
  method?: 'copy' | 'share' | 'open' | 'display';
  createdAt: string;
  platform: 'ios' | 'android' | 'web';
}

function sanitizeReferralId(userId: string) {
  return encodeURIComponent(userId.trim());
}

export function buildReferralLink(userOrUserId: Pick<User, 'id'> | string) {
  const userId = typeof userOrUserId === 'string' ? userOrUserId : userOrUserId.id;
  return `https://rides.rw/invite?ref=${sanitizeReferralId(userId)}`;
}

export function buildReferralId(userOrUserId: Pick<User, 'id'> | string) {
  const userId = typeof userOrUserId === 'string' ? userOrUserId : userOrUserId.id;
  return sanitizeReferralId(userId);
}

export function getReferralPlatform(): 'ios' | 'android' | 'web' {
  if (Platform.OS === 'ios') return 'ios';
  if (Platform.OS === 'android') return 'android';
  return 'web';
}
