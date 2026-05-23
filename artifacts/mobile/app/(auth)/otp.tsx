import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton } from '@/components/BackButton';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';

export default function OTPScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { phone, name, email, mode, length } = useLocalSearchParams<{
    phone: string; name: string; email: string; mode: string; length?: string;
  }>();
  const { login } = useAuth();

  const otpLength = length === '4' ? 4 : 6;
  const [code, setCode] = useState<string[]>(() => Array(otpLength).fill(''));
  const [timer, setTimer] = useState(60);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const inputRefs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (timer <= 0) return;
    const t = setTimeout(() => setTimer(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [timer]);

  const handleInput = (val: string, idx: number) => {
    const cleaned = val.replace(/\D/g, '').slice(-1);
    const next = [...code];
    next[idx] = cleaned;
    setCode(next);
    setError('');
    if (cleaned && idx < otpLength - 1) inputRefs.current[idx + 1]?.focus();
    if (!cleaned && idx > 0) inputRefs.current[idx - 1]?.focus();
    if (cleaned && idx === otpLength - 1) {
      const full = [...next].join('');
      if (full.length === otpLength) handleVerifyCode(full);
    }
  };

  const handleVerifyCode = async (entered: string) => {
    setVerifying(true);
    await new Promise(r => setTimeout(r, 1500));
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 9);
    await login({
      id,
      name: name ?? phone ?? 'User',
      phone: phone ?? '',
      email: email ?? undefined,
      mode: 'customer',
      isDriver: false,
      createdAt: new Date().toISOString(),
    });
    router.replace('/(tabs)');
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 20) + 20,
          paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 24),
        },
      ]}
    >
      <BackButton onPress={() => router.back()} />

      <View style={styles.centerContent}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.foreground }]}>Verify number</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Code sent to {phone}
          </Text>
        </View>

        <View style={styles.otpRow}>
          {code.map((digit, i) => (
            <TextInput
              key={i}
              ref={r => { inputRefs.current[i] = r; }}
              style={[
                styles.otpBox,
                {
                  backgroundColor: colors.card,
                  borderColor: digit ? colors.primary : colors.border,
                  color: colors.foreground,
                },
              ]}
              value={digit}
              onChangeText={v => handleInput(v, i)}
              keyboardType="number-pad"
              maxLength={1}
              textAlign="center"
              editable={!verifying}
            />
          ))}
        </View>

        {error ? <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}

        {verifying ? (
          <Text style={[styles.verifyingText, { color: colors.primary }]}>Verifying...</Text>
        ) : null}
      </View>

      <TouchableOpacity
        disabled={timer > 0}
        onPress={() => setTimer(60)}
        style={styles.resend}
      >
        <Text style={[styles.resendText, { color: timer > 0 ? colors.mutedForeground : colors.primary }]}>
          {timer > 0 ? `Resend in ${timer}s` : 'Resend code'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24, gap: 28 },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    gap: 24,
    paddingBottom: 82,
  },
  header: { gap: 10, alignItems: 'flex-start' },
  title: { fontSize: 24, fontFamily: 'Inter_700Bold' },
  subtitle: { fontSize: 15, fontFamily: 'Inter_400Regular' },
  otpRow: { flexDirection: 'row', gap: 10, justifyContent: 'center', alignSelf: 'center' },
  otpBox: {
    width: 48,
    height: 56,
    borderRadius: 12,
    borderWidth: 1.5,
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
  },
  error: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  verifyingText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
  resend: { alignItems: 'center' },
  resendText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
});
