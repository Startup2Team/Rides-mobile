import { router } from 'expo-router';
import React from 'react';
import {
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton } from '@/components/BackButton';
import { AppText } from '@/components/AppText';
import { sizes } from '@/constants/sizes';
import { spacing, semanticSpacing } from '@/constants/spacing';
import { typography } from '@/constants/typography';
import { zIndex } from '@/constants/zIndex';
import { useColors } from '@/hooks/useColors';

export function useGlassHeaderMetrics() {
  const insets = useSafeAreaInsets();
  const headerInset = insets.top + (Platform.OS === 'web' ? 67 : 0);
  const headerHeight = 44;
  const contentGap = spacing[20];

  return {
    headerInset,
    contentTop: headerInset + headerHeight + contentGap,
    indicatorTop: headerInset + headerHeight - 2,
  };
}

interface GlassHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBackPress?: () => void;
  right?: React.ReactNode;
  titleAccessory?: React.ReactNode;
  bottom?: React.ReactNode;
}

export function GlassHeader({
  title,
  subtitle,
  showBack = true,
  onBackPress,
  right,
  titleAccessory,
  bottom,
}: GlassHeaderProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <View
      testID="glass-header"
      style={[
        styles.header,
        {
          paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 0),
          backgroundColor: colors.background,
        },
      ]}
    >
      <View style={styles.headerContent}>
        {showBack ? (
          <BackButton exitOnPress={false} onPress={onBackPress ?? (() => router.back())} />
        ) : (
          <View style={styles.sideSlot} />
        )}

        <View style={styles.headerCenter} pointerEvents="box-none">
          <View style={styles.titleStack}>
            <View style={styles.titleRow}>
              <AppText variant="h3" style={[styles.headerTitle, { color: colors.foreground }]} numberOfLines={1}>
                {title}
              </AppText>
              {titleAccessory}
            </View>
            {subtitle ? (
              <AppText variant="tiny" style={[styles.headerSubtitle, { color: colors.mutedForeground }]} numberOfLines={1}>
                {subtitle}
              </AppText>
            ) : null}
          </View>
        </View>

        {right ?? <View style={styles.sideSlot} />}
      </View>
      {bottom}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    position: 'absolute',
    top: spacing[0],
    left: spacing[0],
    right: spacing[0],
    zIndex: zIndex.header,
    paddingBottom: spacing[0],
    overflow: 'hidden',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    paddingHorizontal: semanticSpacing.cardPadding,
  },
  headerCenter: {
    position: 'absolute',
    left: 80,
    right: 80,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleStack: {
    alignItems: 'center',
    gap: spacing[2],
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: semanticSpacing.inlineGap,
    maxWidth: '100%',
  },
  headerTitle: {
    ...typography.h3,
  },
  headerSubtitle: {
    ...typography.tiny,
    marginTop: -2,
  },
  sideSlot: {
    width: sizes.iconButton.md,
    height: sizes.iconButton.md,
  },
});
