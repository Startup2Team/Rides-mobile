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
import { AppButton } from '@/components/AppButton';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';
import { register, verifyOtp } from '@/services/auth';
import { api } from '@/services/api';

function normalizePhoneParam(value?: string) {
  const raw = decodeURIComponent(value ?? '').trim().replace(/\s+/g, '');
  if (!raw) return '';
  if (raw.startsWith('+')) return raw;
  const digits = raw.replace(/\D/g, '');
  return digits ? `+${digits}` : '';
}

export default function OTPScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { phone, name, email, mode, length, dev_otp } = useLocalSearchParams<{
    phone: string; name: string; email: string; mode: string; length?: string; dev_otp?: string;
  }>();
  const normalizedPhone = normalizePhoneParam(phone);
  const { login, loadDriverProfile } = useAuth();

  const otpLength = length === '4' ? 4 : 6;
  const [code, setCode] = useState<string[]>(Array(otpLength).fill(''));
  const [timer, setTimer] = useState(60);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const inputRefs = useRef<(TextInput | null)[]>([]);
  // Guard: only auto-submit once from dev_otp pre-fill
  const devAutoSubmitted = useRef(false);

  // ─── Countdown timer ─────────────────────────────────────────────────────
  useEffect(() => {
    if (timer <= 0) return;
    const t = setTimeout(() => setTimer(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [timer]);

  // ─── Dev mode: pre-fill + auto-submit after brief delay ──────────────────
  // In development the backend echoes the OTP back as `dev_otp`. We pre-fill
  // the boxes and auto-submit after 1.2 s so developers can see the code
  // before the screen transitions — no need to tap anything manually.
  useEffect(() => {
    if (!dev_otp || dev_otp.length !== otpLength || devAutoSubmitted.current) return;
    const digits = dev_otp.replace(/\D/g, '');
    if (digits.length !== otpLength) return;
    setCode(digits.split(''));
    const t = setTimeout(() => {
      devAutoSubmitted.current = true;
      handleVerifyCode(digits);
    }, 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dev_otp]);

  // ─── Input handler — handles single-char typing AND paste/SMS autofill ───
  const handleInput = (val: string, idx: number) => {
    const digits = val.replace(/\D/g, '');

    // ── Paste / SMS autofill: full code arrives in one onChange call ──────
    if (digits.length > 1) {
      const filled = digits.slice(0, otpLength).split('');
      // Pad to full length
      while (filled.length < otpLength) filled.push('');
      setCode(filled);
      setError('');
      // Focus the last filled box (or the next empty one)
      const lastFilledIdx = Math.min(digits.length - 1, otpLength - 1);
      inputRefs.current[lastFilledIdx]?.focus();
      // Auto-submit if we got a complete code
      if (digits.length >= otpLength) {
        handleVerifyCode(digits.slice(0, otpLength));
      }
      return;
    }

    // ── Single character ──────────────────────────────────────────────────
    const cleaned = digits.slice(0, 1);
    const next = [...code];
    next[idx] = cleaned;
    setCode(next);
    setError('');

    if (cleaned) {
      // Advance focus to next empty box, or the next box in sequence
      if (idx < otpLength - 1) {
        inputRefs.current[idx + 1]?.focus();
      } else {
        // Last box filled — auto-submit if all boxes are filled
        const full = next.join('');
        if (full.length === otpLength && !full.includes('')) {
          handleVerifyCode(full);
        }
      }
    } else {
      // Backspace — move focus back
      if (idx > 0) inputRefs.current[idx - 1]?.focus();
    }
  };

  // ─── Key press: handle backspace on an already-empty box ─────────────────
  const handleKeyPress = (e: any, idx: number) => {
    if (e.nativeEvent.key === 'Backspace' && !code[idx] && idx > 0) {
      const next = [...code];
      next[idx - 1] = '';
      setCode(next);
      inputRefs.current[idx - 1]?.focus();
    }
  };

  // ─── Verification ─────────────────────────────────────────────────────────
  const handleVerifyCode = async (entered: string) => {
    if (verifying) return;
    setVerifying(true);
    setError('');
    try {
      const authData = await verifyOtp(normalizedPhone, entered);
      let profileName = (name ?? '').trim() || normalizedPhone || 'User';
      try {
        const { data } = await api.get('/customer/profile');
        profileName = data.full_name || data.name || profileName;
      } catch {
        // no-op — use the name from registration
      }
      await login({
        id: authData.user_id || Date.now().toString(),
        name: profileName,
        phone: normalizedPhone,
        email: email ?? undefined,
        mode: authData.role_state === 'CUSTOMER_ONLY' ? 'customer' : 'driver',
        isDriver: authData.role_state !== 'CUSTOMER_ONLY',
        createdAt: new Date().toISOString(),
      });
      // Driver accounts: hydrate the approved profile from the backend so the
      // app recognises them as a rider instead of restarting onboarding.
      if (authData.role_state !== 'CUSTOMER_ONLY') {
        await loadDriverProfile();
      }
      router.replace(authData.role_state === 'CUSTOMER_ONLY' ? '/(tabs)' : '/(driver)');
    } catch (err: any) {
      const backendMsg = err?.response?.data?.error?.message;
      setError(backendMsg || 'Invalid or expired code. Please try again.');
      setCode(Array(otpLength).fill(''));
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    } finally {
      setVerifying(false);
    }
  };

  // ─── Resend ───────────────────────────────────────────────────────────────
  const handleResend = async () => {
    if (timer > 0 || resending) return;
    setResending(true);
    setError('');
    try {
      const safeName = (name ?? '').trim().length >= 2 ? name : 'User';
      await register(normalizedPhone, safeName);
      setCode(Array(otpLength).fill(''));
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
      setTimer(60);
      devAutoSubmitted.current = false;
    } catch {
      setError('Could not resend. Please try again.');
    } finally {
      setResending(false);
    }
  };

  const codeComplete = code.join('').length === otpLength && !code.includes('');

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
          <Text style={[styles.title, { color: colors.foreground }]}>Verify your number</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            We sent a 6-digit code to{'\n'}
            <Text style={{ fontFamily: 'Inter_700Bold', color: colors.foreground }}>
              {normalizedPhone || '--'}
            </Text>
          </Text>
        </View>

        {dev_otp ? (
          <View style={[styles.devBanner, { backgroundColor: '#f59e0b22', borderColor: '#f59e0b' }]}>
            <Text style={[styles.devBannerText, { color: '#d97706' }]}>
              ⚡ DEV — code: {dev_otp} · auto-submitting…
            </Text>
          </View>
        ) : null}

        <View style={styles.otpRow}>
          {code.map((digit, i) => (
            <TextInput
              key={i}
              ref={r => { inputRefs.current[i] = r; }}
              style={[
                styles.otpBox,
                {
                  backgroundColor: colors.card,
                  borderColor: error
                    ? colors.destructive
                    : digit
                    ? colors.primary
                    : colors.border,
                  color: colors.foreground,
                  opacity: verifying ? 0.6 : 1,
                },
              ]}
              value={digit}
              onChangeText={v => handleInput(v, i)}
              onKeyPress={e => handleKeyPress(e, i)}
              keyboardType="number-pad"
              // maxLength={otpLength} allows iOS SMS autofill to paste the full code
              maxLength={otpLength}
              textAlign="center"
              editable={!verifying}
              // iOS SMS autofill — tells the OS this is a one-time-code field
              textContentType="oneTimeCode"
              autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'off'}
              importantForAutofill="yes"
            />
          ))}
        </View>

        {error ? (
          <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text>
        ) : null}

        {verifying ? (
          <Text style={[styles.verifyingText, { color: colors.primary }]}>Verifying…</Text>
        ) : null}
      </View>

      <View style={styles.bottomActions}>
        {!verifying && (
          <AppButton
            title="Verify code"
            onPress={() => handleVerifyCode(code.join(''))}
            fullWidth
            size="lg"
            disabled={!codeComplete}
          />
        )}

        <TouchableOpacity
          disabled={timer > 0 || resending}
          onPress={handleResend}
          style={styles.resend}
        >
          <Text
            style={[
              styles.resendText,
              {
                color:
                  timer > 0 || resending
                    ? colors.mutedForeground
                    : colors.primary,
              },
            ]}
          >
            {resending
              ? 'Sending…'
              : timer > 0
              ? `Resend in ${timer}s`
              : 'Resend code'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    gap: 28,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    gap: 24,
    paddingBottom: 40,
  },
  header: {
    gap: 10,
    alignItems: 'flex-start',
  },
  title: {
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
  },
  subtitle: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    lineHeight: 22,
  },
  otpRow: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    alignSelf: 'center',
  },
  otpBox: {
    width: 48,
    height: 56,
    borderRadius: 12,
    borderWidth: 1.5,
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
  },
  error: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
  verifyingText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center',
  },
  bottomActions: {
    gap: 16,
  },
  resend: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  resendText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  devBanner: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'stretch',
  },
  devBannerText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
  },
});
