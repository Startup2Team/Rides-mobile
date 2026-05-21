import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KandaButton } from '@/components/KandaButton';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';

export default function OTPScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { phone, name, email, mode } = useLocalSearchParams<{
    phone: string; name: string; email: string; mode: string;
  }>();
  const { login } = useAuth();

  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [timer, setTimer] = useState(30);
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
    if (cleaned && idx < 5) inputRefs.current[idx + 1]?.focus();
    if (!cleaned && idx > 0) inputRefs.current[idx - 1]?.focus();
    if (cleaned && idx === 5) {
      const full = [...next].join('');
      if (full.length === 6) handleVerifyCode(full);
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
    router.replace('/(tabs)/');
  };

  const handleVerify = async () => {
    const entered = code.join('');
    if (entered.length < 6) { setError('Enter the 6-digit code'); return; }
    handleVerifyCode(entered);
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
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <Text style={[styles.backText, { color: colors.primary }]}>← Back</Text>
      </TouchableOpacity>

      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.foreground }]}>Verify number</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Code sent to {phone}
        </Text>
        <View style={[styles.simBadge, { backgroundColor: colors.primary + '20' }]}>
          <Text style={[styles.simText, { color: colors.primary }]}>
            Demo: enter any 6 digits
          </Text>
        </View>
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
            autoFocus={i === 0}
          />
        ))}
      </View>

      {error ? <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}

      <KandaButton
        title={verifying ? 'Verifying...' : 'Verify & Continue'}
        onPress={handleVerify}
        fullWidth
        size="lg"
        loading={verifying}
        disabled={code.join('').length < 6}
      />

      <TouchableOpacity
        disabled={timer > 0}
        onPress={() => setTimer(30)}
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
  backBtn: { alignSelf: 'flex-start' },
  backText: { fontSize: 15, fontFamily: 'Inter_500Medium' },
  header: { gap: 10 },
  title: { fontSize: 28, fontFamily: 'Inter_700Bold' },
  subtitle: { fontSize: 15, fontFamily: 'Inter_400Regular' },
  simBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  simText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  otpRow: { flexDirection: 'row', gap: 10, justifyContent: 'center' },
  otpBox: {
    width: 48,
    height: 56,
    borderRadius: 12,
    borderWidth: 1.5,
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
  },
  error: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  resend: { alignItems: 'center' },
  resendText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
});
