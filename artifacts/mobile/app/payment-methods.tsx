import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { GlassHeader, useGlassHeaderMetrics } from '@/components/GlassHeader';
import { GlassScrollView } from '@/components/GlassScrollView';
import { KandaButton } from '@/components/KandaButton';
import { useToast } from '@/context/ToastContext';
import { useColors } from '@/hooks/useColors';
import { TARAVELIS_BRAND_GREEN_HEX } from '@/constants/systemColors';

const PAYMENT_STORAGE_KEY = '@taravelis_payment_methods';

type PaymentProvider = 'mtn' | 'airtel' | 'cash';

interface PaymentMethod {
  id: string;
  provider: PaymentProvider;
  label: string;
  phoneNumber?: string;
  isDefault: boolean;
}

const PROVIDER_META: Record<PaymentProvider, { name: string; color: string; icon: string }> = {
  mtn: { name: 'MTN Mobile Money', color: '#FFCC00', icon: 'smartphone' },
  airtel: { name: 'Airtel Money', color: '#FF0000', icon: 'smartphone' },
  cash: { name: 'Cash', color: TARAVELIS_BRAND_GREEN_HEX.light, icon: 'pocket' },
};

const DEFAULT_METHODS: PaymentMethod[] = [
  { id: 'cash_default', provider: 'cash', label: 'Pay with Cash', isDefault: true },
];

function normalizeRwandaMobileNumber(value: string) {
  const digits = value.replace(/\D/g, '');
  if (digits.startsWith('250')) return digits.slice(3);
  if (digits.startsWith('0')) return digits.slice(1);
  return digits;
}

function formatRwandaMobileNumber(value?: string) {
  if (!value) return null;
  const normalized = normalizeRwandaMobileNumber(value);
  if (!normalized) return null;
  return `+250${normalized}`;
}

function getMethodPhoneNumber(method: PaymentMethod) {
  return formatRwandaMobileNumber(method.phoneNumber) ?? formatRwandaMobileNumber(method.label);
}

function isValidProviderNumber(provider: PaymentProvider, phoneNumber: string) {
  if (provider === 'mtn') return /^7[89]\d{7}$/.test(phoneNumber);
  if (provider === 'airtel') return /^7[23]\d{7}$/.test(phoneNumber);
  return false;
}

