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
import { FORM_BOTTOM_PADDING } from '@/constants/tabBar';
import {
  APP_NAME,
  OSS_URL,
  PRIVACY_URL,
  TERMS_URL,
} from '@/constants/branding';
import { useColors } from '@/hooks/useColors';
import { usePressGuard } from '@/hooks/usePressGuard';
import { typography } from '@/constants/typography';
import { icons } from '@/constants/icons';
import { radius } from '@/constants/radius';
import { sizes } from '@/constants/sizes';
import { spacing, semanticSpacing } from '@/constants/spacing';

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
        contentContainerStyle={[styles.scroll, { paddingTop: headerMetrics.contentTop, paddingBottom: insets.bottom + FORM_BOTTOM_PADDING }]}
      >
        <View style={styles.hero}>
          <View style={[styles.logoMark, { backgroundColor: colors.primary }]}>
            <Feather name="navigation" size={icons.size.xxl} color={colors.primaryForeground} />
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
            <LinkRow key={link.label} index={i} link={link} />
          ))}
        </View>

        <Text style={[styles.copyright, { color: colors.mutedForeground }]}>
          © 2026 {APP_NAME} · Kigali, Rwanda
        </Text>
      </GlassScrollView>
    </View>
  );
}

function LinkRow({ index, link }: { index: number; link: typeof LINKS[number] }) {
  const colors = useColors();
  const guardedPress = usePressGuard(() => Linking.openURL(link.url));
  return (
    <View>
      {index > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
      <TouchableOpacity
        style={styles.linkRow}
        onPress={guardedPress}
        activeOpacity={0.75}
      >
        <View style={styles.linkIcon}>
          <Feather name={link.icon} size={icons.size.lg} color={colors.primary} />
        </View>
        <Text style={[styles.linkLabel, { color: colors.foreground, flex: 1 }]}>{link.label}</Text>
        <Feather name="external-link" size={icons.size.xs} color={colors.mutedForeground} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: semanticSpacing.screenPadding },
  hero: { alignItems: 'center', paddingTop: spacing[32], paddingBottom: spacing[28], gap: semanticSpacing.inlineGap },
  logoMark: {
    width: sizes.avatar.xxl,
    height: sizes.avatar.xxl,
    borderRadius: radius.sheet,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[4],
  },
  appName: { ...typography.h1, fontFamily: typography.badge.fontFamily},
  tagline: { ...typography.bodySmall, fontFamily: typography.body.fontFamily},
  versionBadge: {
    paddingHorizontal: semanticSpacing.listItemPadding,
    paddingVertical: spacing[6],
    borderRadius: radius['3xl'],
    borderWidth: 1,
    marginTop: spacing[4],
  },
  versionText: { ...typography.caption, fontFamily: typography.label.fontFamily},
  statsRow: {
    flexDirection: 'row',
    borderRadius: radius.card,
    padding: semanticSpacing.cardPadding,
    marginBottom: semanticSpacing.comfortableGap,
    ...Platform.select({
      ios: { borderCurve: 'continuous' },
    }),
  },
  statItem: { flex: 1, alignItems: 'center', gap: spacing[2] },
  statValue: { ...typography.h1, fontFamily: typography.badge.fontFamily},
  statLabel: { ...typography.caption, fontFamily: typography.title.fontFamily},
  statSub: { ...typography.tiny, fontFamily: typography.body.fontFamily, textAlign: 'center' },
  statDivider: { width: StyleSheet.hairlineWidth, marginVertical: spacing[4] },
  missionCard: {
    borderRadius: radius.card,
    padding: semanticSpacing.cardPadding,
    gap: semanticSpacing.inlineGap,
    marginBottom: semanticSpacing.sectionGap,
    ...Platform.select({
      ios: { borderCurve: 'continuous' },
    }),
  },
  missionTitle: { ...typography.body, fontFamily: typography.badge.fontFamily},
  missionText: { ...typography.label, fontFamily: typography.body.fontFamily, lineHeight: 21 },
  sectionLabel: {
    ...typography.tiny,
    fontFamily: typography.title.fontFamily,
    letterSpacing: 0.8,
    marginBottom: spacing[10],
  },
  card: {
    borderRadius: radius.card,
    overflow: 'hidden',
    marginBottom: semanticSpacing.sectionGap,
    ...Platform.select({
      ios: { borderCurve: 'continuous' },
    }),
  },
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: semanticSpacing.listItemPadding },
  linkRow: { flexDirection: 'row', alignItems: 'center', padding: semanticSpacing.listItemPadding, gap: semanticSpacing.rowGap },
  linkIcon: { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  linkLabel: { ...typography.bodySmall, fontFamily: typography.body.fontFamily},
  copyright: { textAlign: 'center', ...typography.caption, fontFamily: typography.body.fontFamily, lineHeight: 20, paddingBottom: semanticSpacing.inlineGap },
});
