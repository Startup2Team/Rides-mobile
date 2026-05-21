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
import { KandaButton } from '@/components/KandaButton';
import { KandaInput } from '@/components/KandaInput';
import { useColors } from '@/hooks/useColors';

export default function RegisterScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState({ name: '', phone: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const update = (field: string, val: string) => {
    setForm(f => ({ ...f, [field]: val }));
    setErrors(e => ({ ...e, [field]: '' }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim() || form.name.trim().split(' ').length < 2)
      e.name = 'Enter your full name';
    if (form.phone.replace(/\D/g, '').length < 9)
      e.phone = 'Enter a valid phone number';
    return e;
  };

  const handleContinue = () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    router.push({
      pathname: '/(auth)/otp',
      params: {
        phone: `+250${form.phone.replace(/\D/g, '')}`,
        name: form.name.trim(),
        mode: 'register',
      },
    });
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          {
            paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 20) + 20,
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={[styles.backText, { color: colors.primary }]}>← Back</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.foreground }]}>Create account</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Join Taravelis — Rwanda's fastest ride
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <KandaInput
            label="Full Name"
            placeholder="Jean Pierre Mutabazi"
            value={form.name}
            onChangeText={t => update('name', t)}
            error={errors.name}
            leftIcon="user"
            autoCapitalize="words"
          />

          {/* Phone Number field with label above the whole row */}
          <View style={styles.phoneField}>
            <Text style={[styles.phoneLabel, { color: colors.mutedForeground }]}>Phone Number</Text>
            <View style={styles.phoneRow}>
              <View style={[
                styles.prefix,
                {
                  backgroundColor: colors.input,
                  borderColor: errors.phone ? colors.destructive : colors.border,
                },
              ]}>
                <Text style={[styles.prefixText, { color: colors.foreground }]}>🇷🇼 +250</Text>
              </View>
              <View style={{ flex: 1 }}>
                <KandaInput
                  placeholder="7XX XXX XXX"
                  value={form.phone}
                  onChangeText={t => update('phone', t)}
                  keyboardType="phone-pad"
                  maxLength={12}
                  error={errors.phone}
                />
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Sticky bottom */}
      <View style={[
        styles.bottom,
        {
          backgroundColor: colors.background,
          paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 24),
          borderTopColor: colors.border,
        },
      ]}>
        <KandaButton
          title="Continue"
          onPress={handleContinue}
          fullWidth
          size="lg"
        />
        <View style={styles.row}>
          <Text style={[styles.hint, { color: colors.mutedForeground }]}>Already have an account? </Text>
          <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
            <Text style={[styles.hint, { color: colors.primary }]}>Log in</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 24, gap: 24 },
  backBtn: { alignSelf: 'flex-start', paddingVertical: 4 },
  backText: { fontSize: 15, fontFamily: 'Inter_500Medium' },
  header: { gap: 6 },
  title: { fontSize: 28, fontFamily: 'Inter_700Bold' },
  subtitle: { fontSize: 15, fontFamily: 'Inter_400Regular', lineHeight: 22 },
  card: { borderRadius: 20, borderWidth: 1, padding: 20, gap: 18 },
  phoneField: { gap: 6 },
  phoneLabel: { fontSize: 13, fontFamily: 'Inter_500Medium', marginLeft: 2 },
  phoneRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  prefix: {
    height: 52,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prefixText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  bottom: {
    paddingHorizontal: 24,
    paddingTop: 16,
    gap: 14,
    borderTopWidth: 1,
  },
  row: { flexDirection: 'row', justifyContent: 'center' },
  hint: { fontSize: 14, fontFamily: 'Inter_400Regular' },
});
