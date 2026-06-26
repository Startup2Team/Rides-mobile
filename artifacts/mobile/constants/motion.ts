import { Easing } from 'react-native';

export const duration = {
  instant: 0,
  fast: 120,
  normal: 180,
  slow: 220,
  sheet: 250,
  modal: 300,
  toast: 200,
  long: 700,
  extraLong: 800,
} as const;

export const easing = {
  easeOutQuad: Easing.out(Easing.quad),
  easeOutCubic: Easing.out(Easing.cubic),
  easeInCubic: Easing.in(Easing.cubic),
} as const;

export const spring = {
  button: {
    speed: 22,
    bounciness: 0,
    useNativeDriver: true,
  },
  card: {
    bounciness: 8,
    speed: 18,
    useNativeDriver: true,
  },
  sheet: {
    bounciness: 4,
    useNativeDriver: true,
  },
  gallery: {
    damping: 20,
    stiffness: 220,
    useNativeDriver: true,
  },
} as const;

export type DurationToken = keyof typeof duration;
export type EasingToken = keyof typeof easing;
export type SpringToken = keyof typeof spring;
