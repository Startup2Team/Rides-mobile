import { REFERRAL_EVENT_NAMES, buildReferralId, buildReferralLink } from '../referrals';

describe('referrals', () => {
  test('builds a backend-ready invite link', () => {
    expect(buildReferralLink('user-123')).toBe('https://rides.rw/invite?ref=user-123');
    expect(buildReferralLink('user id/123')).toBe('https://rides.rw/invite?ref=user%20id%2F123');
  });

  test('derives a stable referral id from the user id', () => {
    expect(buildReferralId('user-123')).toBe('user-123');
  });

  test('exposes backend-ready referral event names', () => {
    expect(REFERRAL_EVENT_NAMES).toEqual(expect.objectContaining({
      linkCreated: 'referral_link_created',
      qrDisplayed: 'referral_qr_displayed',
      linkShared: 'referral_link_shared',
      linkOpened: 'referral_link_opened',
      installAttributed: 'referral_install_attributed',
      signupCompleted: 'referral_signup_completed',
    }));
  });
});
