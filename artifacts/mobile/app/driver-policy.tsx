import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { KandaButton } from '@/components/KandaButton';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { DriverProfile } from '@/types';

const POLICIES = [
  {
    id: 'terms',
    title: 'Driver Terms & Conditions',
    summary: 'You agree to provide safe, professional ride services on the Taravelis platform. You understand that Taravelis connects drivers with customers and maintains a 15% platform commission on all completed rides.',
  },
  {
    id: 'safety',
    title: 'Safety Policy',
    summary: 'You must maintain your vehicle in roadworthy condition. You agree to follow all traffic laws in Rwanda. Reckless driving, DUI, or endangering passengers will result in immediate account suspension.',
  },
  {
    id: 'commission',
    title: 'Platform Commission Policy',
    summary: 'Taravelis charges a 15% commission on all agreed fares. Payments are processed via Mobile Money (MoMo) within 24 hours of ride completion. Commission rates may be revised with 30 days notice.',
  },
  {
    id: 'conduct',
    title: 'Ride Conduct Policy',
    summary: 'Maintain professional conduct at all times. Do not engage in harassment, discrimination, or offensive behavior. Honor agreed fares. Declining more than 10 rides per day will reduce your priority ranking.',
  },
  {
    id: 'privacy',
    title: 'Privacy Policy',
    summary: 'Taravelis collects location data to match drivers with customers and improve service. Your personal data is stored securely and not shared with third parties without consent, except as required by law.',
  },
];

export default function DriverPolicyScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, saveDriverProfile, switchMode } = useAuth();
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>('terms');
  const [loading, setLoading] = useState(false);

  const allAccepted = POLICIES.every(p => accepted.has(p.id));

  const toggleAccept = (id: string) => {
    setAccepted(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleActivate = async () => {
    setLoading(true);
    const profile: DriverProfile = {
      vehicleType: 'moto',
      plateNumber: 'RAC 000 A',
      licenseNumber: 'DL-0000000',
      city: 'Kigali',
      momoCode: '250700000000',
      dob: '01/01/1990',
      isOnline: false,
      isVerified: true,
      acceptanceRate: 100,
      completedRides: 0,
      dailyRides: 0,
      dailyDeclines: 0,
      policyAccepted: true,
      policyAcceptedAt: new Date().toISOString(),
      earningsTotal: 0,
    };
    await saveDriverProfile(profile);
    await switchMode('driver');
    setLoading(false);
    router.replace('/(driver)/');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 0) + 16,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Policy Agreement</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.intro, { color: colors.mutedForeground }]}>
          Please read and accept all policies to activate your driver account.
        </Text>

        {POLICIES.map(policy => (
          <View key={policy.id} style={[styles.policyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TouchableOpacity
              style={styles.policyHeader}
              onPress={() => setExpanded(expanded === policy.id ? null : policy.id)}
            >
              <View style={styles.policyLeft}>
                <View
                  style={[
                    styles.checkbox,
                    {
                      backgroundColor: accepted.has(policy.id) ? colors.primary : 'transparent',
                      borderColor: accepted.has(policy.id) ? colors.primary : colors.border,
                    },
                  ]}
                >
                  {accepted.has(policy.id) && (
                    <Feather name="check" size={12} color={colors.primaryForeground} />
                  )}
                </View>
                <Text style={[styles.policyTitle, { color: colors.foreground }]}>{policy.title}</Text>
              </View>
              <Feather
                name={expanded === policy.id ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={colors.mutedForeground}
              />
            </TouchableOpacity>

            {expanded === policy.id && (
              <View style={styles.policyBody}>
                <View style={[styles.policyDivider, { backgroundColor: colors.border }]} />
                <Text style={[styles.policyText, { color: colors.mutedForeground }]}>{policy.summary}</Text>
                <TouchableOpacity
                  style={[
                    styles.acceptBtn,
                    {
                      backgroundColor: accepted.has(policy.id) ? colors.primary + '20' : colors.primary,
                    },
                  ]}
                  onPress={() => toggleAccept(policy.id)}
                >
                  <Text style={[
                    styles.acceptBtnText,
                    { color: accepted.has(policy.id) ? colors.primary : colors.primaryForeground },
                  ]}>
                    {accepted.has(policy.id) ? '✓ Accepted' : 'I Accept'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))}

        {/* Progress */}
        <View style={styles.progressRow}>
          <View style={[styles.progressBar, { backgroundColor: colors.muted }]}>
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor: colors.primary,
                  width: `${(accepted.size / POLICIES.length) * 100}%`,
                },
              ]}
            />
          </View>
          <Text style={[styles.progressText, { color: colors.mutedForeground }]}>
            {accepted.size}/{POLICIES.length} accepted
          </Text>
        </View>

        <KandaButton
          title="Activate Driver Account"
          onPress={handleActivate}
          fullWidth
          size="lg"
          disabled={!allAccepted}
          loading={loading}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 18, fontFamily: 'Inter_600SemiBold' },
  content: { padding: 20, gap: 14, paddingBottom: 40 },
  intro: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 22 },
  policyCard: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  policyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  policyLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  policyTitle: { flex: 1, fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  policyBody: { paddingHorizontal: 14, paddingBottom: 14, gap: 12 },
  policyDivider: { height: 1 },
  policyText: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 20 },
  acceptBtn: {
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  progressRow: { gap: 8 },
  progressBar: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  progressText: { fontSize: 12, fontFamily: 'Inter_400Regular', textAlign: 'right' },
});
