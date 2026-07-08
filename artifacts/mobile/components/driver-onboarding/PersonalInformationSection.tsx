import { AppText } from '@/components/AppText';
import React from 'react';
import { Image, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { DatePickerField } from '@/components/DatePickerField';
import { AppInput } from '@/components/AppInput';
import type { useColors } from '@/hooks/useColors';
import type { User } from '@/types';
import type { CascadeField, DriverOnboardingForm } from '@/hooks/driver-onboarding/onboardingTypes';
import { RWANDA_PROVINCES, getDistricts, getSectors, getCells, getVillages } from '@/data/rwanda-locations';
import { CascadeDropdown } from './CascadeDropdown';
import { styles } from './onboardingStyles';

export function PersonalInformationSection({ colors, errors, form, maxDobDate, selfieUri, takeSelfie, update, updateCascade, user }: {
  colors: ReturnType<typeof useColors>; errors: Record<string, string>; form: DriverOnboardingForm; maxDobDate: Date;
  selfieUri: string | null; takeSelfie: () => Promise<void>; update: (field: string, value: string) => void;
  updateCascade: (field: CascadeField, value: string) => void; user: User | null;
}) {
  const districts = getDistricts(form.province);
  const sectors = getSectors(form.province, form.district);
  const cells = getCells(form.province, form.district, form.sector);
  const villages = getVillages(form.province, form.district, form.sector, form.cell);
  const error = (field: string) => errors[field] ? <AppText style={[styles.errorText, { color: colors.destructive }]}>{errors[field]}</AppText> : null;

  return <View style={styles.section}>
    <AppText style={[styles.sectionTitle, { color: colors.foreground }]}>Personal Information</AppText>
    <AppText style={[styles.sectionDesc, { color: colors.mutedForeground }]}>Details pre-filled from your account</AppText>
    <View style={[styles.infoRow, { backgroundColor: colors.card, borderColor: colors.border }]}><AppText style={[styles.infoLabel, { color: colors.mutedForeground }]}>Full Name</AppText><AppText style={[styles.infoValue, { color: colors.foreground }]}>{user?.name}</AppText></View>
    <View style={[styles.infoRow, { backgroundColor: colors.card, borderColor: colors.border }]}><AppText style={[styles.infoLabel, { color: colors.mutedForeground }]}>Phone</AppText><AppText style={[styles.infoValue, { color: colors.foreground }]}>{user?.phone}</AppText></View>
    <DatePickerField label="Date of Birth" value={form.dob} onChange={dob => update('dob', dob)} error={errors.dob} placeholder="DD/MM/YYYY" maximumDate={maxDobDate} />
    <AppInput label="National ID Number" placeholder="16-digit National ID" value={form.nationalId} onChangeText={text => update('nationalId', text.replace(/\D/g, '').slice(0, 16))} error={errors.nationalId} leftIcon="credit-card" keyboardType="numeric" maxLength={16} />
    <View style={{ gap: 6 }}>
      <AppText style={[styles.sectionSubtitle, { color: colors.foreground }]}>Gender</AppText>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(['male', 'female', 'other'] as const).map(g => {
          const selected = form.gender === g;
          return (
            <TouchableOpacity key={g} onPress={() => update('gender', g)} activeOpacity={0.8}
              accessibilityRole="radio" accessibilityState={{ selected }}
              style={{ flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, alignItems: 'center',
                backgroundColor: selected ? colors.primary : colors.card,
                borderColor: selected ? colors.primary : colors.border }}>
              <AppText style={{ color: selected ? colors.primaryForeground : colors.foreground, textTransform: 'capitalize' }}>{g}</AppText>
            </TouchableOpacity>
          );
        })}
      </View>
      {error('gender')}
    </View>
    <AppText style={[styles.sectionSubtitle, { color: colors.foreground }]}>Identity Verification</AppText>
    <AppText style={[styles.sectionDesc, { color: colors.mutedForeground }]}>Take a clear selfie so we can verify your identity.</AppText>
    {selfieUri ? <View style={styles.selfiePreviewRow}><Image source={{ uri: selfieUri }} style={styles.selfieImage} resizeMode="cover" /><View style={{ flex: 1, gap: 8 }}><View style={[styles.docUploaded, { backgroundColor: colors.primaryHex + '15', borderColor: colors.primaryHex + '30' }]}><Feather name="check-circle" size={14} color={colors.primary} /><AppText style={[styles.docUploadedText, { color: colors.primary }]}>Photo taken</AppText></View><TouchableOpacity style={[styles.selfieRetakeBtn, { borderColor: colors.border, backgroundColor: colors.card }]} onPress={takeSelfie}><Feather name="camera" size={14} color={colors.mutedForeground} /><AppText style={[styles.docChangeBtnText, { color: colors.mutedForeground }]}>Retake selfie</AppText></TouchableOpacity></View></View>
      : <TouchableOpacity style={[styles.selfieBtn, { borderColor: errors.selfie ? colors.destructive : colors.primary, backgroundColor: colors.primaryHex + '08' }]} onPress={takeSelfie} activeOpacity={0.75}><View style={[styles.selfieIconCircle, { backgroundColor: colors.primaryHex + '20' }]}><Feather name="camera" size={24} color={colors.primary} /></View><AppText style={[styles.selfieLabel, { color: colors.primary }]}>Take Selfie</AppText></TouchableOpacity>}
    {error('selfie')}
    <AppText style={[styles.sectionSubtitle, { color: colors.foreground }]}>Location</AppText>
    <AppText style={[styles.sectionDesc, { color: colors.mutedForeground }]}>Select your operating area using Rwanda's official administrative hierarchy</AppText>
    <CascadeDropdown label="Province / City" value={form.province} options={RWANDA_PROVINCES.map(province => province.name)} onSelect={value => updateCascade('province', value)} />{error('province')}
    {form.province ? <><CascadeDropdown label="District" value={form.district} options={districts.map(district => district.name)} onSelect={value => updateCascade('district', value)} />{error('district')}</> : null}
    {form.district ? <><CascadeDropdown label="Sector" value={form.sector} options={sectors.map(sector => sector.name)} onSelect={value => updateCascade('sector', value)} />{error('sector')}</> : null}
    {form.sector ? <><CascadeDropdown label="Cell" value={form.cell} options={cells.map(cell => cell.name)} onSelect={value => updateCascade('cell', value)} />{error('cell')}</> : null}
    {form.cell ? <><CascadeDropdown label="Village" value={form.village} options={villages} onSelect={value => updateCascade('village', value)} />{error('village')}</> : null}
  </View>;
}
