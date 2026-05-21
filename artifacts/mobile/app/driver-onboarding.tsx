import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@expo/vector-icons';
import { KandaButton } from '@/components/KandaButton';
import { KandaInput } from '@/components/KandaInput';
import { VehicleCard } from '@/components/VehicleCard';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { DriverProfile, VehicleType } from '@/types';
import {
  RWANDA_PROVINCES,
  getDistricts,
  getSectors,
  getCells,
  getVillages,
} from '@/data/rwanda-locations';

const RWANDAN_PLATE_PATTERNS = [
  { regex: /^R[A-Z]{2}\s\d{3}\s[A-Z]$/, label: 'Private: RAA 000 A' },
  { regex: /^RAC\s\d{3}\s[A-Z]$/, label: 'Commercial: RAC 000 A' },
  { regex: /^RAD\s\d{3}\s[A-Z]$/, label: 'Motorcycle: RAD 000 A' },
];

function validatePlate(plate: string): { valid: boolean; warning?: string } {
  const cleaned = plate.trim().toUpperCase();
  const matched = RWANDAN_PLATE_PATTERNS.some(p => p.regex.test(cleaned));
  if (!cleaned) return { valid: false };
  if (matched) return { valid: true };
  return { valid: true, warning: 'Format not matched — please verify it matches Rwanda plate standards.' };
}

type DocumentKey = 'license' | 'insurance' | 'authorization';
const DOCS: { key: DocumentKey; label: string; hint: string }[] = [
  { key: 'license', label: "Driver's Licence (front face)", hint: 'JPEG, PNG or PDF' },
  { key: 'insurance', label: 'Vehicle Insurance document', hint: 'JPEG, PNG or PDF' },
  { key: 'authorization', label: 'Vehicle Authorization / Inspection certificate', hint: 'JPEG, PNG or PDF' },
];

const VEHICLE_QUESTIONS: Record<VehicleType, { field: string; label: string; placeholder: string; keyboardType?: 'numeric' }[]> = {
  moto: [],
  cab: [{ field: 'passengerSeats', label: 'How many passenger seats does your vehicle have?', placeholder: 'e.g. 4', keyboardType: 'numeric' }],
  hilux: [{ field: 'passengerSeats', label: 'How many passenger seats does your vehicle have?', placeholder: 'e.g. 5', keyboardType: 'numeric' }],
  fuso: [{ field: 'loadCapacityKg', label: 'Maximum load capacity (kg)', placeholder: 'e.g. 5000', keyboardType: 'numeric' }],
};

type CascadeField = 'province' | 'district' | 'sector' | 'cell' | 'village';

