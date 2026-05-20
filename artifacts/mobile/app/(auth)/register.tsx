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
  const [form, setForm] = useState({ name: '', phone: '', email: '' });
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
        email: form.email.trim(),
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
            paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 24),
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
            Join KandaRide — Rwanda's fastest ride
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
          <View style={styles.phoneRow}>
            <View style={[styles.prefix, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <Text style={[styles.prefixText, { color: colors.foreground }]}>🇷🇼 +250</Text>
            </View>
            <View style={{ flex: 1 }}>
              <KandaInput
                label="Phone Number"
                placeholder="7XX XXX XXX"
                value={form.phone}
                onChangeText={t => update('phone', t)}
                keyboardType="phone-pad"
                maxLength={12}
                error={errors.phone}
              />
            </View>
          </View>
          <KandaInput
            label="Email (optional)"
            placeholder="you@example.com"
            value={form.email}
            onChangeText={t => update('email', t)}
            keyboardType="email-address"
            autoCapitalize="none"
            leftIcon="mail"
          />
        </View>

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
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 24, gap: 20 },
  backBtn: { alignSelf: 'flex-start' },
  backText: { fontSize: 15, fontFamily: 'Inter_500Medium' },
  header: { gap: 8 },
  title: { fontSize: 28, fontFamily: 'Inter_700Bold' },
  subtitle: { fontSize: 15, fontFamily: 'Inter_400Regular' },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 14 },
  phoneRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-end' },
  prefix: {
    height: 52,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 0,
  },
  prefixText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  row: { flexDirection: 'row', justifyContent: 'center' },
  hint: { fontSize: 14, fontFamily: 'Inter_400Regular' },
});
