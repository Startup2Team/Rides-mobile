import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { router, usePathname } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Platform,
  useColorScheme,
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

  return {
    headerInset,
    contentTop: headerInset + 62,
    indicatorTop: headerInset + 60,
  };
}

interface GlassHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBackPress?: () => void;
  right?: React.ReactNode;
  titleAccessory?: React.ReactNode;
}

// Global store to track scroll states per route pathname
const listeners = new Map<string, Set<(isScrolled: boolean) => void>>();
const states = new Map<string, boolean>();

export const headerScrollStore = {
  set(pathname: string, isScrolled: boolean) {
    if (states.get(pathname) === isScrolled) return;
    states.set(pathname, isScrolled);
    const pathListeners = listeners.get(pathname);
    if (pathListeners) {
      pathListeners.forEach(listener => listener(isScrolled));
    }
  },
  get(pathname: string) {
    return states.get(pathname) ?? false;
  },
  subscribe(pathname: string, listener: (isScrolled: boolean) => void) {
    if (!listeners.has(pathname)) {
      listeners.set(pathname, new Set());
    }
    listeners.get(pathname)!.add(listener);
    return () => {
      listeners.get(pathname)?.delete(listener);
      if (listeners.get(pathname)?.size === 0) {
        listeners.delete(pathname);
        states.delete(pathname);
      }
    };
  },
};

export function GlassHeader({
  title,
  subtitle,
  showBack = true,
  onBackPress,
  right,
  titleAccessory,
}: GlassHeaderProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const glassTint = scheme === 'dark' ? 'dark' : 'light';
  const pathname = typeof usePathname === 'function' ? usePathname() : '/mock-path';
  const [isScrolled, setIsScrolled] = useState(() => headerScrollStore.get(pathname));

  useEffect(() => {
    setIsScrolled(headerScrollStore.get(pathname));
    return headerScrollStore.subscribe(pathname, setIsScrolled);
  }, [pathname]);

  return (
    <View
      style={[
        styles.header,
        {
          paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 0) + spacing[0],
          backgroundColor: isScrolled
            ? (scheme === 'dark' ? 'rgba(28, 28, 30, 0.45)' : 'rgba(255, 255, 255, 0.45)')
            : 'transparent',
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: isScrolled ? colors.border : 'transparent',
        },
      ]}
    >
      <BlurView intensity={isScrolled ? 90 : 0} tint={glassTint} style={StyleSheet.absoluteFill} />
      <View style={styles.headerContent}>
        {showBack ? (
          <BackButton exitOnPress={false} onPress={onBackPress ?? (() => router.back())} />
        ) : (
          <View style={styles.sideSlot} />
        )}
        <View style={styles.headerCenter} pointerEvents="box-none">
          <View style={styles.titleRow}>
            <AppText variant="h3" style={[styles.headerTitle, { color: colors.foreground }]} numberOfLines={1}>
              {title}
            </AppText>
            {titleAccessory}
          </View>
        </View>
        {right ?? <View style={styles.sideSlot} />}
      </View>
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
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: semanticSpacing.inlineGap, maxWidth: '100%' },
  headerTitle: {
    ...typography.h3,
  },
  headerSub: { ...typography.caption, marginTop: spacing[2] },
  sideSlot: { width: sizes.iconButton.md, height: sizes.iconButton.md },
});
