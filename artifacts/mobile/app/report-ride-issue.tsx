import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Alert, Linking, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassHeader, useGlassHeaderMetrics } from '@/components/GlassHeader';
import { GlassScrollView } from '@/components/GlassScrollView';
import { APP_NAME, SAFETY_EMAIL, SUPPORT_EMAIL } from '@/constants/branding';
import { useColors } from '@/hooks/useColors';
import { useToast } from '@/context/ToastContext';
import { submitSupportTicket } from '@/services/support';

const REPORT_TYPES = [
  {
    detail: 'Report disrespectful, unsafe, or inappropriate conduct.',
    email: SAFETY_EMAIL,
    icon: 'user-x' as const,
    label: 'Driver Behavior',
    ticketType: 'DRIVER_BEHAVIOR',
  },
  {
    detail: 'Get help finding something left behind after a trip.',
    email: SUPPORT_EMAIL,
    icon: 'briefcase' as const,
    label: 'Lost Item',
    ticketType: 'LOST_ITEM',
  },
  {
    detail: 'Tell us about a fare, cash, or Mobile Money concern.',
    email: SUPPORT_EMAIL,
    icon: 'credit-card' as const,
    label: 'Fare or Payment Issue',
    ticketType: 'PAYMENT',
  },
  {
    detail: 'Report a serious concern about your safety during a trip.',
    email: SAFETY_EMAIL,
    icon: 'shield' as const,
    label: 'Safety Concern',
    ticketType: 'SAFETY',
  },
  {
    detail: 'Share another issue connected to a recent ride.',
    email: SUPPORT_EMAIL,
    icon: 'message-circle' as const,
    label: 'Other Ride Issue',
    ticketType: 'OTHER',
  },
];

export default function ReportRideIssueScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const headerMetrics = useGlassHeaderMetrics();
  const { showToast } = useToast();
  const [submitting, setSubmitting] = useState<string | null>(null);

  const sendEmail = (label: string, email: string) => {
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

  const openReport = async (label: string, email: string, ticketType: string) => {
    setSubmitting(label);
    try {
      await submitSupportTicket({
        subject: `${APP_NAME} ride issue: ${label}`,
        type: ticketType,
      });
      setSubmitting(null);
      showToast('Report submitted — our team will review it', 'info');
      return;
    } catch {
      setSubmitting(null);
      Alert.alert(
        'Could not submit report',
        'We couldn\'t reach our servers. Would you like to send your report via email instead?',
        [
          { text: 'Send Email', onPress: () => sendEmail(label, email) },
          { text: 'Cancel', style: 'cancel' },
        ],
      );
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <GlassHeader title="Report a Ride Issue" subtitle="Tell us what happened" />
      <GlassScrollView
        indicatorTop={headerMetrics.indicatorTop}
        contentContainerStyle={{
          paddingTop: headerMetrics.contentTop,
          paddingBottom: insets.bottom + 36,
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
                  disabled={submitting === report.label}
                  onPress={() => openReport(report.label, report.email, report.ticketType)}
                  style={styles.row}
                >
                  <View style={styles.icon}>
                    <Feather name={report.icon} size={20} color={colors.foreground} />
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
  intro: { maxWidth: 320, fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 19, textAlign: 'center' },
  centeredContent: { flex: 1, justifyContent: 'center' },
  card: {
    borderRadius: 14,
    overflow: 'hidden',
    ...Platform.select({ ios: { borderCurve: 'continuous' } }),
  },
  row: { minHeight: 76, paddingHorizontal: 16, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', gap: 13 },
  icon: { width: 28, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: 3 },
  label: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  detail: { fontSize: 11, fontFamily: 'Inter_400Regular', lineHeight: 16 },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 57 },
  safetyNoteWrap: { alignItems: 'center', paddingHorizontal: 28, paddingTop: 16 },
  safetyNote: { maxWidth: 300, fontSize: 11, fontFamily: 'Inter_400Regular', lineHeight: 16, textAlign: 'center' },
});
