import React from 'react';
import {
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { GlassHeader, useGlassHeaderMetrics } from '@/components/GlassHeader';
import { GlassScrollView } from '@/components/GlassScrollView';
import { useColors } from '@/hooks/useColors';

const SECTIONS = [
  {
    title: 'Data We Collect',
    icon: 'database' as const,
    items: [
      'Location (during active rides and when the app is open)',
      'Phone number and name (for your account)',
      'Ride history and fare details',
      'Device identifiers for push notifications',
    ],
  },
  {
    title: 'How We Use Your Data',
    icon: 'settings' as const,
    items: [
      'Match you with nearby drivers',
      'Calculate route and estimated fare',
      'Improve app performance and safety',
      'Send ride status notifications',
    ],
  },
  {
    title: 'Data Sharing',
    icon: 'share-2' as const,
    items: [
      'Your name and pickup location are shared with your matched driver only',
      'We never sell your data to third parties',
      'Anonymised ride data may be used for route optimisation',
    ],
  },
  {
    title: 'Your Rights',
    icon: 'shield' as const,
    items: [
      'Request a copy of your data at any time',
      'Delete your account and all data from your profile',
      'Opt out of marketing communications',
      'Contact us at privacy@taravelis.rw',
    ],
  },
];

export default function PrivacySecurityScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const headerMetrics = useGlassHeaderMetrics();

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <GlassHeader title="Privacy & Security" />

      <GlassScrollView
        indicatorTop={headerMetrics.indicatorTop}
        contentContainerStyle={[styles.scroll, { paddingTop: headerMetrics.contentTop, paddingBottom: insets.bottom + 32 }]}
      >
        {/* Shield banner */}
        <View style={[styles.banner, { backgroundColor: colors.primaryHex + '12', borderColor: colors.primaryHex + '30' }]}>
          <Feather name="shield" size={28} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.bannerTitle, { color: colors.primary }]}>Your data is protected</Text>
            <Text style={[styles.bannerDesc, { color: colors.mutedForeground }]}>
              Taravelis is GDPR-aligned and complies with Rwanda's data protection law.
            </Text>
          </View>
        </View>

        {SECTIONS.map(section => (
          <View key={section.title} style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIcon}>
                <Feather name={section.icon} size={16} color={colors.foreground} />
              </View>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{section.title}</Text>
            </View>
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {section.items.map((item, i) => (
                <View key={i} style={styles.itemRow}>
                  <View style={[styles.bullet, { backgroundColor: colors.primary }]} />
                  <Text style={[styles.itemText, { color: colors.mutedForeground }]}>{item}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}

        {/* Links */}
        <TouchableOpacity
          style={[styles.linkRow, { borderColor: colors.border }]}
          onPress={() => Linking.openURL('https://taravelis.rw/privacy')}
          activeOpacity={0.75}
        >
          <Feather name="external-link" size={16} color={colors.primary} />
          <Text style={[styles.linkText, { color: colors.primary }]}>Read full Privacy Policy</Text>
        </TouchableOpacity>

        <Text style={[styles.lastUpdated, { color: colors.mutedForeground }]}>
          Last updated: May 2026 · Version 1.0
        </Text>
      </GlassScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: 20, gap: 0 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 8,
  },
  bannerTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold', marginBottom: 2 },
  bannerDesc: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  section: { marginTop: 24 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  sectionIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  card: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 12 },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  bullet: { width: 6, height: 6, borderRadius: 3, marginTop: 7 },
  itemText: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 20 },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 28,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  linkText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  lastUpdated: { textAlign: 'center', fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 16 },
});
