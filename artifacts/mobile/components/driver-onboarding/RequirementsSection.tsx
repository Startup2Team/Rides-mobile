import { AppText } from '@/components/AppText';
import React from 'react';
import { Image, Linking, TextInput, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AppInput } from '@/components/AppInput';
import { PRIVACY_URL, TERMS_URL } from '@/constants/branding';
import type { useColors } from '@/hooks/useColors';
import type { DriverOnboardingForm } from '@/hooks/driver-onboarding/onboardingTypes';
import { PAYMENT_PROVIDER_LOGOS } from './onboardingData';
import { styles } from './onboardingStyles';
import { formatSubscriberDigits, rwandaPhoneToSubscriber } from '@/utils/rwandaValidation';

export function RequirementsSection({ acceptedTerms, colors, errors, form, setAcceptedTerms, setErrors, update }: {
  acceptedTerms: boolean; colors: ReturnType<typeof useColors>; errors: Record<string, string>; form: DriverOnboardingForm;
  setAcceptedTerms: React.Dispatch<React.SetStateAction<boolean>>; setErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  update: (field: string, value: string) => void;
}) {
  return <View style={styles.section}>
    <AppText style={[styles.sectionTitle, { color: colors.foreground }]}>Mobile Money Details</AppText>
    <AppText style={[styles.sectionDesc, { color: colors.mutedForeground }]}>Add the Mobile Money details you use for driver account records.</AppText>
    <AppText style={[styles.inputLabel, { color: colors.mutedForeground }]}>Mobile Money Provider</AppText>
    <View style={styles.providerRow}>{(['mtn', 'airtel'] as const).map(provider => <TouchableOpacity key={provider} style={[styles.providerCard, { backgroundColor: form.momoProvider === provider ? colors.primaryHex + '15' : colors.card, borderColor: form.momoProvider === provider ? colors.primary : colors.border }]} onPress={() => update('momoProvider', provider)}>
      <Image source={PAYMENT_PROVIDER_LOGOS[provider]} style={styles.providerLogo} resizeMode="contain" />
      <AppText style={[styles.providerName, { color: colors.foreground }]}>{provider === 'mtn' ? 'MTN MoMo' : 'Airtel Money'}</AppText>
      {form.momoProvider === provider && <View style={[styles.providerCheck, { backgroundColor: colors.primary }]}><Feather name="check" size={12} color={colors.primaryForeground} /></View>}
    </TouchableOpacity>)}</View>
    <AppInput label={form.momoProvider === 'mtn' ? 'MTN MoMo Phone Number' : 'Airtel Money Phone Number'} placeholder="7xxxxxxxx" value={formatSubscriberDigits(rwandaPhoneToSubscriber(form.momoCode))} onChangeText={text => {
      const digits = text.replace(/\D/g, '').slice(0, 9);
      update('momoCode', digits ? `+250${digits}` : '');
    }} error={errors.momoCode} keyboardType="phone-pad" maxLength={11} leftIcon="smartphone" leftLabel="+250" leftLabelDivider={false} />
    <AppInput label={form.momoProvider === 'mtn' ? 'MoMo Pay Code' : 'Airtel Merchant Code'} placeholder="e.g. 123456" value={form.merchantCode} onChangeText={text => update('merchantCode', text.toUpperCase().trimStart())} onBlur={() => update('merchantCode', form.merchantCode.trim().toUpperCase())} error={errors.merchantCode} leftIcon="briefcase" autoCapitalize="characters" />
    <TouchableOpacity style={styles.termsRow} onPress={() => { setAcceptedTerms(current => !current); setErrors(current => ({ ...current, acceptedTerms: '' })); }} activeOpacity={0.75}>
      <View style={[styles.termsCheckbox, { backgroundColor: acceptedTerms ? colors.primary : 'transparent', borderColor: acceptedTerms ? colors.primary : errors.acceptedTerms ? colors.destructive : colors.border }]}>{acceptedTerms && <Feather name="check" size={14} color={colors.primaryForeground} />}</View>
      <AppText style={[styles.termsText, { color: colors.foreground }]}>{'I agree to the '}<AppText style={[styles.termsLink, { color: colors.primary }]} onPress={() => Linking.openURL(TERMS_URL)}>Terms of Service</AppText>{' and '}<AppText style={[styles.termsLink, { color: colors.primary }]} onPress={() => Linking.openURL(PRIVACY_URL)}>Privacy Policy</AppText>.</AppText>
    </TouchableOpacity>
    {errors.acceptedTerms ? <AppText style={[styles.errorText, { color: colors.destructive }]}>{errors.acceptedTerms}</AppText> : null}
  </View>;
}
