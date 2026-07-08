import React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { icons } from '@/constants/icons';
import { radius } from '@/constants/radius';
import { spacing, semanticSpacing } from '@/constants/spacing';
import { typography } from '@/constants/typography';
import { useColors } from '@/hooks/useColors';
import type { DriverStatisticsInsight } from '@/domains/driver-statistics';

interface DriverStatisticsInsightsCardProps {
  insights: DriverStatisticsInsight[];
  isNewDriverStatsState: boolean;
  emptyStateTitle: string;
  emptyStateDescription: string;
  onPress?: () => void;
}

export function DriverStatisticsInsightsCard({
  emptyStateDescription,
  emptyStateTitle,
  insights,
  isNewDriverStatsState,
  onPress,
}: DriverStatisticsInsightsCardProps) {
  const colors = useColors();
  const visibleInsights = insights.filter(insight => insight.id !== 'no-completed-trips').slice(0, 3);
  const showEmpty = isNewDriverStatsState || visibleInsights.length === 0;

  const cardContent = (
    <View style={styles.inner}>
      <View style={styles.header}>
        <View>
          <AppText style={[styles.title, { color: colors.foreground }]}>Trends</AppText>
          <AppText style={[styles.subtitle, { color: colors.mutedForeground }]}>Truthful local insights</AppText>
        </View>
        <View style={styles.headerRight}>
          <View style={[styles.iconBadge, { backgroundColor: colors.primaryHex + '14' }]}>
            <Feather name="activity" size={16} color={colors.primary} />
          </View>
          {onPress && (
            <View style={[styles.chevronBadge, { backgroundColor: colors.border }]}>
              <Feather name="chevron-right" size={10} color={colors.mutedForeground} />
            </View>
          )}
        </View>
      </View>
      {showEmpty ? (
        <View style={styles.emptyBody}>
          <View style={styles.emptyBars} accessible accessibilityRole="image" accessibilityLabel="No trend activity yet">
            {[10, 18, 28, 16].map((height, index) => (
              <View key={index} style={[styles.emptyBar, { height, backgroundColor: colors.border }]} />
            ))}
          </View>
          <AppText style={[styles.emptyTitle, { color: colors.foreground }]}>{emptyStateTitle}</AppText>
          <AppText style={[styles.emptyDescription, { color: colors.mutedForeground }]}>
            {emptyStateDescription}
          </AppText>
        </View>
      ) : (
        <View style={styles.insightList}>
          {visibleInsights.map(insight => (
            <View key={insight.id} style={styles.insightRow}>
              <Feather name="check-circle" size={14} color={colors.success} />
              <AppText style={[styles.insightText, { color: colors.foreground }]}>{insight.message}</AppText>
            </View>
          ))}
        </View>
      )}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        accessible
        accessibilityRole="button"
        accessibilityLabel="Trends card. Tap to see trends details."
        onPress={onPress}
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            opacity: pressed ? 0.75 : 1,
          },
        ]}
      >
        {cardContent}
      </Pressable>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      {cardContent}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius['3xl'],
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 3,
    ...Platform.select({ web: { boxShadow: '0 6px 18px rgba(0,0,0,0.08)' } }),
  },
  inner: {
    padding: semanticSpacing.cardPadding,
    gap: semanticSpacing.rowGap,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
  },
  title: {
    ...typography.title,
  },
  subtitle: {
    ...typography.tiny,
    marginTop: spacing[2],
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBody: {
    gap: spacing[8],
  },
  emptyBars: {
    height: 34,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing[4],
  },
  emptyBar: {
    width: 8,
    borderRadius: radius.pill,
  },
  emptyTitle: {
    ...typography.label,
  },
  emptyDescription: {
    ...typography.caption,
    lineHeight: 19,
  },
  insightList: {
    gap: spacing[10],
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[8],
  },
  insightText: {
    ...typography.caption,
    flex: 1,
    lineHeight: 19,
  },
  chevronBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
