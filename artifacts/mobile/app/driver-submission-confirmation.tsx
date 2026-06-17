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
import { LinearGradient } from 'expo-linear-gradient';
import { AppButton } from '@/components/AppButton';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';
import { isDriverApprovalDevtoolEnabled } from '@/utils/driverDevTools';
import { refreshSession } from '@/services/api';

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
  const { driverProfile, switchMode, saveDriverProfile, loadDriverProfile } = useAuth();

  const cardFill = isDark ? '#1C1C1E' : '#FFFFFF';
  const pageBackground = isDark ? '#000000' : '#F2F2F7';
  const separatorColor = isDark ? 'rgba(84,84,88,0.65)' : 'rgba(60,60,67,0.29)';
  const blue = colors.primaryHex;

  const iconScale = useRef(new Animated.Value(0.4)).current;
  const iconOpacity = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentSlide = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(iconScale, { toValue: 1, useNativeDriver: true, bounciness: 14 }),
        Animated.timing(iconOpacity, { toValue: 1, duration: 280, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(contentOpacity, { toValue: 1, duration: 320, useNativeDriver: true }),
        Animated.spring(contentSlide, { toValue: 0, useNativeDriver: true, bounciness: 4 }),
      ]),
    ]).start();
  }, []);

  const isRejected = driverProfile?.verificationStatus === 'rejected';
  const isApproved = driverProfile?.verificationStatus === 'approved';
  const showApprovalDevtool = isDriverApprovalDevtoolEnabled(
    __DEV__,
    process.env.EXPO_PUBLIC_ENABLE_DRIVER_APPROVAL_DEVTOOLS,
  );

  // Auto-sync approval from the backend so this screen flips to "approved" on its
  // own — no manual refresh. The login token is still CUSTOMER_ONLY after apply/
  // approve (so GET /driver/profile would 403), so we refresh the token FIRST to
  // sync the role (→ DRIVER_PENDING/ACTIVE), then poll while still pending.
  useEffect(() => {
    if (isApproved || isRejected) return;
    let cancelled = false;
    void refreshSession()
      .catch(() => {})
      .finally(() => { if (!cancelled) void loadDriverProfile(); });
    const id = setInterval(() => { if (!cancelled) void loadDriverProfile(); }, 8000);
    return () => { cancelled = true; clearInterval(id); };
  }, [isApproved, isRejected, loadDriverProfile]);

  // Once approved, refresh the token so role_state becomes DRIVER_ACTIVE —
  // otherwise driver-only endpoints (go online, post location) keep 403ing with
  // the stale DRIVER_PENDING token issued at login.
  useEffect(() => {
    if (isApproved) void refreshSession();
  }, [isApproved]);

  const handlePrimaryAction = async () => {
    if (isApproved) {
      await switchMode('driver');
      router.replace('/(driver)');
      return;
    }
    router.push('/driver-onboarding');
  };

  const handleDevApprove = async () => {
    if (!driverProfile) return;
    await saveDriverProfile({ ...driverProfile, verificationStatus: 'approved', isVerified: true });
    await switchMode('driver');
    router.replace('/(driver)');
  };

  return (
    <View style={[styles.root, { backgroundColor: pageBackground, paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}>

      {/* ── Hero ── */}
      <LinearGradient
        colors={isDark ? [`${blue}20`, `${blue}06`, 'transparent'] : [`${blue}14`, `${blue}04`, 'transparent']}
        style={styles.hero}
      >
        <Animated.View style={{ transform: [{ scale: iconScale }], opacity: iconOpacity }}>
          <View style={[styles.iconRing, { borderColor: `${blue}28` }]}>
            <View style={[styles.iconCircle, { backgroundColor: `${blue}18` }]}>
              <Feather name="check-circle" size={42} color={colors.primary} />
            </View>
          </View>
        </Animated.View>

        <Animated.View style={[styles.heroText, { opacity: contentOpacity, transform: [{ translateY: contentSlide }] }]}>
          <Text style={[styles.heroTitle, { color: colors.foreground }]}>Application Submitted!</Text>
          <Text style={[styles.heroSub, { color: colors.mutedForeground }]}>
           Your application has been received successfully. </Text>
        </Animated.View>
      </LinearGradient>

      {/* ── Body ── */}
      <Animated.View style={[styles.body, { opacity: contentOpacity, transform: [{ translateY: contentSlide }] }]}>

        {/* Status chip */}
        <View style={[styles.statusChip, { backgroundColor: `${blue}12`, borderColor: `${blue}30` }]}>
          <View style={[styles.statusDot, { backgroundColor: colors.primary }]} />
          <Text style={[styles.statusText, { color: colors.primary }]}>Application under review</Text>
        </View>

        {/* Timeline card */}
        <View style={[styles.card, { backgroundColor: cardFill }]}>
          <Text style={[styles.cardHeading, { color: colors.foreground }]}>What happens next</Text>
          <View style={[styles.divider, { backgroundColor: separatorColor }]} />
          {STEPS.map((step, i) => (
            <View key={step.label}>
              <View style={styles.timelineRow}>
                <View style={styles.timelineLeft}>
                  <View style={[
                    styles.timelineDot,
                    {
                      backgroundColor: step.done ? blue : step.active ? `${blue}20` : isDark ? '#2C2C2E' : '#E5E5EA',
                      borderColor: step.done || step.active ? blue : 'transparent',
                      borderWidth: step.active ? 2 : 0,
                    },
                  ]}>
                    {step.done
                      ? <Feather name="check" size={12} color="#fff" />
                      : step.active
                        ? <View style={[styles.activePulse, { backgroundColor: colors.primary }]} />
                        : null}
                  </View>
                  {i < STEPS.length - 1 && (
                    <View style={[styles.timelineLine, { backgroundColor: i === 0 ? blue : separatorColor }]} />
                  )}
                </View>
                <View style={styles.timelineContent}>
                  <Text style={[styles.timelineLabel, { color: step.done || step.active ? colors.foreground : colors.mutedForeground }]}>
                    {step.label}
                  </Text>
                  <Text style={[styles.timelineDesc, { color: colors.mutedForeground }]}>{step.desc}</Text>
                </View>
                <Feather name={step.icon} size={17} color={step.done || step.active ? colors.primary : colors.mutedForeground} />
              </View>
              {i < STEPS.length - 1 && <View style={[styles.divider, { backgroundColor: separatorColor, marginLeft: 52 }]} />}
            </View>
          ))}
        </View>

        {/* Rejection feedback */}
        {isRejected && driverProfile?.rejectionReason && (
          <View style={[styles.card, { backgroundColor: cardFill }]}>
            <View style={styles.rejectionHeader}>
              <Feather name="alert-circle" size={15} color={colors.destructive} />
              <Text style={[styles.cardHeading, { color: colors.destructive, paddingVertical: 0 }]}>Reviewer Feedback</Text>
            </View>
            <View style={[styles.divider, { backgroundColor: separatorColor }]} />
            <Text style={[styles.rejectionText, { color: colors.foreground }]}>{driverProfile.rejectionReason}</Text>
          </View>
        )}

      </Animated.View>

      {/* ── Actions pinned to bottom ── */}
      <Animated.View style={[styles.actions, { opacity: contentOpacity }]}>
        {(isApproved || isRejected) && (
          <AppButton
            title={isApproved ? 'Open Driver Mode' : 'Update Application'}
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
  root: { flex: 1 },
  hero: {
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingTop: 36,
    paddingBottom: 24,
    gap: 18,
  },
  iconRing: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroText: { alignItems: 'center', gap: 8 },
  heroTitle: { fontSize: 24, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  heroSub: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 21, textAlign: 'center', maxWidth: 300 },
  body: { flex: 1, paddingHorizontal: 16, gap: 12 },
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
  actions: { paddingHorizontal: 16, gap: 10 },
  supportBtn: { height: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  supportText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  devBtn: { height: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderRadius: 10, borderStyle: 'dashed' },
  devText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
});
