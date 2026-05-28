import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton } from '@/components/BackButton';
import { useColors } from '@/hooks/useColors';

export function useGlassHeaderMetrics() {
  const insets = useSafeAreaInsets();
  const headerInset = insets.top + (Platform.OS === 'web' ? 67 : 0);

  return {
    headerInset,
    contentTop: headerInset + 90,
    indicatorTop: headerInset + 88,
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
  const materialRgb = scheme === 'dark' ? '0,0,0' : '245,245,245';
  const glassTint = scheme === 'dark' ? 'dark' : 'light';

  return (
    <View
      style={[
        styles.header,
        {
          paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 0) + 12,
        },
      ]}
    >
      <BlurView intensity={60} tint={glassTint} style={StyleSheet.absoluteFill} />
      <LinearGradient
        pointerEvents="none"
        colors={[
          `rgba(${materialRgb},0.52)`,
          `rgba(${materialRgb},0.22)`,
          `rgba(${materialRgb},0)`,
        ]}
        locations={[0, 0.48, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.headerContent}>
        {showBack ? (
          <BackButton onPress={onBackPress ?? (() => router.back())} />
        ) : (
          <View style={styles.sideSlot} />
        )}
        <View style={styles.headerCenter}>
          <View style={styles.titleRow}>
            <Text style={[styles.headerTitle, { color: colors.foreground }]} numberOfLines={1}>
              {title}
            </Text>
            {titleAccessory}
          </View>
          {subtitle && (
            <Text style={[styles.headerSub, { color: colors.mutedForeground }]} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>
        {right ?? <View style={styles.sideSlot} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingBottom: 14,
    overflow: 'hidden',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  headerCenter: { flex: 1, alignItems: 'center', minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: '100%' },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    textShadowColor: 'rgba(0,0,0,0.16)',
    textShadowRadius: 8,
  },
  headerSub: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  sideSlot: { width: 44, height: 44 },
});
