export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  code: {
    ios: 'Menlo',
    android: 'monospace',
    default: 'monospace',
  },
} as const;

export type FontWeightName = keyof Pick<typeof fonts, 'regular' | 'medium' | 'semibold' | 'bold'>;
