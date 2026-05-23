import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Keyboard,
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

export default function RegisterScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState({ name: '', phone: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [editingForm, setEditingForm] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => setEditingForm(true));
    const willHideSub = Keyboard.addListener('keyboardWillHide', () => setEditingForm(false));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setEditingForm(false));

    return () => {
      showSub.remove();
      willHideSub.remove();
      hideSub.remove();
    };
  }, []);

  const update = (field: string, val: string) => {
    setForm(f => ({ ...f, [field]: val }));
    setErrors(e => ({ ...e, [field]: '' }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (form.name.trim().length < 2) {
      e.name = 'Enter your name';
    }
    if (form.phone.replace(/\D/g, '').length < 9) {
      e.phone = 'Enter a valid phone number';
    }
    return e;
  };

  const handleContinue = () => {
    const e = validate();
    if (Object.keys(e).length) {
      setErrors(e);
      return;
    }

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
            paddingBottom: editingForm ? insets.bottom + 28 : 20,
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
            <Text style={[styles.title, { color: colors.foreground }]}>Register your account</Text>
          </View>

          <View style={styles.form}>
            <KandaInput
              placeholder="Full name"
              floatingLabel="Full name"
              value={form.name}
              onChangeText={t => update('name', t)}
              error={errors.name}
              leftIcon="user"
              autoCapitalize="words"
              onFocus={() => setEditingForm(true)}
            />

            <View style={styles.phoneField}>
              <KandaInput
                placeholder="Phone number"
                floatingLabel="Phone number"
                value={form.phone}
                onChangeText={t => update('phone', t)}
                keyboardType="phone-pad"
                maxLength={12}
                error={errors.phone}
                leftIcon="phone"
                onFocus={() => setEditingForm(true)}
              />
            </View>

            {editingForm && (
              <View style={styles.inlineContinue}>
                <KandaButton title="Continue" onPress={handleContinue} fullWidth size="lg" />
              </View>
            )}
          </View>

        </View>
      </ScrollView>

      {!editingForm && (
        <View
          style={[
            styles.bottom,
            {
              backgroundColor: colors.background,
              paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 24),
            },
          ]}
        >
          <KandaButton title="Continue" onPress={handleContinue} fullWidth size="lg" />
          <View style={styles.row}>
            <Text style={[styles.hint, { color: colors.mutedForeground }]}>Already have an account? </Text>
            <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
              <Text style={[styles.hint, { color: colors.primary }]}>Log in</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 22,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  header: {
    gap: 8,
    paddingTop: 4,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    gap: 22,
    paddingBottom: 22,
  },
  title: {
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    lineHeight: 22,
    maxWidth: 320,
  },
  form: {
    gap: 18,
  },
  phoneField: {
    gap: 6,
  },
  inlineContinue: {
    paddingTop: 4,
  },
  phoneLabel: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    marginLeft: 2,
  },
  bottom: {
    paddingHorizontal: 22,
    paddingTop: 16,
    gap: 14,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  hint: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
});
