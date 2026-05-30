import { router } from 'expo-router';
import React, { useState } from 'react';
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
import { KandaButton } from '@/components/KandaButton';
import { LanguageSelector } from '@/components/LanguageSelector';
import { useColors } from '@/hooks/useColors';

const COUNTRIES = [
  { name: 'Rwanda', code: 'RW', dialCode: '+250', flag: 'ðŸ‡·ðŸ‡¼', example: '7XX XXX XXX', minLength: 9, maxLength: 9 },
  { name: 'Uganda', code: 'UG', dialCode: '+256', flag: 'ðŸ‡ºðŸ‡¬', example: '7XX XXX XXX', minLength: 9, maxLength: 9 },
  { name: 'Kenya', code: 'KE', dialCode: '+254', flag: 'ðŸ‡°ðŸ‡ª', example: '7XX XXX XXX', minLength: 9, maxLength: 9 },
  { name: 'Tanzania', code: 'TZ', dialCode: '+255', flag: 'ðŸ‡¹ðŸ‡¿', example: '7XX XXX XXX', minLength: 9, maxLength: 9 },
  { name: 'Burundi', code: 'BI', dialCode: '+257', flag: 'ðŸ‡§ðŸ‡®', example: 'XX XXX XXX', minLength: 8, maxLength: 8 },
  { name: 'DR Congo', code: 'CD', dialCode: '+243', flag: 'ðŸ‡¨ðŸ‡©', example: '8XX XXX XXX', minLength: 9, maxLength: 9 },
  { name: 'United States', code: 'US', dialCode: '+1', flag: 'ðŸ‡ºðŸ‡¸', example: 'XXX XXX XXXX', minLength: 10, maxLength: 10 },
  { name: 'United Kingdom', code: 'GB', dialCode: '+44', flag: 'ðŸ‡¬ðŸ‡§', example: '7XXX XXXXXX', minLength: 10, maxLength: 10 },
  { name: 'France', code: 'FR', dialCode: '+33', flag: 'ðŸ‡«ðŸ‡·', example: 'X XX XX XX XX', minLength: 9, maxLength: 9 },
];

function getCountryFlag(code: string) {
  return code
    .toUpperCase()
    .replace(/./g, char => String.fromCodePoint(127397 + char.charCodeAt(0)));
}

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]);
  const [showCountrySheet, setShowCountrySheet] = useState(false);

  const handleContinue = () => {
    if (phone.replace(/\D/g, '').length < selectedCountry.minLength) {
      setError('Enter a valid phone number');
      return;
    }
    setError('');
    router.push({
      pathname: '/(auth)/otp',
      params: { phone: `${selectedCountry.dialCode}${phone.replace(/\D/g, '')}`, mode: 'login' },
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
          </View>

          <View style={styles.form}>
            <View style={styles.phoneField}>
              <Text style={[styles.phoneLabel, { color: colors.mutedForeground }]}>Phone number</Text>
              <View style={styles.phoneRow}>
                <TouchableOpacity
                  style={[
                    styles.countryCode,
                    {
                      backgroundColor: colors.input,
                      borderColor: error ? colors.destructive : colors.border,
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
                      borderColor: error ? colors.destructive : colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.phonePrefix, { color: colors.foreground }]}>
                    {selectedCountry.dialCode}
                  </Text>
                  <TextInput
                    placeholder={selectedCountry.example}
                    placeholderTextColor={colors.mutedForeground}
                    value={phone}
                    onChangeText={t => {
                      setPhone(t.replace(/\D/g, '').slice(0, selectedCountry.maxLength));
                      setError('');
                    }}
                    keyboardType="phone-pad"
                    maxLength={selectedCountry.maxLength}
                    style={[styles.phoneInput, { color: colors.foreground }]}
                  />
                </View>
              </View>
              {error ? <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text> : null}
            </View>
          </View>

          <KandaButton
            title="Send OTP Code"
            onPress={handleContinue}
            fullWidth
            size="lg"
            disabled={phone.replace(/\D/g, '').length < selectedCountry.minLength}
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
          <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Choose country code</Text>
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
                    setPhone(value => value.replace(/\D/g, '').slice(0, country.maxLength));
                    setError('');
                    setShowCountrySheet(false);
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.countryOptionFlag}>{getCountryFlag(country.code)}</Text>
                  <View style={styles.countryOptionText}>
                    <Text style={[styles.countryOptionName, { color: colors.foreground }]}>{country.name}</Text>
                    <Text style={[styles.countryOptionCode, { color: colors.mutedForeground }]}>
                      {country.dialCode}
                    </Text>
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
  title: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  subtitle: { fontSize: 15, fontFamily: 'Inter_400Regular' },
  form: { gap: 18 },
  phoneField: {
    gap: 6,
  },
  phoneLabel: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    marginLeft: 2,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
    fontSize: 22,
  },
  phoneNumberBox: {
    flex: 1,
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  phonePrefix: {
    paddingLeft: 16,
    paddingRight: 8,
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
  },
  phoneInput: {
    flex: 1,
    height: '100%',
    paddingLeft: 0,
    paddingRight: 16,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
  },
  errorText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginLeft: 2,
  },
  bottom: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  row: { flexDirection: 'row', justifyContent: 'center' },
  hint: { fontSize: 14, fontFamily: 'Inter_400Regular' },
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
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
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
    fontSize: 24,
  },
  countryOptionText: {
    flex: 1,
    gap: 2,
  },
  countryOptionName: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
  },
  countryOptionCode: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
});
