export const iconSize = {
  xxs: 12,
  xs: 14,
  sm: 16,
  md: 18,
  lg: 20,
  xl: 24,
  xxl: 32,
  hero: 48,
} as const;

export const semanticIconSize = {
  tab: iconSize.xl,
  row: iconSize.md,
  card: iconSize.lg,
  button: iconSize.sm,
  badge: iconSize.xxs,
  hero: iconSize.hero,
} as const;

export type IconSizeToken = keyof typeof iconSize;
export type SemanticIconSizeToken = keyof typeof semanticIconSize;
