import React from 'react';
import {
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { GlassHeader, useGlassHeaderMetrics } from '@/components/GlassHeader';
import { GlassScrollView } from '@/components/GlassScrollView';
import {
  APP_NAME,
  OSS_URL,
  PRIVACY_URL,
  TERMS_URL,
} from '@/constants/branding';
import { useColors } from '@/hooks/useColors';

const LINKS = [
  { label: 'Terms of Service', icon: 'file-text' as const, url: TERMS_URL },
  { label: 'Privacy Policy', icon: 'shield' as const, url: PRIVACY_URL },
  { label: 'Open Source Licences', icon: 'code' as const, url: OSS_URL },
];

const STATS = [
  { label: 'Countries', value: '1', sub: 'Rwanda' },
  { label: 'Vehicle types', value: '4', sub: 'Moto · Cab · Hilux · Fuso' },
  { label: 'Languages', value: '4', sub: 'EN · FR · RW · LG' },
];

export default function AboutScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const headerMetrics = useGlassHeaderMetrics();

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <GlassHeader title={`About ${APP_NAME}`} />

      <GlassScrollView
        indicatorTop={headerMetrics.indicatorTop}
        contentContainerStyle={[styles.scroll, { paddingTop: headerMetrics.contentTop, paddingBottom: insets.bottom + 40 }]}
      >
        <View style={styles.hero}>
          <View style={[styles.logoMark, { backgroundColor: colors.primary }]}>
            <Feather name="navigation" size={32} color={colors.primaryForeground} />
          </View>
          <Text style={[styles.appName, { color: colors.foreground }]}>{APP_NAME}</Text>
          <Text style={[styles.tagline, { color: colors.mutedForeground }]}>
            Rwanda's ride platform — Moto to Fuso
          </Text>
          <View style={[styles.versionBadge, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <Text style={[styles.versionText, { color: colors.mutedForeground }]}>Version 1.0.0</Text>
          </View>
        </View>

        <View style={[styles.statsRow, { backgroundColor: colors.card }]}>
          {STATS.map((stat, i) => (
            <React.Fragment key={stat.label}>
              {i > 0 && <View style={[styles.statDivider, { backgroundColor: colors.border }]} />}
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.primary }]}>{stat.value}</Text>
                <Text style={[styles.statLabel, { color: colors.foreground }]}>{stat.label}</Text>
                <Text style={[styles.statSub, { color: colors.mutedForeground }]}>{stat.sub}</Text>
              </View>
            </React.Fragment>
          ))}
        </View>

        <View style={[styles.missionCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.missionTitle, { color: colors.foreground }]}>Our Mission</Text>
          <Text style={[styles.missionText, { color: colors.mutedForeground }]}>
            To make safe, affordable, and reliable transport accessible to every Rwandan — connecting communities across the country with a tap.
          </Text>
        </View>

        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>LEGAL</Text>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          {LINKS.map((link, i) => (
            <View key={link.label}>
              {i > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
              <TouchableOpacity
                style={styles.linkRow}
                onPress={() => Linking.openURL(link.url)}
                activeOpacity={0.75}
              >
                <View style={styles.linkIcon}>
                  <Feather name={link.icon} size={20} color={colors.primary} />
                </View>
                <Text style={[styles.linkLabel, { color: colors.foreground, flex: 1 }]}>{link.label}</Text>
                <Feather name="external-link" size={14} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          ))}
        </View>

        <Text style={[styles.copyright, { color: colors.mutedForeground }]}>
          © 2026 {APP_NAME} · Kigali, Rwanda
        </Text>
      </GlassScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 20 },
  hero: { alignItems: 'center', paddingTop: 32, paddingBottom: 28, gap: 8 },
  logoMark: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  appName: { fontSize: 26, fontFamily: 'Inter_700Bold' },
  tagline: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  versionBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 4,
  },
  versionText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  statsRow: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    ...Platform.select({
      ios: { borderCurve: 'continuous' },
    }),
  },
  statItem: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { fontSize: 24, fontFamily: 'Inter_700Bold' },
  statLabel: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  statSub: { fontSize: 10, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  statDivider: { width: 1, marginVertical: 4 },
  missionCard: {
    borderRadius: 14,
    padding: 16,
    gap: 8,
    marginBottom: 24,
    ...Platform.select({
      ios: { borderCurve: 'continuous' },
    }),
  },
  missionTitle: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  missionText: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 21 },
  sectionLabel: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  card: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 24,
    ...Platform.select({
      ios: { borderCurve: 'continuous' },
    }),
  },
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: 14 },
  linkRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  linkIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  linkLabel: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  copyright: { textAlign: 'center', fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 20, paddingBottom: 8 },
});
