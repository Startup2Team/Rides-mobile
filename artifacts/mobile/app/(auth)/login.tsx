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
import { BackButton } from '@/components/BackButton';
import { KandaButton } from '@/components/KandaButton';
import { KandaInput } from '@/components/KandaInput';
import { LanguageSelector } from '@/components/LanguageSelector';
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
        <View style={styles.topBar}>
          <BackButton onPress={() => router.back()} />
          <LanguageSelector />
        </View>

        <View style={styles.centerContent}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.foreground }]}>Welcome back</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              Enter your Rwanda phone number
            </Text>
          </View>

          <View style={styles.form}>
            <KandaInput
              placeholder="Phone number"
              floatingLabel="Phone number"
              value={phone}
              onChangeText={t => { setPhone(t); setError(''); }}
              keyboardType="phone-pad"
              maxLength={12}
            error={error}
            leftIcon="phone"
          />
          </View>

          <KandaButton
            title="Send OTP Code"
            onPress={handleContinue}
            fullWidth
            size="lg"
            disabled={phone.replace(/\D/g, '').length < 9}
          />
        </View>
      </ScrollView>

      <View
        style={[
          styles.bottom,
          {
            backgroundColor: colors.background,
            paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 24),
          },
        ]}
      >
        <View style={styles.row}>
          <Text style={[styles.hint, { color: colors.mutedForeground }]}>No account? </Text>
          <TouchableOpacity onPress={() => router.replace('/(auth)/register')}>
            <Text style={[styles.hint, { color: colors.primary }]}>Register</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingHorizontal: 24, gap: 24 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  header: { gap: 8 },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    gap: 24,
    paddingBottom: 22,
  },
  title: { fontSize: 24, fontFamily: 'Inter_700Bold' },
  subtitle: { fontSize: 15, fontFamily: 'Inter_400Regular' },
  form: { gap: 18 },
  bottom: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  row: { flexDirection: 'row', justifyContent: 'center' },
  hint: { fontSize: 14, fontFamily: 'Inter_400Regular' },
});
