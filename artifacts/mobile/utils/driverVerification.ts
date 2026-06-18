import type { DriverProfile, DriverVerificationStatus } from '@/types';

export function getDriverVerificationStatus(profile: DriverProfile | null | undefined): DriverVerificationStatus {
  if (!profile) return 'not_started';
  if (profile.verificationStatus) return profile.verificationStatus;
  return profile.isVerified ? 'approved' : 'pending_review';
}

export function canAccessDriverMode(profile: DriverProfile | null | undefined) {
  return getDriverVerificationStatus(profile) === 'approved' && profile?.isVerified === true;
}

export const canDriverGoOnline = canAccessDriverMode;

export function getDriverApplicationAction(profile: DriverProfile | null | undefined) {
  const status = getDriverVerificationStatus(profile);
  if (status === 'approved') return { label: 'Switch to Driver Mode', route: '/(driver)' as const };
  if (status === 'pending_review') return { label: 'In Review', route: '/driver-submission-confirmation' as const };
  if (status === 'rejected') return { label: 'Update application', route: '/driver-onboarding' as const };
  if (status === 'draft') return { label: 'Continue application', route: '/driver-onboarding' as const };
  return { label: 'Join as Driver', route: '/driver-onboarding' as const };
}

export function getLegacyDriverPolicyRedirect(profile: DriverProfile | null | undefined) {
  const status = getDriverVerificationStatus(profile);
  return status === 'not_started' || status === 'draft' || status === 'rejected'
    ? '/driver-onboarding' as const
    : '/driver-submission-confirmation' as const;
}

export function isProtectedDriverPath(pathname: string) {
  return pathname === '/(driver)'
    || pathname.startsWith('/(driver)/')
    || pathname === '/driver-documents'
    || pathname === '/driver-vehicles'
    || pathname === '/driver-add-vehicle'
    || pathname === '/driver-packages'
    || pathname === '/driver-negotiation'
    || pathname === '/driver-navigate';
}
