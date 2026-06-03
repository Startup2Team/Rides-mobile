/** Rotating driver recruitment messages on the Home header CTA. */
export const DRIVER_CTA_MESSAGES = [
  'Join as Driver',
  'Drive and Earn',
  'Earn with Rides',
  'Be Your Own Boss',
] as const;

export type DriverCtaMessage = (typeof DRIVER_CTA_MESSAGES)[number];

/** Interval between message changes while Home is focused. */
export const DRIVER_CTA_ROTATION_MS = 45_000;

/** Fade-out + fade-in duration (total ~400ms). */
export const DRIVER_CTA_FADE_MS = 400;

/** Fixed CTA pill width — must not change when message rotates. */
export const DRIVER_CTA_PILL_WIDTH = 164;