export default function PaymentMethodsScreen() {
  const colors = useColors();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const headerMetrics = useGlassHeaderMetrics();

  const scrollRef = useRef<ScrollView>(null);
  const phoneInputRef = useRef<TextInput>(null);

  const PROVIDER_PLACEHOLDER: Record<'mtn' | 'airtel', string> = {
    mtn: '7x xxx xxxx',
    airtel: '7x xxx xxxx',
  };
  const [methods, setMethods] = useState<PaymentMethod[]>(DEFAULT_METHODS);
  const [adding, setAdding] = useState<PaymentProvider | null>(null);
  const [phoneInput, setPhoneInput] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(PAYMENT_STORAGE_KEY).then(raw => {
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as PaymentMethod[];
          setMethods(parsed);
        } catch {}
      }
    });
  }, []);

  const persist = async (updated: PaymentMethod[]) => {
    setMethods(updated);
    await AsyncStorage.setItem(PAYMENT_STORAGE_KEY, JSON.stringify(updated));
  };

  const handleSetDefault = async (id: string) => {
    if (methods.find(m => m.id === id)?.isDefault) return;
    const updated = methods.map(m => ({ ...m, isDefault: m.id === id }));
    await persist(updated);
    showToast('Default payment updated', 'info');
  };

  const handleRemove = (id: string) => {
    const method = methods.find(m => m.id === id);
    if (method?.isDefault) {
      Alert.alert('Cannot remove', 'Set another method as default first.');
      return;
    }
    Alert.alert('Remove method', `Remove ${method?.label}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        onPress: async () => {
          await persist(methods.filter(m => m.id !== id));
          showToast('Payment method removed', 'error');
        },
      },
    ]);
  };

  const handleAddMoMo = async (provider: PaymentProvider) => {
    const normalizedPhone = normalizeRwandaMobileNumber(phoneInput);
    if (!isValidProviderNumber(provider, normalizedPhone)) {
      const validPrefixes = provider === 'mtn' ? '078 or 079' : '072 or 073';
      Alert.alert('Invalid number', `Enter a valid ${PROVIDER_META[provider].name} number starting with ${validPrefixes}.`);
      return;
    }
    setSaving(true);
    await new Promise(r => setTimeout(r, 400));

    const meta = PROVIDER_META[provider];
    const newMethod: PaymentMethod = {
      id: `${provider}_${Date.now()}`,
      provider,
      label: meta.name,
      phoneNumber: normalizedPhone,
      isDefault: methods.length === 0,
    };
    await persist([...methods, newMethod]);
    setSaving(false);
    setAdding(null);
    setPhoneInput('');
    showToast('Payment method added');
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <GlassHeader title="Payment Methods" subtitle="Manage how you pay" />

      <KeyboardAvoidingView
        style={styles.keyboardAvoiding}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <GlassScrollView
          ref={scrollRef}
          indicatorTop={headerMetrics.indicatorTop}
          indicatorBottom={insets.bottom + 64}
          contentContainerStyle={[
            styles.scroll,
            {
              paddingTop: headerMetrics.contentTop,
              paddingBottom: insets.bottom + (adding ? 1 : 88),
            },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          onContentSizeChange={() => {
            if (adding) scrollRef.current?.scrollToEnd({ animated: true });
          }}
        >
        {/* Saved methods */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>YOUR METHODS</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {methods.map((method, index) => {
            const meta = PROVIDER_META[method.provider];
            const methodPhoneNumber = getMethodPhoneNumber(method);
            return (
              <View key={method.id}>
                {index > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
                <TouchableOpacity
                  style={styles.methodRow}
                  onPress={() => handleSetDefault(method.id)}
                  activeOpacity={0.75}
                >
                  <View style={styles.methodIcon}>
                    <Feather name={meta.icon as any} size={18} color={meta.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.methodLabel, { color: colors.foreground }]}>
                      {method.provider === 'cash' ? method.label : meta.name}
                    </Text>
                    {methodPhoneNumber && (
                      <Text style={[styles.methodPhone, { color: colors.mutedForeground }]}>{methodPhoneNumber}</Text>
                    )}
                    {method.isDefault && (
                      <Text style={[styles.defaultBadge, { color: colors.primary }]}>Default</Text>
                    )}
                  </View>
                  <View style={styles.methodActions}>
                    <View
                      style={[
                        styles.radioOuter,
                        { borderColor: method.isDefault ? colors.primary : colors.border },
                      ]}
                    >
                      {method.isDefault && (
                        <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />
                      )}
                    </View>
                    {method.provider !== 'cash' && (
                      <TouchableOpacity
                        onPress={() => handleRemove(method.id)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Feather name="trash-2" size={16} color={colors.destructive} />
                      </TouchableOpacity>
                    )}
                  </View>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>

        {/* Add new */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>ADD PAYMENT METHOD</Text>

        {(['mtn', 'airtel'] as PaymentProvider[]).map(provider => {
          const meta = PROVIDER_META[provider];
          const isOpen = adding === provider;
          return (
            <View
              key={provider}
              style={[styles.addCard, { backgroundColor: colors.card, borderColor: isOpen ? colors.primary : colors.border }]}
            >
              <TouchableOpacity
                style={styles.addCardHeader}
                onPress={() => {
                  Haptics.selectionAsync();
                  const opening = !isOpen;
                  setAdding(opening ? provider : null);
                  setPhoneInput('');
                  if (opening) {
                    setTimeout(() => {
                      phoneInputRef.current?.focus();
                      scrollRef.current?.scrollToEnd({ animated: true });
                    }, 300);
                  }
                }}
                activeOpacity={0.75}
              >
                <View style={styles.methodIcon}>
                  <Feather name="smartphone" size={18} color={meta.color} />
                </View>
                <Text style={[styles.addCardLabel, { color: colors.foreground }]}>{meta.name}</Text>
                <Feather
                  name={isOpen ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={colors.mutedForeground}
                />
              </TouchableOpacity>

              {isOpen && (
                <View style={styles.addCardBody}>
                  <View style={[styles.phoneInputRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                    <Text style={[styles.countryCode, { color: colors.foreground }]}>+250</Text>
                    <View style={[styles.inputDivider, { backgroundColor: colors.border }]} />
                    <TextInput
                      ref={phoneInputRef}
                      style={[styles.phoneInput, { color: colors.foreground }]}
                      placeholder={PROVIDER_PLACEHOLDER[provider as 'mtn' | 'airtel']}
                      placeholderTextColor={colors.mutedForeground}
                      value={phoneInput}
                      onChangeText={setPhoneInput}
                      keyboardType="phone-pad"
                      maxLength={12}
                      onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150)}
                    />
                  </View>
                  <KandaButton
                    title={saving ? 'Adding…' : 'Add ' + meta.name}
                    onPress={() => handleAddMoMo(provider)}
                    loading={saving}
                    fullWidth
                    size="md"
                    style={{ marginTop: 12 }}
                  />
                </View>
              )}
            </View>
          );
        })}
        </GlassScrollView>
      </KeyboardAvoidingView>

      <View style={[styles.infoBox, { paddingBottom: insets.bottom + 16 }]}>
        <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
          Payments are processed securely. Your MoMo PIN is never stored.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  keyboardAvoiding: { flex: 1 },
  scroll: { padding: 20, gap: 0 },
  sectionLabel: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 24,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  methodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  methodIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodLabel: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  methodPhone: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 2 },
  defaultBadge: { fontSize: 11, fontFamily: 'Inter_600SemiBold', marginTop: 2 },
  methodActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: { width: 10, height: 10, borderRadius: 5 },
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: 14 },
  addCard: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 10,
    overflow: 'hidden',
  },
  addCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  addCardLabel: { flex: 1, fontSize: 14, fontFamily: 'Inter_500Medium' },
  addCardBody: { paddingHorizontal: 14, paddingBottom: 14 },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    height: 48,
    overflow: 'hidden',
  },
  countryCode: { paddingHorizontal: 14, fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  inputDivider: { width: 1, height: '60%' },
  phoneInput: { flex: 1, paddingHorizontal: 12, fontSize: 15, fontFamily: 'Inter_400Regular', height: '100%' },
  infoBox: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 12,
    alignItems: 'flex-start',
  },
  infoText: { flex: 1, fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 18 },
});
