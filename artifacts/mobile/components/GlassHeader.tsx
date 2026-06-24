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
          paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 0) + 0,
          backgroundColor: scheme === 'dark' ? 'rgba(28, 28, 30, 0.45)' : 'rgba(255, 255, 255, 0.45)',
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
      ]}
    >
      <BlurView intensity={90} tint={glassTint} style={StyleSheet.absoluteFill} />
      <View style={styles.headerContent}>
        {showBack ? (
          <BackButton exitOnPress={false} onPress={onBackPress ?? (() => router.back())} />
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
    paddingBottom: 0,
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
