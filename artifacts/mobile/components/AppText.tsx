import React from 'react';
import {
  StyleProp,
  Text,
  TextProps,
  TextStyle,
} from 'react-native';
import { typography, type TypographyVariant } from '@/constants/typography';

export interface AppTextProps extends TextProps {
  variant?: TypographyVariant;
  color?: string;
  style?: StyleProp<TextStyle>;
  children?: React.ReactNode;
}

export function AppText({
  variant = 'body',
  color,
  style,
  children,
  ...props
}: AppTextProps) {
  return (
    <Text
      {...props}
      style={[
        typography[variant],
        color ? { color } : undefined,
        style,
      ]}
    >
      {children}
    </Text>
  );
}
