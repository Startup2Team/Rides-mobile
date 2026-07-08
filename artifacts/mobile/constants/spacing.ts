export const spacing = {
  0: 0,
  2: 2,
  4: 4,
  6: 6,
  8: 8,
  10: 10,
  12: 12,
  14: 14,
  16: 16,
  20: 20,
  24: 24,
  28: 28,
  32: 32,
  40: 40,
  48: 48,
  64: 64,
} as const;

export const semanticSpacing = {
  screenPadding: spacing[20],
  cardPadding: spacing[16],
  sectionGap: spacing[24],
  rowGap: spacing[12],
  inlineGap: spacing[8],
  sheetPadding: spacing[20],
  listItemPadding: spacing[14],
  compactGap: spacing[6],
  comfortableGap: spacing[16],
} as const;

export type SpacingToken = keyof typeof spacing;
export type SemanticSpacingToken = keyof typeof semanticSpacing;
