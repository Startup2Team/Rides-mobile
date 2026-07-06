export const radius = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 10,
  lg: 12,
  xl: 14,
  '2xl': 16,
  '3xl': 20,
  sheetCompact: 22,
  sheet: 24,
  pill: 999,
  full: 999,
  card: 14,
  button: 999,
  input: 12,
} as const;

export type RadiusToken = keyof typeof radius;
