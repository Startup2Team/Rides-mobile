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
import { AppButton } from '@/components/AppButton';
import { FORM_BOTTOM_PADDING } from '@/constants/tabBar';
import { useToast } from '@/context/ToastContext';
import { useColors } from '@/hooks/useColors';
import { BRAND_GREEN_HEX } from '@/constants/systemColors';

import { loadStoredPaymentMethods, saveStoredPaymentMethods } from '@/persistence/paymentPersistence';
import type { PaymentMethod, PaymentProvider } from '@/types';
import { typography } from '@/constants/typography';
import { duration } from '@/constants/motion';
import { icons } from '@/constants/icons';
import { radius } from '@/constants/radius';
import { sizes } from '@/constants/sizes';
import { spacing, semanticSpacing } from '@/constants/spacing';

const PROVIDER_META: Record<PaymentProvider, { name: string; color: string; icon: string }> = {
  mtn: { name: 'MTN Mobile Money', color: '#FFCC00', icon: 'smartphone' },
  airtel: { name: 'Airtel Money', color: '#FF0000', icon: 'smartphone' },
  cash: { name: 'Cash', color: BRAND_GREEN_HEX.light, icon: 'pocket' },
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
    mtn: '7xxxxxxxx',
    airtel: '7xxxxxxxx',
  };
  const [methods, setMethods] = useState<PaymentMethod[]>(DEFAULT_METHODS);
  const [adding, setAdding] = useState<PaymentProvider | null>(null);
  const [phoneInput, setPhoneInput] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadStoredPaymentMethods().then(stored => {
      if (stored.data) setMethods(stored.data);
    });
  }, []);

  const persist = async (updated: PaymentMethod[]) => {
    setMethods(updated);
    await saveStoredPaymentMethods(updated);
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
      {
        text: 'Remove',
        onPress: async () => {
          await persist(methods.filter(m => m.id !== id));
          showToast('Payment method removed', 'error');
        },
      },
      { text: 'Cancel', style: 'cancel' },
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
          indicatorBottom={insets.bottom + spacing[64]}
          contentContainerStyle={[
            styles.scroll,
            {
              paddingTop: headerMetrics.contentTop,
              paddingBottom: insets.bottom + (adding ? 1 : FORM_BOTTOM_PADDING),
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
                    <Feather name={meta.icon as any} size={icons.semantic.row} color={meta.color} />
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
                        <Feather name="trash-2" size={icons.semantic.button} color={colors.destructive} />
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
                    }, duration.modal);
                  }
                }}
                activeOpacity={0.75}
              >
                <View style={styles.methodIcon}>
                  <Feather name="smartphone" size={icons.semantic.row} color={meta.color} />
                </View>
                <Text style={[styles.addCardLabel, { color: colors.foreground }]}>{meta.name}</Text>
                <Feather
                  name={isOpen ? 'chevron-up' : 'chevron-down'}
                  size={icons.semantic.row}
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
                  <AppButton
                    title={saving ? 'Adding…' : 'Add ' + meta.name}
                    onPress={() => handleAddMoMo(provider)}
                    loading={saving}
                    fullWidth
                    size="md"
                    style={{ marginTop: semanticSpacing.rowGap }}
                  />
                </View>
              )}
            </View>
          );
        })}
        </GlassScrollView>
      </KeyboardAvoidingView>

      <View style={[styles.infoBox, { paddingBottom: insets.bottom + semanticSpacing.comfortableGap }]}>
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
  scroll: { padding: semanticSpacing.screenPadding, gap: spacing[0] },
  sectionLabel: {
    ...typography.tiny,
    fontFamily: typography.title.fontFamily,
    letterSpacing: 0.8,
    marginBottom: spacing[10],
    marginTop: semanticSpacing.sectionGap,
  },
  card: {
    borderRadius: radius['2xl'],
    borderWidth: 1,
    overflow: 'hidden',
  },
  methodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: semanticSpacing.listItemPadding,
    gap: semanticSpacing.rowGap,
  },
  methodIcon: {
    width: sizes.avatar.md,
    height: sizes.avatar.md,
    borderRadius: radius.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodLabel: { ...typography.bodySmall, fontFamily: typography.label.fontFamily},
  methodPhone: { ...typography.label, fontFamily: typography.body.fontFamily, marginTop: spacing[2] },
  defaultBadge: { ...typography.tiny, fontFamily: typography.title.fontFamily, marginTop: spacing[2] },
  methodActions: { flexDirection: 'row', alignItems: 'center', gap: semanticSpacing.rowGap },
  radioOuter: {
    width: spacing[20],
    height: spacing[20],
    borderRadius: radius.md,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: { width: 10, height: 10, borderRadius: 5 },
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: semanticSpacing.listItemPadding },
  addCard: {
    borderRadius: radius['2xl'],
    borderWidth: 1,
    marginBottom: spacing[10],
    overflow: 'hidden',
  },
  addCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: semanticSpacing.listItemPadding,
    gap: semanticSpacing.rowGap,
  },
  addCardLabel: { flex: 1, ...typography.bodySmall, fontFamily: typography.label.fontFamily},
  addCardBody: { paddingHorizontal: semanticSpacing.listItemPadding, paddingBottom: semanticSpacing.listItemPadding },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    height: sizes.input.md,
    overflow: 'hidden',
  },
  countryCode: { paddingHorizontal: semanticSpacing.listItemPadding, ...typography.body, fontFamily: typography.title.fontFamily},
  inputDivider: { width: 1, height: '60%' },
  phoneInput: { flex: 1, paddingHorizontal: semanticSpacing.rowGap, ...typography.body, fontFamily: typography.body.fontFamily, height: '100%' },
  infoBox: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: semanticSpacing.inlineGap,
    paddingHorizontal: semanticSpacing.screenPadding,
    paddingTop: semanticSpacing.rowGap,
    alignItems: 'flex-start',
  },
  infoText: { flex: 1, ...typography.caption, fontFamily: typography.body.fontFamily, lineHeight: 18 },
});
