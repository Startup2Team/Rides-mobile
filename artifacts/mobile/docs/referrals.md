# Referral Sharing

The mobile app now supports a backend-ready referral flow through a dedicated Share tab in the bottom navigation.

## Current mobile behavior

- A signed-in user can open Share App from the tab bar or from Profile.
- The app builds a unique invite link with `?ref=<userId>`.
- The app renders a QR code for that link.
- The app can copy or share the invite link locally.
- The app logs local events for:
  - `referral_link_created`
  - `referral_qr_displayed`
  - `referral_link_shared`
  - `referral_link_opened`

## What is not complete yet

The mobile app does not yet prove install attribution on its own.

QR scan tracking alone cannot tell us who installed the app. That requires backend attribution and deferred deep linking support.

## Backend-ready event flow

The backend should eventually receive and correlate:

1. Referral link created
2. QR shown
3. Link shared
4. Link opened
5. App install attributed
6. Signup completed

## Attribution strategy

- Android: Play Install Referrer
- iOS: Universal Links plus App Store campaign attribution or a third-party attribution provider later
- Web: normal link tracking and redirect logs

## Recommended backend handling

- Record the referrer user id from the invite link.
- Persist a server-side referral code map.
- Accept idempotent referral events using a generated event id or request id.
- Attribute install and signup only after a trusted backend signal arrives.
- Keep the mobile app behavior unchanged until attribution endpoints exist.
