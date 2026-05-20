import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
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
import { KandaInput } from '@/components/KandaInput';
import { VehicleCard } from '@/components/VehicleCard';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { DriverProfile, VehicleType } from '@/types';

const CITIES = ['Kigali', 'Musanze', 'Rubavu', 'Huye', 'Nyagatare', 'Rusizi'];

export default function DriverOnboarding() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, saveDriverProfile, switchMode } = useAuth();

  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    vehicleType: 'moto' as VehicleType,
    plateNumber: '',
    licenseNumber: '',
    city: 'Kigali',
    momoCode: '',
    dob: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const update = (field: string, val: string) => {
    setForm(f => ({ ...f, [field]: val }));
    setErrors(e => ({ ...e, [field]: '' }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (step === 0) {
      if (!form.dob) e.dob = 'Required';
    }
    if (step === 1) {
      if (!form.plateNumber) e.plateNumber = 'Required';
      if (!form.licenseNumber) e.licenseNumber = 'Required';
    }
    if (step === 2) {
      if (!form.momoCode) e.momoCode = 'Required';
    }
    return e;
  };

  const handleNext = () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    if (step < 2) { setStep(s => s + 1); return; }
    // Step 2 done → go to policy
    router.push('/driver-policy');
  };

  const steps = ['Personal Info', 'Vehicle Info', 'Payment'];

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
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
        <TouchableOpacity onPress={() => step > 0 ? setStep(s => s - 1) : router.back()}>
          <Feather name="arrow-left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Become a Driver</Text>
        <Text style={[styles.stepIndicator, { color: colors.mutedForeground }]}>{step + 1}/3</Text>
      </View>

      {/* Step indicators */}
      <View style={styles.steps}>
        {steps.map((s, i) => (
          <View key={i} style={[styles.stepItem, { flex: 1 }]}>
            <View
              style={[
                styles.stepDot,
                { backgroundColor: i <= step ? colors.primary : colors.border },
              ]}
            />
            <Text style={[styles.stepLabel, { color: i <= step ? colors.primary : colors.mutedForeground }]}>
              {s}
            </Text>
          </View>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {step === 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Personal Information</Text>
            <Text style={[styles.sectionDesc, { color: colors.mutedForeground }]}>
              Details pre-filled from your account
            </Text>

            <View style={[styles.infoRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Full Name</Text>
              <Text style={[styles.infoValue, { color: colors.foreground }]}>{user?.name}</Text>
            </View>
            <View style={[styles.infoRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Phone</Text>
              <Text style={[styles.infoValue, { color: colors.foreground }]}>{user?.phone}</Text>
            </View>

            <KandaInput
              label="Date of Birth"
              placeholder="DD/MM/YYYY"
              value={form.dob}
              onChangeText={t => update('dob', t)}
              error={errors.dob}
              leftIcon="calendar"
              keyboardType="number-pad"
            />

            <Text style={[styles.label, { color: colors.mutedForeground }]}>City</Text>
            <View style={styles.cityGrid}>
              {CITIES.map(c => (
                <TouchableOpacity
                  key={c}
                  style={[
                    styles.cityChip,
                    {
                      backgroundColor: form.city === c ? colors.primary : colors.muted,
                      borderColor: form.city === c ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => update('city', c)}
                >
                  <Text style={[styles.cityText, { color: form.city === c ? colors.primaryForeground : colors.foreground }]}>
                    {c}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {step === 1 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Vehicle Information</Text>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Vehicle Type</Text>
            {(['moto', 'cab', 'hilux', 'fuso'] as VehicleType[]).map(v => (
              <VehicleCard
                key={v}
                type={v}
                selected={form.vehicleType === v}
                onSelect={() => update('vehicleType', v)}
              />
            ))}
            <KandaInput
              label="Plate Number"
              placeholder="RAC 000 A"
              value={form.plateNumber}
              onChangeText={t => update('plateNumber', t)}
              error={errors.plateNumber}
              leftIcon="hash"
              autoCapitalize="characters"
            />
            <KandaInput
              label="Driver License Number"
              placeholder="DL-0000000"
              value={form.licenseNumber}
              onChangeText={t => update('licenseNumber', t)}
              error={errors.licenseNumber}
              leftIcon="credit-card"
              autoCapitalize="characters"
            />
          </View>
        )}

        {step === 2 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Payment Setup</Text>
            <Text style={[styles.sectionDesc, { color: colors.mutedForeground }]}>
              Your earnings will be sent to your MoMo account
            </Text>
            <View style={[styles.momoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={{ fontSize: 32 }}>📱</Text>
              <Text style={[styles.momoTitle, { color: colors.foreground }]}>MTN Mobile Money</Text>
            </View>
            <KandaInput
              label="MoMo Pay Code"
              placeholder="250XXXXXXXXX"
              value={form.momoCode}
              onChangeText={t => update('momoCode', t)}
              error={errors.momoCode}
              leftIcon="smartphone"
              keyboardType="phone-pad"
            />
            <View style={[styles.notice, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '30' }]}>
              <Feather name="info" size={14} color={colors.primary} />
              <Text style={[styles.noticeText, { color: colors.primary }]}>
                Earnings are processed after each completed ride. Platform commission: 15%
              </Text>
            </View>
          </View>
        )}

        <KandaButton
          title={step < 2 ? 'Continue' : 'Review Policies'}
          onPress={handleNext}
          fullWidth
          size="lg"
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 18, fontFamily: 'Inter_600SemiBold' },
  stepIndicator: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  steps: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 0,
  },
  stepItem: { alignItems: 'center', gap: 4 },
  stepDot: { width: 8, height: 8, borderRadius: 4 },
  stepLabel: { fontSize: 10, fontFamily: 'Inter_500Medium' },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  section: { gap: 14 },
  sectionTitle: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  sectionDesc: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  infoLabel: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  infoValue: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  label: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  cityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cityChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 100,
    borderWidth: 1,
  },
  cityText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  momoCard: {
    alignItems: 'center',
    gap: 8,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
  },
  momoTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  notice: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'flex-start',
  },
  noticeText: { flex: 1, fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 18 },
});
