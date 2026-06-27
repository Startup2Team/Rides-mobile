import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { BackButton } from '@/components/BackButton';
import { AppText } from '@/components/AppText';
import { AppButton } from '@/components/AppButton';
import { AppInput } from '@/components/AppInput';
import { LanguageSelector } from '@/components/LanguageSelector';
import { typography } from '@/constants/typography';
import { useColors } from '@/hooks/useColors';

const COUNTRIES = [
  { name: 'Rwanda', code: 'RW', dialCode: '+250', flag: '🇷🇼', example: '7XX XXX XXX', minLength: 9, maxLength: 9 },
  { name: 'Uganda', code: 'UG', dialCode: '+256', flag: '🇺🇬', example: '7XX XXX XXX', minLength: 9, maxLength: 9 },
];

function getCountryFlag(code: string) {
  return code
    .toUpperCase()
    .replace(/./g, char => String.fromCodePoint(127397 + char.charCodeAt(0)));
}

export default function RegisterScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState({ name: '', phone: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [editingForm, setEditingForm] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]);
  const [showCountrySheet, setShowCountrySheet] = useState(false);

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
    if (form.phone.replace(/\D/g, '').length < selectedCountry.minLength) {
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
        phone: `${selectedCountry.dialCode}${form.phone.replace(/\D/g, '')}`,
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
            <AppText variant="h2" style={[styles.title, { color: colors.foreground }]}>Register your account</AppText>
          </View>

          <View style={styles.form}>
            <AppInput
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
              <AppText variant="label" style={[styles.phoneLabel, { color: colors.mutedForeground }]}>Phone number</AppText>
              <View style={styles.phoneRow}>
                <TouchableOpacity
                  style={[
                    styles.countryCode,
                    {
                      backgroundColor: colors.input,
                      borderColor: errors.phone ? colors.destructive : colors.border,
                    },
                  ]}
                  onPress={() => {
                    Keyboard.dismiss();
                    setShowCountrySheet(true);
                  }}
                  activeOpacity={0.75}
                >
                  <Text style={styles.countryFlag}>{getCountryFlag(selectedCountry.code)}</Text>
                  <Feather name="chevron-down" size={15} color={colors.mutedForeground} />
                </TouchableOpacity>
                <View
                  style={[
                    styles.phoneNumberBox,
                    {
                      backgroundColor: colors.input,
                      borderColor: errors.phone ? colors.destructive : colors.border,
                    },
                  ]}
                >
                  <AppText variant="body" style={[styles.phonePrefix, { color: colors.foreground }]}>
                    {selectedCountry.dialCode}
                  </AppText>
                  <TextInput
                    placeholder={selectedCountry.example}
                    placeholderTextColor={colors.mutedForeground}
                    value={form.phone}
                    onChangeText={t => update('phone', t.replace(/\D/g, '').slice(0, selectedCountry.maxLength))}
                    keyboardType="phone-pad"
                    maxLength={selectedCountry.maxLength}
                    onFocus={() => setEditingForm(true)}
                    style={[styles.phoneInput, { color: colors.foreground }]}
                  />
                </View>
              </View>
              {errors.phone ? <AppText variant="caption" style={[styles.errorText, { color: colors.destructive }]}>{errors.phone}</AppText> : null}
            </View>

            {editingForm && (
              <View style={styles.inlineContinue}>
                <AppButton title="Continue" onPress={handleContinue} fullWidth size="lg" />
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
          <AppButton title="Continue" onPress={handleContinue} fullWidth size="lg" />
          <View style={styles.row}>
            <AppText variant="bodySmall" style={[styles.hint, { color: colors.mutedForeground }]}>Already have an account? </AppText>
            <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
              <AppText variant="bodySmall" style={[styles.hint, { color: colors.primary }]}>Log in</AppText>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <Modal
        visible={showCountrySheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCountrySheet(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowCountrySheet(false)} />
        <View
          style={[
            styles.countrySheet,
            {
              backgroundColor: colors.background,
              borderColor: colors.border,
              paddingBottom: insets.bottom + 18,
            },
          ]}
        >
          <View style={styles.sheetHandle} />
          <AppText variant="h3" style={[styles.sheetTitle, { color: colors.foreground }]}>Choose country code</AppText>
          <ScrollView style={styles.countryList} contentContainerStyle={styles.countryListContent}>
            {COUNTRIES.map(country => {
              const selected = country.code === selectedCountry.code;
              return (
                <TouchableOpacity
                  key={country.code}
                  style={[
                    styles.countryOption,
                    {
                      backgroundColor: selected ? colors.primaryHex + '18' : colors.card,
                      borderColor: selected ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => {
                    setSelectedCountry(country);
                    setForm(f => ({ ...f, phone: f.phone.replace(/\D/g, '').slice(0, country.maxLength) }));
                    setErrors(e => ({ ...e, phone: '' }));
                    setShowCountrySheet(false);
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.countryOptionFlag}>{getCountryFlag(country.code)}</Text>
                  <View style={styles.countryOptionText}>
                    <AppText variant="body" style={[styles.countryOptionName, { color: colors.foreground }]}>{country.name}</AppText>
                    <AppText variant="label" style={[styles.countryOptionCode, { color: colors.mutedForeground }]}>
                      {country.dialCode}
                    </AppText>
                  </View>
                  {selected && <Feather name="check" size={20} color={colors.primary} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
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
    letterSpacing: 0,
  },
  subtitle: {
    lineHeight: 22,
    maxWidth: 320,
  },
  form: {
    gap: 18,
  },
  phoneField: {
    gap: 6,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  phoneNumberBox: {
    flex: 1,
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  countryCode: {
    height: 52,
    width: 74,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  countryFlag: {
    // typography-exception: emoji flag sizing behaves like an icon.
    ...typography.h2,
  },
  phonePrefix: {
    paddingLeft: 16,
    paddingRight: 8,
    ...typography.body,
    fontFamily: typography.badge.fontFamily,
  },
  phoneInput: {
    flex: 1,
    height: '100%',
    paddingLeft: 0,
    paddingRight: 16,
    ...typography.body,
  },
  inlineContinue: {
    paddingTop: 4,
  },
  phoneLabel: {
    marginLeft: 2,
  },
  errorText: {
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
  hint: {},
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  countrySheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '72%',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
    paddingTop: 10,
    paddingHorizontal: 22,
    gap: 16,
  },
  sheetHandle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#777',
    alignSelf: 'center',
  },
  sheetTitle: {
  },
  countryList: {
    marginHorizontal: -2,
  },
  countryListContent: {
    gap: 10,
    paddingHorizontal: 2,
    paddingBottom: 8,
  },
  countryOption: {
    minHeight: 60,
    borderRadius: 30,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  countryOptionFlag: {
    // typography-exception: emoji flag sizing behaves like an icon.
    ...typography.h1,
  },
  countryOptionText: {
    flex: 1,
    gap: 2,
  },
  countryOptionName: {
    fontFamily: typography.badge.fontFamily,
  },
  countryOptionCode: {
  },
});
