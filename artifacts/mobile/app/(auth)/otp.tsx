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
import { navigateToCustomerHomeAfterCompletion, navigateToDriverHomeAfterCompletion } from '@/navigation/navigationPolicy';
import { requestOtp, verifyOtp } from '@/services/authSession';
import type { User } from '@/types';

// Client-side throttle before a fresh OTP can be requested again. The backend
// also rate-limits OTP sends (5/hour), so keep this comfortably under that.
const RESEND_COOLDOWN_SECONDS = 30;

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
  const [resending, setResending] = useState(false);
  const [resendIn, setResendIn] = useState(RESEND_COOLDOWN_SECONDS);

  useEffect(() => {
    if (expiryTimer <= 0) return;
    const t = setTimeout(() => setExpiryTimer(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [expiryTimer]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const handleResend = async () => {
    if (resending || resendIn > 0) return;
    setResending(true);
    setError('');
    try {
      // Actually re-request the OTP from the backend (POST /auth/register) —
      // this is what generates a fresh code, sends the SMS (when configured),
      // and shows up in the server logs. The old button only reset local state.
      await requestOtp({ phoneNumber: phone, fullName: name });
      setCode(Array(otpLength).fill(''));
      setExpiryTimer(OTP_VALIDITY_SECONDS);
      setResendIn(RESEND_COOLDOWN_SECONDS);
      inputRefs.current[0]?.focus();
    } catch {
      setError("Couldn't resend the code. Please try again.");
    } finally {
      setResending(false);
    }
  };

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
    if (verifying) return;
    setVerifying(true);
    setError('');
    try {
      // Real backend: exchanges the OTP for a session; tokens are persisted
      // inside verifyOtp() so subsequent requests are authenticated.
      const session = await verifyOtp({ phoneNumber: phone ?? '', otp: entered });
      const sessionUser = session.user;
      const user: User = {
        id: sessionUser?.id ?? (phone ?? entered),
        name: sessionUser?.name || (name ?? '') || (phone ?? 'User'),
        phone: phone ?? sessionUser?.phone ?? '',
        email: email ?? sessionUser?.email,
        mode: sessionUser?.mode ?? 'customer',
        isDriver: sessionUser?.isDriver ?? false,
        createdAt: sessionUser?.createdAt || new Date().toISOString(),
      };
      const landing = await login(user);
      if (landing === 'driver') {
        navigateToDriverHomeAfterCompletion(router);
      } else {
        navigateToCustomerHomeAfterCompletion(router);
      }
    } catch {
      setError("That code didn't work. Check it and try again.");
      setCode(Array(otpLength).fill(''));
      inputRefs.current[0]?.focus();
    } finally {
      setVerifying(false);
    }
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

      <TouchableOpacity
        onPress={handleResend}
        disabled={resending || resendIn > 0}
        style={[styles.resend, (resending || resendIn > 0) && { opacity: 0.5 }]}
        accessibilityRole="button"
        accessibilityLabel="Resend verification code"
        accessibilityState={{ disabled: resending || resendIn > 0 }}
      >
        <AppText variant="label" style={[styles.resendText, { color: colors.primary }]}>
          {resending ? 'Sending…' : resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
        </AppText>
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
