import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppButton } from '@/components/AppButton';
import { AppInput } from '@/components/AppInput';
import { GlassHeader, useGlassHeaderMetrics } from '@/components/GlassHeader';
import { GlassScrollView } from '@/components/GlassScrollView';
import { formatOtpTime, OTP_VALIDITY_SECONDS } from '@/constants/otp';
import { FORM_BOTTOM_PADDING } from '@/constants/tabBar';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useProfileActions } from '@/domains/profile';
import { useColors } from '@/hooks/useColors';
import { formatRwandaPhoneInput, normalizeRwandaPhoneNumber } from '@/utils/rwandaValidation';
import { typography } from '@/constants/typography';

const OTP_LENGTH = 6;

export default function ChangePhoneNumberScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const headerMetrics = useGlassHeaderMetrics();
  const { user } = useAuth();
  const { updateUser } = useProfileActions();
  const { showToast } = useToast();
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [pendingPhone, setPendingPhone] = useState('');
  const [code, setCode] = useState<string[]>(() => Array(OTP_LENGTH).fill(''));
  const [expiryTimer, setExpiryTimer] = useState(0);
  const [verifying, setVerifying] = useState(false);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (expiryTimer <= 0) return;
    const timeout = setTimeout(() => setExpiryTimer(current => current - 1), 1000);
    return () => clearTimeout(timeout);
  }, [expiryTimer]);

  const sendCode = () => {
    const normalized = normalizeRwandaPhoneNumber(phone);
    if (!normalized) {
      setPhoneError('Enter a valid Rwanda phone number');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    if (normalized === user?.phone) {
      setPhoneError('Enter a different phone number');
      return;
    }
    setPhoneError('');
    setPendingPhone(normalized);
    setCode(Array(OTP_LENGTH).fill(''));
    setExpiryTimer(OTP_VALIDITY_SECONDS);
  };

  const handleDigit = (value: string, index: number) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...code];
    next[index] = digit;
    setCode(next);
    if (digit && index < OTP_LENGTH - 1) inputRefs.current[index + 1]?.focus();
    if (!digit && index > 0) inputRefs.current[index - 1]?.focus();
  };

  const verifyAndSave = async () => {
    if (code.join('').length !== OTP_LENGTH) return;
    if (expiryTimer <= 0) return;
    setVerifying(true);
    await new Promise(resolve => setTimeout(resolve, 700));
    await updateUser({ phone: pendingPhone });
    setVerifying(false);
    showToast('Phone number verified and updated', 'info');
    router.back();
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.root, { backgroundColor: colors.background }]}
    >
      <GlassHeader
        title="Change Phone Number"
        subtitle={pendingPhone ? 'Verify your new number' : 'Enter your new number'}
      />
      <GlassScrollView
        indicatorTop={headerMetrics.indicatorTop}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          paddingTop: headerMetrics.contentTop,
          paddingBottom: insets.bottom + FORM_BOTTOM_PADDING,
          paddingHorizontal: 20,
        }}
      >
        {!pendingPhone ? (
          <View style={styles.phoneStep}>
            <View style={styles.phoneStepHeader}>
              <Text style={[styles.title, { color: colors.foreground }]}>What is your new number?</Text>
              <Text style={[styles.description, { color: colors.mutedForeground }]}>
                We will send a one-time verification code to confirm that the number belongs to you.
              </Text>
            </View>
            <View style={styles.phoneForm}>
              <AppInput
                autoFocus
                error={phoneError}
                keyboardType="phone-pad"
                label="New Phone Number"
                onChangeText={value => {
                  setPhone(formatRwandaPhoneInput(value));
                  if (phoneError) setPhoneError('');
                }}
                placeholder="0788 123 456"
                value={phone}
              />
            </View>
            <AppButton fullWidth size="lg" title="Send Verification Code" onPress={sendCode} />
          </View>
        ) : (
          <View style={styles.content}>
            <View style={styles.iconWrap}>
              <Feather name="message-square" size={30} color={colors.foreground} />
            </View>
            <View style={styles.copy}>
              <Text style={[styles.title, { color: colors.foreground }]}>Enter verification code</Text>
              <Text style={[styles.description, { color: colors.mutedForeground }]}>
                Enter the 6-digit code sent to {pendingPhone}. Your number changes only after verification.
              </Text>
            </View>
            <View style={styles.otpRow}>
              {code.map((digit, index) => (
                <TextInput
                  editable={!verifying}
                  key={index}
                  keyboardType="number-pad"
                  maxLength={1}
                  onChangeText={value => handleDigit(value, index)}
                  ref={ref => { inputRefs.current[index] = ref; }}
                  style={[
                    styles.otpBox,
                    {
                      backgroundColor: colors.card,
                      borderColor: digit ? colors.primary : colors.border,
                      color: colors.foreground,
                    },
                  ]}
                  textAlign="center"
                  value={digit}
                />
              ))}
            </View>
            <AppButton
              disabled={code.join('').length !== OTP_LENGTH || expiryTimer <= 0}
              loading={verifying}
              onPress={verifyAndSave}
              size="lg"
              style={styles.otpAction}
              title="Verify and Save"
            />
            {expiryTimer > 0 ? (
              <Text style={[styles.expiryText, { color: colors.mutedForeground }]}>
                Code expires in {formatOtpTime(expiryTimer)}
              </Text>
            ) : null}
            <View style={styles.secondaryActions}>
              {expiryTimer <= 0 ? (
                <TouchableOpacity
                  onPress={() => {
                    setCode(Array(OTP_LENGTH).fill(''));
                    setExpiryTimer(OTP_VALIDITY_SECONDS);
                  }}
                >
                  <Text style={[styles.secondaryAction, { color: colors.primary }]}>Resend code</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity onPress={() => setPendingPhone('')}>
                <Text style={[styles.secondaryAction, { color: colors.primary }]}>Use a different number</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </GlassScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { width: '100%', maxWidth: 420, alignSelf: 'center', gap: 22 },
  phoneStep: {
    width: '100%',
    maxWidth: 420,
    flex: 1,
    alignSelf: 'center',
    justifyContent: 'center',
    gap: 24,
    paddingBottom: 22,
  },
  phoneStepHeader: { gap: 8 },
  phoneForm: { gap: 18 },
  iconWrap: { alignSelf: 'center', width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  copy: { alignItems: 'center', gap: 8, paddingHorizontal: 10 },
  title: { ...typography.h2, fontFamily: typography.badge.fontFamily},
  description: { ...typography.body, fontFamily: typography.body.fontFamily, lineHeight: 21 },
  otpRow: { flexDirection: 'row', justifyContent: 'center', gap: 7 },
  otpBox: { width: 45, height: 54, borderRadius: 12, borderWidth: 1.5, ...typography.h2, fontFamily: typography.badge.fontFamily},
  otpAction: { width: 305, alignSelf: 'center' },
  secondaryActions: { alignItems: 'center', gap: 15 },
  expiryText: { ...typography.caption, fontFamily: typography.body.fontFamily, textAlign: 'center' },
  secondaryAction: { ...typography.label, fontFamily: typography.title.fontFamily},
});
