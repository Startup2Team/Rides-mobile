import type { TextStyle } from 'react-native';
import { fonts } from './fonts';

export const typography = {
  displayXL: {
    fontSize: 34,
    lineHeight: 40,
    fontFamily: fonts.bold,
  },
  display: {
    fontSize: 30,
    lineHeight: 36,
    fontFamily: fonts.bold,
  },
  h1: {
    fontSize: 24,
    lineHeight: 30,
    fontFamily: fonts.bold,
  },
  h2: {
    fontSize: 20,
    lineHeight: 26,
    fontFamily: fonts.bold,
  },
  h3: {
    fontSize: 18,
    lineHeight: 24,
    fontFamily: fonts.semibold,
  },
  title: {
    fontSize: 16,
    lineHeight: 22,
    fontFamily: fonts.semibold,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: fonts.regular,
  },
  bodySmall: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fonts.regular,
  },
  label: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.medium,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fonts.regular,
  },
  tiny: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: fonts.medium,
  },
  button: {
    fontSize: 16,
    lineHeight: 20,
    fontFamily: fonts.semibold,
  },
  tab: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: fonts.medium,
  },
  badge: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: fonts.bold,
  },
  code: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fonts.code.default,
  },
} satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;
