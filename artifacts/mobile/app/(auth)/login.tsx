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

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');

  const handleContinue = () => {
    if (phone.replace(/\D/g, '').length < 9) {
      setError('Enter a valid phone number');
      return;
    }
    setError('');
    router.push({
      pathname: '/(auth)/otp',
      params: { phone: `+250${phone.replace(/\D/g, '')}`, mode: 'login' },
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
          <Text style={[styles.title, { color: colors.foreground }]}>Welcome back</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Enter your Rwanda phone number
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.phoneRow}>
            <View style={[styles.prefix, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <Text style={[styles.prefixText, { color: colors.foreground }]}>🇷🇼 +250</Text>
            </View>
            <View style={{ flex: 1 }}>
              <KandaInput
                placeholder="7XX XXX XXX"
                value={phone}
                onChangeText={t => { setPhone(t); setError(''); }}
                keyboardType="phone-pad"
                maxLength={12}
                error={error}
              />
            </View>
          </View>
        </View>

        <KandaButton
          title="Send OTP Code"
          onPress={handleContinue}
          fullWidth
          size="lg"
          disabled={phone.replace(/\D/g, '').length < 9}
        />

        <View style={styles.row}>
          <Text style={[styles.hint, { color: colors.mutedForeground }]}>No account? </Text>
          <TouchableOpacity onPress={() => router.replace('/(auth)/register')}>
            <Text style={[styles.hint, { color: colors.primary }]}>Register</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 24, gap: 24 },
  backBtn: { alignSelf: 'flex-start' },
  backText: { fontSize: 15, fontFamily: 'Inter_500Medium' },
  header: { gap: 8 },
  title: { fontSize: 28, fontFamily: 'Inter_700Bold' },
  subtitle: { fontSize: 15, fontFamily: 'Inter_400Regular' },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 16,
  },
  phoneRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  prefix: {
    height: 52,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prefixText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  row: { flexDirection: 'row', justifyContent: 'center' },
  hint: { fontSize: 14, fontFamily: 'Inter_400Regular' },
});