interface DropdownProps {
  label: string;
  value: string;
  options: string[];
  onSelect: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

function CascadeDropdown({ label, value, options, onSelect, disabled, placeholder }: DropdownProps) {
  const colors = useColors();
  const [open, setOpen] = useState(false);

  return (
    <View style={{ gap: 6 }}>
      <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <TouchableOpacity
        style={[
          styles.dropdown,
          {
            borderColor: disabled ? colors.border + '50' : value ? colors.primary : colors.border,
            backgroundColor: disabled ? colors.muted + '60' : colors.card,
            opacity: disabled ? 0.6 : 1,
          },
        ]}
        onPress={() => { if (!disabled) setOpen(o => !o); }}
        activeOpacity={0.7}
      >
        <Text style={[styles.dropdownText, { color: value ? colors.foreground : colors.mutedForeground }]}>
          {value || placeholder || `Select ${label}`}
        </Text>
        <Feather name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.mutedForeground} />
      </TouchableOpacity>
      {open && options.length > 0 && (
        <View style={[styles.dropdownList, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
            {options.map(opt => (
              <TouchableOpacity
                key={opt}
                style={[styles.dropdownItem, { borderBottomColor: colors.border }]}
                onPress={() => { onSelect(opt); setOpen(false); }}
              >
                <Text style={[
                  styles.dropdownItemText,
                  { color: opt === value ? colors.primary : colors.foreground },
                ]}>
                  {opt}
                </Text>
                {opt === value && <Feather name="check" size={14} color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

export default function DriverOnboarding() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, saveDriverProfile } = useAuth();

  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    vehicleType: 'moto' as VehicleType,
    plateNumber: '',
    licenseNumber: '',
    dob: '',
    province: '',
    district: '',
    sector: '',
    cell: '',
    village: '',
    momoProvider: 'mtn' as 'mtn' | 'airtel',
    momoCode: '',
    passengerSeats: '',
    loadCapacityKg: '',
  });
  const [docs, setDocs] = useState<Record<DocumentKey, string | null>>({
    license: null,
    insurance: null,
    authorization: null,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [plateWarning, setPlateWarning] = useState('');
  const [loading, setLoading] = useState(false);

  const update = (field: string, val: string) => {
    setForm(f => ({ ...f, [field]: val }));
    setErrors(e => ({ ...e, [field]: '' }));
  };

  const updateCascade = (field: CascadeField, val: string) => {
    const resets: Partial<typeof form> = {};
    if (field === 'province') resets.district = resets.sector = resets.cell = resets.village = '';
    if (field === 'district') resets.sector = resets.cell = resets.village = '';
    if (field === 'sector') resets.cell = resets.village = '';
    if (field === 'cell') resets.village = '';
    setForm(f => ({ ...f, ...resets, [field]: val }));
    setErrors(e => ({ ...e, [field]: '' }));
  };

  const handlePlateChange = (text: string) => {
    const upper = text.toUpperCase();
    update('plateNumber', upper);
    if (upper.length >= 5) {
      const { warning } = validatePlate(upper);
      setPlateWarning(warning ?? '');
    } else {
      setPlateWarning('');
    }
  };

  const pickDocument = async (key: DocumentKey) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow photo access to upload documents.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      setDocs(d => ({ ...d, [key]: result.assets[0].uri }));
      setErrors(e => ({ ...e, [key]: '' }));
    }
  };

  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {};
    if (step === 0) {
      if (!form.dob) e.dob = 'Required';
      if (!form.province) e.province = 'Required';
      if (!form.district) e.district = 'Required';
      if (!form.sector) e.sector = 'Required';
      if (!form.cell) e.cell = 'Required';
      if (!form.village) e.village = 'Required';
    }
    if (step === 1) {
      if (!form.plateNumber) e.plateNumber = 'Required';
      if (!form.licenseNumber) e.licenseNumber = 'Required';
      if (form.vehicleType === 'cab' || form.vehicleType === 'hilux') {
        if (!form.passengerSeats || parseInt(form.passengerSeats) < 1) e.passengerSeats = 'Enter number of passenger seats';
      }
      if (form.vehicleType === 'fuso') {
        if (!form.loadCapacityKg || parseInt(form.loadCapacityKg) < 1) e.loadCapacityKg = 'Enter load capacity in kg';
      }
    }
    if (step === 2) {
      if (!docs.license) e.license = 'Driver\'s licence photo is required';
      if (!docs.insurance) e.insurance = 'Insurance document is required';
      if (!docs.authorization) e.authorization = 'Authorization certificate is required';
    }
    if (step === 3) {
      if (!form.momoCode) e.momoCode = 'Required';
      if (form.momoCode && form.momoCode.replace(/\D/g, '').length < 9) e.momoCode = 'Enter a valid phone number';
    }
    return e;
  };

  const handleNext = () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    if (step < 3) {
      setStep(s => s + 1);
    } else {
      saveAndContinue();
    }
  };

  const saveAndContinue = async () => {
    setLoading(true);
    const profile: DriverProfile = {
      vehicleType: form.vehicleType,
      plateNumber: form.plateNumber,
      licenseNumber: form.licenseNumber,
      province: form.province,
      district: form.district,
      sector: form.sector,
      momoCode: form.momoCode,
      momoProvider: form.momoProvider,
      dob: form.dob,
      isOnline: false,
      isVerified: false,
      acceptanceRate: 100,
      completedRides: 0,
      dailyRides: 0,
      dailyDeclines: 0,
      policyAccepted: false,
      earningsTotal: 0,
      passengerSeats: form.passengerSeats ? parseInt(form.passengerSeats) : undefined,
      loadCapacityKg: form.loadCapacityKg ? parseInt(form.loadCapacityKg) : undefined,
    };
    await saveDriverProfile(profile);
    setLoading(false);
    router.push('/driver-policy');
  };

  const steps = ['Personal Info', 'Vehicle Info', 'Documents', 'Payment'];

  const districts = getDistricts(form.province);
  const sectors = getSectors(form.province, form.district);
  const cells = getCells(form.province, form.district, form.sector);
  const villages = getVillages(form.province, form.district, form.sector, form.cell);
  const vehicleQuestions = VEHICLE_QUESTIONS[form.vehicleType];

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.header, {
        paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 0) + 16,
        borderBottomColor: colors.border,
      }]}>
        <TouchableOpacity onPress={() => step > 0 ? setStep(s => s - 1) : router.back()}>
          <Feather name="arrow-left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Become a Driver</Text>
        <Text style={[styles.stepIndicator, { color: colors.mutedForeground }]}>{step + 1}/{steps.length}</Text>
      </View>

      <View style={styles.stepsRow}>
        {steps.map((s, i) => (
          <View key={i} style={[styles.stepItem, { flex: 1 }]}>
            <View style={[styles.stepDot, { backgroundColor: i <= step ? colors.primary : colors.border }]} />
            <Text style={[styles.stepLabel, { color: i <= step ? colors.primary : colors.mutedForeground }]}>{s}</Text>
          </View>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {step === 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Personal Information</Text>
            <Text style={[styles.sectionDesc, { color: colors.mutedForeground }]}>
              Details pre-filled from your account
            </Text>

            <View style={[styles.infoRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Full Name</Text>
              <Text style={[styles.infoValue, { color: colors.foreground }]}>{user?.name}</Text>
            </View>
            <View style={[styles.infoRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Phone</Text>
              <Text style={[styles.infoValue, { color: colors.foreground }]}>{user?.phone}</Text>
            </View>

            <KandaInput
              label="Date of Birth"
              placeholder="DD/MM/YYYY"
              value={form.dob}
              onChangeText={t => update('dob', t)}
              error={errors.dob}
              leftIcon="calendar"
              keyboardType="number-pad"
            />

            <Text style={[styles.sectionSubtitle, { color: colors.foreground }]}>Location</Text>
            <Text style={[styles.sectionDesc, { color: colors.mutedForeground }]}>
              Select your operating area using Rwanda's administrative hierarchy
            </Text>

            <CascadeDropdown
              label="Province"
              value={form.province}
              options={RWANDA_PROVINCES.map(p => p.name)}
              onSelect={v => updateCascade('province', v)}
            />
            {errors.province ? <Text style={[styles.errorText, { color: colors.destructive }]}>{errors.province}</Text> : null}

            {form.province ? (
              <>
                <CascadeDropdown
                  label="District"
                  value={form.district}
                  options={districts.map(d => d.name)}
                  onSelect={v => updateCascade('district', v)}
                />
                {errors.district ? <Text style={[styles.errorText, { color: colors.destructive }]}>{errors.district}</Text> : null}
              </>
            ) : null}

            {form.district ? (
              <>
                <CascadeDropdown
                  label="Sector"
                  value={form.sector}
                  options={sectors.map(s => s.name)}
                  onSelect={v => updateCascade('sector', v)}
                />
                {errors.sector ? <Text style={[styles.errorText, { color: colors.destructive }]}>{errors.sector}</Text> : null}
              </>
            ) : null}

            {form.sector ? (
              <>
                <CascadeDropdown
                  label="Cell"
                  value={form.cell}
                  options={cells.map(c => c.name)}
                  onSelect={v => updateCascade('cell', v)}
                />
                {errors.cell ? <Text style={[styles.errorText, { color: colors.destructive }]}>{errors.cell}</Text> : null}
              </>
            ) : null}

            {form.cell ? (
              <>
                <CascadeDropdown
                  label="Village"
                  value={form.village}
                  options={villages}
                  onSelect={v => update('village', v)}
                />
                {errors.village ? <Text style={[styles.errorText, { color: colors.destructive }]}>{errors.village}</Text> : null}
              </>
            ) : null}
          </View>
        )}

        {step === 1 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Vehicle Information</Text>
            <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>Vehicle Type</Text>
            <View style={styles.vehicleGrid}>
              {(['moto', 'cab', 'hilux', 'fuso'] as VehicleType[]).map(v => (
                <VehicleCard
                  key={v}
                  type={v}
                  selected={form.vehicleType === v}
                  onSelect={() => { update('vehicleType', v); setErrors(e => ({ ...e, passengerSeats: '', loadCapacityKg: '' })); }}
                  compact
                />
              ))}
            </View>

            {vehicleQuestions.map(q => (
              <KandaInput
                key={q.field}
                label={q.label}
                placeholder={q.placeholder}
                value={form[q.field as keyof typeof form] as string}
                onChangeText={t => update(q.field, t.replace(/\D/g, ''))}
                error={errors[q.field]}
                leftIcon="info"
                keyboardType="numeric"
              />
            ))}

            <View>
              <KandaInput
                label="Plate Number"
                placeholder="RAD 000 A"
                value={form.plateNumber}
                onChangeText={handlePlateChange}
                error={errors.plateNumber}
                leftIcon="hash"
                autoCapitalize="characters"
              />
              {form.plateNumber.length > 0 && (
                <View style={styles.plateGuide}>
                  <Feather name="info" size={12} color={colors.mutedForeground} />
                  <Text style={[styles.plateGuideText, { color: colors.mutedForeground }]}>
                    Rwanda formats: RAD 000 A (Moto) · RAC 000 A (Commercial) · RAA 000 A (Private)
                  </Text>
                </View>
              )}
              {plateWarning ? (
                <View style={[styles.plateWarning, { backgroundColor: '#FF950015', borderColor: '#FF950040' }]}>
                  <Feather name="alert-triangle" size={12} color="#FF9500" />
                  <Text style={[styles.plateWarningText, { color: '#FF9500' }]}>{plateWarning}</Text>
                </View>
              ) : null}
            </View>

            <KandaInput
              label="Driver Licence Number"
              placeholder="DL-0000000"
              value={form.licenseNumber}
              onChangeText={t => update('licenseNumber', t)}
              error={errors.licenseNumber}
              leftIcon="credit-card"
              autoCapitalize="characters"
            />
          </View>
        )}

        {step === 2 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Document Uploads</Text>
            <Text style={[styles.sectionDesc, { color: colors.mutedForeground }]}>
              All documents are required. Accepted formats: JPEG, PNG, PDF.
            </Text>

            {DOCS.map(doc => (
              <View key={doc.key} style={styles.docRow}>
                <View style={styles.docHeader}>
                  <Text style={[styles.docLabel, { color: colors.foreground }]}>
                    {doc.label}
                    <Text style={{ color: colors.destructive }}> *</Text>
                  </Text>
                  <Text style={[styles.docHint, { color: colors.mutedForeground }]}>{doc.hint}</Text>
                </View>

                {docs[doc.key] ? (
                  <View style={styles.docPreviewRow}>
                    <Image source={{ uri: docs[doc.key]! }} style={styles.docThumb} resizeMode="cover" />
                    <View style={{ flex: 1, gap: 6 }}>
                      <View style={[styles.docUploaded, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '30' }]}>
                        <Feather name="check-circle" size={14} color={colors.primary} />
                        <Text style={[styles.docUploadedText, { color: colors.primary }]}>Uploaded</Text>
                      </View>
                      <TouchableOpacity
                        style={[styles.docChangeBtn, { borderColor: colors.border }]}
                        onPress={() => pickDocument(doc.key)}
                      >
                        <Text style={[styles.docChangeBtnText, { color: colors.mutedForeground }]}>Change</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.docUploadBtn, {
                      borderColor: errors[doc.key] ? colors.destructive : colors.border,
                      backgroundColor: colors.card,
                    }]}
                    onPress={() => pickDocument(doc.key)}
                  >
                    <Feather name="upload" size={20} color={colors.primary} />
                    <Text style={[styles.docUploadText, { color: colors.primary }]}>Tap to upload</Text>
                  </TouchableOpacity>
                )}
                {errors[doc.key] ? <Text style={[styles.errorText, { color: colors.destructive }]}>{errors[doc.key]}</Text> : null}
              </View>
            ))}
          </View>
        )}

        {step === 3 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Payment Setup</Text>
            <Text style={[styles.sectionDesc, { color: colors.mutedForeground }]}>
              Choose how you want to receive your earnings. Only one method is required.
            </Text>

            <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>Payment Provider</Text>
            <View style={styles.providerRow}>
              {(['mtn', 'airtel'] as const).map(provider => (
                <TouchableOpacity
                  key={provider}
                  style={[styles.providerCard, {
                    backgroundColor: form.momoProvider === provider ? colors.primary + '15' : colors.card,
                    borderColor: form.momoProvider === provider ? colors.primary : colors.border,
                  }]}
                  onPress={() => update('momoProvider', provider)}
                >
                  <Text style={{ fontSize: 28 }}>{provider === 'mtn' ? '🟡' : '🔴'}</Text>
                  <Text style={[styles.providerName, { color: colors.foreground }]}>
                    {provider === 'mtn' ? 'MTN MoMo' : 'Airtel Money'}
                  </Text>
                  {form.momoProvider === provider && (
                    <View style={[styles.providerCheck, { backgroundColor: colors.primary }]}>
                      <Feather name="check" size={12} color={colors.primaryForeground} />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            <KandaInput
              label={form.momoProvider === 'mtn' ? 'MTN MoMo Phone Number' : 'Airtel Money Phone Number'}
              placeholder="250XXXXXXXXX"
              value={form.momoCode}
              onChangeText={t => update('momoCode', t.replace(/\D/g, ''))}
              error={errors.momoCode}
              leftIcon="smartphone"
              keyboardType="phone-pad"
            />

          </View>
        )}

        <KandaButton
          title={step < 3 ? 'Continue' : 'Review Terms & Policies'}
          onPress={handleNext}
          fullWidth
          size="lg"
          loading={loading}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 18, fontFamily: 'Inter_600SemiBold' },
  stepIndicator: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  vehicleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  stepItem: { alignItems: 'center', gap: 4 },
  stepDot: { width: 8, height: 8, borderRadius: 4 },
  stepLabel: { fontSize: 9, fontFamily: 'Inter_500Medium' },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  section: { gap: 14 },
  sectionTitle: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  sectionSubtitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold', marginTop: 4 },
  sectionDesc: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 20 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  infoLabel: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  infoValue: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  inputLabel: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
  },
  dropdownText: { fontSize: 15, fontFamily: 'Inter_400Regular', flex: 1 },
  dropdownList: {
    borderWidth: 1,
    borderRadius: 12,
    marginTop: 2,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  dropdownItemText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  errorText: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: -8 },
  plateGuide: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 6,
    paddingHorizontal: 2,
  },
  plateGuideText: { flex: 1, fontSize: 11, fontFamily: 'Inter_400Regular', lineHeight: 16 },
  plateWarning: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'flex-start',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 4,
  },
  plateWarningText: { flex: 1, fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 16 },
  docRow: { gap: 8 },
  docHeader: { gap: 2 },
  docLabel: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  docHint: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  docUploadBtn: {
    height: 80,
    borderWidth: 1.5,
    borderRadius: 14,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  docUploadText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  docPreviewRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  docThumb: { width: 70, height: 70, borderRadius: 10 },
  docUploaded: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  docUploadedText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  docChangeBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
  },
  docChangeBtnText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  providerRow: { flexDirection: 'row', gap: 12 },
  providerCard: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    position: 'relative',
  },
  providerName: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  providerCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notice: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'flex-start',
  },
  noticeText: { flex: 1, fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 18 },
});
