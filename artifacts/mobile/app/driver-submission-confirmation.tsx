import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppButton } from '@/components/AppButton';
import { DriverApplicationRejectionBanner } from '@/components/driver-onboarding/DriverApplicationRejectionBanner';
import { FORM_BOTTOM_PADDING } from '@/constants/tabBar';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';
import { getLatestDriverApplicationRejectionSummary, type DriverApplicationRejectionSummary } from '@/domain/verificationSubmissions';
import { isDriverApprovalDevtoolEnabled } from '@/utils/driverDevTools';

const STEPS = [
  {
    icon: 'upload-cloud' as const,
    label: 'Application received',
    desc: 'Your documents and details are safely submitted.',
    done: true,
  },
  {
    icon: 'search' as const,
    label: 'Under review',
    desc: 'Our verification team is reviewing your information and documents.',
    done: false,
    active: true,
  },
  {
    icon: 'check-circle' as const,
    label: 'Approved & ready',
    desc: "You'll receive a notification once your application has been approved or if additional information is required.",
    done: false,
  },
];

export default function DriverSubmissionConfirmation() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() === 'dark';
  const { driverProfile, switchMode, saveDriverProfile, user } = useAuth();
  const [rejectionSummary, setRejectionSummary] = React.useState<DriverApplicationRejectionSummary | null>(null);

  const pageBackground = isDark ? '#000000' : '#F2F2F7';
  const cardFill = isDark ? '#1C1C1E' : '#FFFFFF';
  const separatorColor = isDark ? 'rgba(84,84,88,0.65)' : 'rgba(60,60,67,0.29)';
  const accent = colors.primaryHex;
  const accentSoft = `${accent}18`;
  const accentSoftStrong = `${accent}20`;
  const accentBorder = `${accent}28`;
  const titleColor = colors.foreground;
  const bodyColor = colors.mutedForeground;
  const mutedColor = colors.mutedForeground;

  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentSlide = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(contentOpacity, { toValue: 1, duration: 320, useNativeDriver: true }),
        Animated.spring(contentSlide, { toValue: 0, useNativeDriver: true, bounciness: 4 }),
      ]),
    ]).start();
  }, []);

  const isRejected = driverProfile?.verificationStatus === 'rejected';
  const isApproved = driverProfile?.verificationStatus === 'approved';
  const timelineSteps = isApproved
    ? STEPS.map(step => ({ ...step, done: true, active: false }))
    : STEPS;
  const showApprovalDevtool = isDriverApprovalDevtoolEnabled(
    __DEV__,
    process.env.EXPO_PUBLIC_ENABLE_DRIVER_APPROVAL_DEVTOOLS,
  );

  useEffect(() => {
    if (!isRejected || !user?.id) {
      setRejectionSummary(null);
      return;
    }

    void (async () => {
      const summary = await getLatestDriverApplicationRejectionSummary(user.id);
      setRejectionSummary(summary);
    })();
  }, [isRejected, user?.id]);

  const handlePrimaryAction = async () => {
    if (isApproved) {
      if (driverProfile && !driverProfile.driverApprovalAcknowledgedAt) {
        await saveDriverProfile({ ...driverProfile, driverApprovalAcknowledgedAt: new Date().toISOString() });
      }
      await switchMode('driver');
      router.replace('/(driver)');
      return;
    }
    router.push('/driver-onboarding');
  };

  const handleDevApprove = async () => {
    if (!driverProfile) return;
    await saveDriverProfile({ ...driverProfile, verificationStatus: 'approved', isVerified: true, driverApprovalAcknowledgedAt: new Date().toISOString() });
    await switchMode('driver');
    router.replace('/(driver)');
  };

  return (
    <View style={[styles.root, { backgroundColor: pageBackground, paddingTop: insets.top, paddingBottom: insets.bottom + FORM_BOTTOM_PADDING }]}>

      {/* ── Hero ── */}
      <View style={styles.hero}>
        <Animated.View style={[styles.heroText, { opacity: contentOpacity, transform: [{ translateY: contentSlide }] }]}>
          <Text style={[styles.heroTitle, { color: titleColor }]}>
            {isApproved ? 'Application Approved!' : 'Application Submitted!'}
          </Text>
          <Text style={[styles.heroSub, { color: bodyColor }]}>
            {isApproved
              ? 'Your application is approved. Continue to driver mode to start driving.'
              : 'Your application has been received successfully.'}
          </Text>
        </Animated.View>
      </View>

      {/* ── Body ── */}
      <Animated.View style={[styles.body, { opacity: contentOpacity, transform: [{ translateY: contentSlide }] }]}>

        {/* Status chip */}
        <View style={[styles.statusChip, { backgroundColor: accentSoftStrong, borderColor: accentBorder }]}>
          <View style={[styles.statusDot, { backgroundColor: accent }]} />
          <Text style={[styles.statusText, { color: accent }]}>
            {isApproved ? 'Application approved' : 'Application under review'}
          </Text>
        </View>

        {/* Timeline card */}
        <View style={[styles.card, { backgroundColor: cardFill }]}>
          <Text style={[styles.cardHeading, { color: titleColor }]}>What happens next</Text>
          <View style={[styles.divider, { backgroundColor: separatorColor }]} />
          {timelineSteps.map((step, i) => (
            <View key={step.label}>
              <View style={styles.timelineRow}>
                <View style={styles.timelineLeft}>
                  <View style={[
                    styles.timelineDot,
                    {
                      backgroundColor: step.done ? accent : step.active ? accentSoftStrong : isDark ? '#2C2C2E' : '#E5E5EA',
                      borderColor: step.done || step.active ? accent : 'transparent',
                      borderWidth: step.active ? 2 : 0,
                    },
                  ]}>
                    {step.done
                      ? <Feather name="check" size={12} color="#fff" />
                      : step.active
                        ? <View style={[styles.activePulse, { backgroundColor: accent }]} />
                        : null}
                  </View>
                  {i < STEPS.length - 1 && (
                    <View style={[styles.timelineLine, { backgroundColor: i === 0 ? accent : separatorColor }]} />
                  )}
                </View>
                <View style={styles.timelineContent}>
                  <Text style={[styles.timelineLabel, { color: step.done || step.active ? titleColor : mutedColor }]}>
                    {step.label}
                  </Text>
                  <Text style={[styles.timelineDesc, { color: bodyColor }]}>{step.desc}</Text>
                </View>
                <Feather name={step.icon} size={17} color={step.done || step.active ? accent : mutedColor} />
              </View>
              {i < STEPS.length - 1 && <View style={[styles.divider, { backgroundColor: separatorColor, marginLeft: 52 }]} />}
            </View>
          ))}
        </View>

        {/* Rejection feedback */}
        {isRejected && (
          <DriverApplicationRejectionBanner
            colors={colors}
            rejectionReason={driverProfile.rejectionReason}
            rejectionSummary={rejectionSummary}
          />
        )}

      </Animated.View>

      {/* ── Actions pinned to bottom ── */}
      <Animated.View style={[styles.actions, { opacity: contentOpacity }]}>
        {(isApproved || isRejected) && (
          <AppButton
            title={isApproved ? 'Continue to driver mode' : 'Update Application'}
            onPress={handlePrimaryAction}
            fullWidth
            size="lg"
          />
        )}
        <AppButton
          title="Return to Home"
          onPress={() => router.replace('/(tabs)')}
          fullWidth
          size="lg"
          variant="secondary"
        />
        <TouchableOpacity style={styles.supportBtn} onPress={() => router.push('/help-support')} activeOpacity={0.6}>
          <Feather name="help-circle" size={16} color={colors.primary} />
          <Text style={[styles.supportText, { color: colors.primary }]}>Contact Support</Text>
        </TouchableOpacity>
        {showApprovalDevtool && (
          <TouchableOpacity style={[styles.devBtn, { borderColor: colors.border }]} onPress={handleDevApprove} activeOpacity={0.6}>
            <Feather name="zap" size={14} color={colors.mutedForeground} />
            <Text style={[styles.devText, { color: colors.mutedForeground }]}>DEV — Approve & Enter Dashboard</Text>
          </TouchableOpacity>
        )}
      </Animated.View>

    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center' },
  hero: {
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingTop: 10,
    paddingBottom: 18,
  },
  heroText: { alignItems: 'center', gap: 8 },
  heroTitle: { fontSize: 24, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  heroSub: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 21, textAlign: 'center', maxWidth: 300 },
  body: { paddingHorizontal: 16, gap: 12 },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  card: {
    borderRadius: 14,
    overflow: 'hidden',
    ...Platform.select({ ios: { borderCurve: 'continuous' } }),
  },
  cardHeading: { fontSize: 14, fontFamily: 'Inter_600SemiBold', paddingHorizontal: 16, paddingVertical: 13 },
  divider: { height: StyleSheet.hairlineWidth },
  timelineRow: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16, paddingVertical: 13, gap: 12 },
  timelineLeft: { alignItems: 'center', width: 24 },
  timelineDot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  activePulse: { width: 8, height: 8, borderRadius: 4 },
  timelineLine: { width: 2, flex: 1, minHeight: 16, marginTop: 4, borderRadius: 1 },
  timelineContent: { flex: 1, gap: 2 },
  timelineLabel: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  timelineDesc: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 17 },
  rejectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 13, paddingBottom: 0 },
  rejectionText: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 20, padding: 16, paddingTop: 10 },
  noticeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    ...Platform.select({ ios: { borderCurve: 'continuous' } }),
  },
  noticeIcon: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  noticeText: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  actions: { paddingHorizontal: 16, gap: 10, paddingTop: 34 },
  supportBtn: { height: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  supportText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  devBtn: { height: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderRadius: 10, borderStyle: 'dashed' },
  devText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
});
