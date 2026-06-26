import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Linking, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassHeader, useGlassHeaderMetrics } from '@/components/GlassHeader';
import { GlassScrollView } from '@/components/GlassScrollView';
import { APP_NAME, SAFETY_EMAIL, SUPPORT_EMAIL } from '@/constants/branding';
import { FORM_BOTTOM_PADDING } from '@/constants/tabBar';
import { useColors } from '@/hooks/useColors';
import { typography } from '@/constants/typography';

const REPORT_TYPES = [
  {
    detail: 'Report disrespectful, unsafe, or inappropriate conduct.',
    email: SAFETY_EMAIL,
    icon: 'user-x' as const,
    label: 'Driver Behavior',
  },
  {
    detail: 'Get help finding something left behind after a trip.',
    email: SUPPORT_EMAIL,
    icon: 'briefcase' as const,
    label: 'Lost Item',
  },
  {
    detail: 'Tell us about a fare, cash, or Mobile Money concern.',
    email: SUPPORT_EMAIL,
    icon: 'credit-card' as const,
    label: 'Fare or Payment Issue',
  },
  {
    detail: 'Report a serious concern about your safety during a trip.',
    email: SAFETY_EMAIL,
    icon: 'shield' as const,
    label: 'Safety Concern',
  },
  {
    detail: 'Share another issue connected to a recent ride.',
    email: SUPPORT_EMAIL,
    icon: 'message-circle' as const,
    label: 'Other Ride Issue',
  },
];

export default function ReportRideIssueScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const headerMetrics = useGlassHeaderMetrics();

  const openReport = (label: string, email: string) => {
    const subject = `${APP_NAME} ride issue: ${label}`;
    const body = [
      `Hi ${APP_NAME} support,`,
      '',
      `I need help with: ${label}`,
      '',
      'Trip date and time:',
      'Driver name (if known):',
      'Pickup and destination:',
      'What happened:',
    ].join('\n');
    void Linking.openURL(`mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <GlassHeader title="Report a Ride Issue" subtitle="Tell us what happened" />
      <GlassScrollView
        indicatorTop={headerMetrics.indicatorTop}
        contentContainerStyle={{
          paddingTop: headerMetrics.contentTop,
          paddingBottom: insets.bottom + FORM_BOTTOM_PADDING,
          paddingHorizontal: 16,
          flexGrow: 1,
        }}
      >
        <View style={styles.introWrap}>
          <Text style={[styles.intro, { color: colors.mutedForeground }]}>
            Choose the option that best matches your concern. Including trip details helps our team respond faster.
          </Text>
        </View>

        <View style={styles.centeredContent}>
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            {REPORT_TYPES.map((report, index) => (
              <React.Fragment key={report.label}>
                {index > 0 ? <View style={[styles.divider, { backgroundColor: colors.border }]} /> : null}
                <TouchableOpacity
                  accessibilityLabel={report.label}
                  accessibilityRole="button"
                  activeOpacity={0.65}
                  onPress={() => openReport(report.label, report.email)}
                  style={styles.row}
                >
                  <View style={styles.icon}>
                    <Feather name={report.icon} size={20} color={colors.primary} />
                  </View>
                  <View style={styles.copy}>
                    <Text style={[styles.label, { color: colors.foreground }]}>{report.label}</Text>
                    <Text style={[styles.detail, { color: colors.mutedForeground }]}>{report.detail}</Text>
                  </View>
                  <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
                </TouchableOpacity>
              </React.Fragment>
            ))}
          </View>
        </View>

        <View style={styles.safetyNoteWrap}>
          <Text style={[styles.safetyNote, { color: colors.mutedForeground }]}>
            For an immediate emergency, contact local emergency services first.
          </Text>
        </View>
      </GlassScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  introWrap: { alignItems: 'center', paddingHorizontal: 20, marginBottom: 18 },
  intro: { maxWidth: 320, ...typography.label, fontFamily: typography.body.fontFamily, lineHeight: 19, textAlign: 'center' },
  centeredContent: { flex: 1, justifyContent: 'center' },
  card: {
    borderRadius: 14,
    overflow: 'hidden',
    ...Platform.select({ ios: { borderCurve: 'continuous' } }),
  },
  row: { minHeight: 76, paddingHorizontal: 16, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', gap: 13 },
  icon: { width: 28, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: 3 },
  label: { ...typography.body, fontFamily: typography.title.fontFamily},
  detail: { ...typography.tiny, fontFamily: typography.body.fontFamily, lineHeight: 16 },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 57 },
  safetyNoteWrap: { alignItems: 'center', paddingHorizontal: 28, paddingTop: 16 },
  safetyNote: { maxWidth: 300, ...typography.tiny, fontFamily: typography.body.fontFamily, lineHeight: 16, textAlign: 'center' },
});
