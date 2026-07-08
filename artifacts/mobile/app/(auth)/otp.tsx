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
import { AppText } from '@/components/AppText';
import { formatOtpTime, OTP_VALIDITY_SECONDS } from '@/constants/otp';
import { typography } from '@/constants/typography';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';
import { navigateToCustomerHomeAfterCompletion } from '@/navigation/navigationPolicy';

export default function OTPScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { phone, name, email, mode, length } = useLocalSearchParams<{
    phone: string; name: string; email: string; mode: string; length?: string;
  }>();
  const { login } = useAuth();

  const otpLength = length === '4' ? 4 : 6;
  const [code, setCode] = useState<string[]>(() => Array(otpLength).fill(''));
  const [expiryTimer, setExpiryTimer] = useState(OTP_VALIDITY_SECONDS);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const inputRefs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (expiryTimer <= 0) return;
    const t = setTimeout(() => setExpiryTimer(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [expiryTimer]);

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
    if (expiryTimer <= 0) {
      setError('This code has expired. Request a new code to continue.');
      return;
    }
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
    navigateToCustomerHomeAfterCompletion(router);
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
          <AppText variant="h1" style={[styles.title, { color: colors.foreground }]}>Verify number</AppText>
          <AppText variant="body" style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Code sent to {phone}
          </AppText>
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

        {error ? <AppText variant="label" style={[styles.error, { color: colors.destructive }]}>{error}</AppText> : null}
        {expiryTimer > 0 ? (
          <AppText variant="caption" style={[styles.expiryText, { color: colors.mutedForeground }]}>
            Code expires in {formatOtpTime(expiryTimer)}
          </AppText>
        ) : null}

        {verifying ? (
          <AppText variant="bodySmall" style={[styles.verifyingText, { color: colors.primary }]}>Verifying...</AppText>
        ) : null}
      </View>

      {expiryTimer <= 0 ? (
        <TouchableOpacity
          onPress={() => {
            setCode(Array(otpLength).fill(''));
            setError('');
            setExpiryTimer(OTP_VALIDITY_SECONDS);
          }}
          style={styles.resend}
        >
          <AppText variant="label" style={[styles.resendText, { color: colors.primary }]}>Resend code</AppText>
        </TouchableOpacity>
      ) : null}
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
  title: {},
  subtitle: {},
  otpRow: { flexDirection: 'row', gap: 10, justifyContent: 'center', alignSelf: 'center' },
  otpBox: {
    width: 48,
    height: 56,
    borderRadius: 12,
    borderWidth: 1.5,
    ...typography.h1,
  },
  error: { textAlign: 'center' },
  expiryText: { textAlign: 'center' },
  verifyingText: { textAlign: 'center' },
  resend: { alignItems: 'center' },
  resendText: {},
});
