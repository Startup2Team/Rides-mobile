import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AppButton } from '@/components/AppButton';
import { AppText } from '@/components/AppText';
import { icons } from '@/constants/icons';
import { radius } from '@/constants/radius';
import { semanticSpacing, spacing } from '@/constants/spacing';
import { typography } from '@/constants/typography';
import { useColors } from '@/hooks/useColors';

export type IntercityStateTone = 'neutral' | 'warning' | 'error';

interface IntercityStateCardProps {
  icon: React.ComponentProps<typeof Feather>['name'];
  title: string;
  detail: string;
  tone?: IntercityStateTone;
  actionLabel?: string;
  onAction?: () => void;
  testID?: string;
}

/**
 * The one card every intercity screen uses for its loading / empty / error /
 * offline state, so those states are designed once and look identical
 * everywhere instead of drifting into six different placeholder strings.
 */
export function IntercityStateCard({
  icon,
  title,
  detail,
  tone = 'neutral',
  actionLabel,
  onAction,
  testID,
}: IntercityStateCardProps) {
  const colors = useColors();
  const accent =
    tone === 'error' ? colors.destructive : tone === 'warning' ? colors.warning : colors.mutedForeground;

  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="summary"
      accessibilityLabel={`${title}. ${detail}`}
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <Feather name={icon} size={icons.size.xl} color={accent} />
      <AppText style={[styles.title, { color: colors.foreground }]}>{title}</AppText>
      <AppText style={[styles.detail, { color: colors.mutedForeground }]}>{detail}</AppText>
      {actionLabel && onAction ? (
        <AppButton title={actionLabel} onPress={onAction} variant="secondary" size="sm" />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: semanticSpacing.cardPadding,
    borderRadius: radius.sheetCompact,
    borderWidth: 1,
    padding: semanticSpacing.screenPadding,
    alignItems: 'center',
    gap: semanticSpacing.inlineGap,
  },
  title: { ...typography.title, textAlign: 'center' },
  detail: { ...typography.caption, lineHeight: 18, textAlign: 'center', marginBottom: spacing[2] },
});
