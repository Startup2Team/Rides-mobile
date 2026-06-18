import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { AppButton } from '@/components/AppButton';
import { AppInput } from '@/components/AppInput';
import { DatePickerField } from '@/components/DatePickerField';
import { GlassHeader, useGlassHeaderMetrics } from '@/components/GlassHeader';
import { DocumentUploadSection } from '@/components/driver-onboarding/DocumentUploadSection';
import { useAuth } from '@/context/AuthContext';
import { appendDriverVehicle, buildDriverVehicleFromApplication, getVehicleById, resubmitDriverVehicleApplication } from '@/domain/driverVehicles';
import { buildInitialDriverDocuments } from '@/domain/driverDocuments';
import { useColors } from '@/hooks/useColors';
import { useDriverDocumentUpload } from '@/hooks/driver-onboarding/useDriverDocumentUpload';
import { INITIAL_DRIVER_DOCUMENTS, INITIAL_DRIVER_ONBOARDING_FORM, type DocFaces, type DocumentKey, type DriverOnboardingForm } from '@/hooks/driver-onboarding/onboardingTypes';
import { useDriverOnboardingForm } from '@/hooks/driver-onboarding/useDriverOnboardingForm';
import { isFutureExpiryDate, isValidDriverLicenceNumber } from '@/hooks/driver-onboarding/useDriverOnboardingValidation';
import { normalizeRwandaPlateNumber, isValidRwandaPlateNumber, isValidRwandaNationalId } from '@/utils/rwandaValidation';
import { isValidImageAsset } from '@/utils/documentValidation';
import { VEHICLE_LABELS, type VehicleType } from '@/types';

type VehiclePhotoKey = 'outside' | 'inside';

const REQUIRED_DOCUMENT_LABELS: Record<DocumentKey, { front: string; back?: string }> = {
  license: { front: 'Driver License Front', back: 'Driver License Back' },
  nationalId: { front: 'National ID Front', back: 'National ID Back' },
  insurance: { front: 'Vehicle Insurance Front' },
  authorization: { front: 'Authorization Certificate Front' },
};

const REQUIRED_PHOTO_LABELS: Record<VehiclePhotoKey, string> = {
  outside: 'Vehicle Outside Photo',
  inside: 'Vehicle Inside Photo',
};

function buildVehicleUploadDraftFromSource(source?: ReturnType<typeof getVehicleById>) {
  const docs = source?.documents;
  if (!docs) return INITIAL_DRIVER_DOCUMENTS;
  return {
    license: docs.license.faces,
    nationalId: docs.nationalId.faces,
    insurance: docs.insurance.faces,
    authorization: docs.authorization.faces,
  } satisfies Record<DocumentKey, DocFaces>;
}

function createVehicleFormFromSource(source?: ReturnType<typeof getVehicleById>) {
  return source
    ? {
        ...INITIAL_DRIVER_ONBOARDING_FORM,
        vehicleType: source.vehicleType,
        plateNumber: source.plateNumber,
        licenseNumber: source.licenseNumber,
        licenseExpiryDate: source.licenseExpiryDate ?? '',
        insuranceExpiryDate: source.insuranceExpiryDate ?? '',
        authorizationExpiryDate: source.authorizationExpiryDate ?? '',
        passengerSeats: source.passengerSeats?.toString() ?? '',
        loadCapacityKg: source.loadCapacityKg?.toString() ?? '',
      }
    : INITIAL_DRIVER_ONBOARDING_FORM;
}

function getMissingVehicleSubmissionItems(
  docs: Record<DocumentKey, DocFaces>,
  vehiclePhotos: Record<VehiclePhotoKey, string | null>,
) {
  const missing: string[] = [];

  (Object.keys(REQUIRED_DOCUMENT_LABELS) as DocumentKey[]).forEach(key => {
    if (!docs[key][0]) missing.push(REQUIRED_DOCUMENT_LABELS[key].front);
    if (REQUIRED_DOCUMENT_LABELS[key].back && !docs[key][1]) missing.push(REQUIRED_DOCUMENT_LABELS[key].back!);
  });

  (Object.keys(REQUIRED_PHOTO_LABELS) as VehiclePhotoKey[]).forEach(key => {
    if (!vehiclePhotos[key]) missing.push(REQUIRED_PHOTO_LABELS[key]);
  });

  return missing;
}

export default function DriverAddVehicleScreen() {
  const colors = useColors();
  const isDark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const headerMetrics = useGlassHeaderMetrics();
  const { driverProfile, saveDriverProfile } = useAuth();
  const params = useLocalSearchParams<{ sourceVehicleId?: string }>();
  const sourceVehicleId = typeof params.sourceVehicleId === 'string' ? params.sourceVehicleId : null;
  const sourceVehicle = getVehicleById(driverProfile, sourceVehicleId);
  const { form, setForm, update } = useDriverOnboardingForm();
  const { docs, pickDocument, setDocs, takeDocumentPhoto } = useDriverDocumentUpload(() => undefined);
  const nationalId = driverProfile?.nationalId ?? sourceVehicle?.documents?.nationalId.documentNumber ?? '';
  const [brand, setBrand] = React.useState(sourceVehicle?.brand ?? '');
  const [model, setModel] = React.useState(sourceVehicle?.model ?? '');
  const [manufactureYear, setManufactureYear] = React.useState(sourceVehicle?.manufactureYear?.toString() ?? '');
  const [vehiclePhotos, setVehiclePhotos] = React.useState<Record<VehiclePhotoKey, string | null>>({
    outside: sourceVehicle?.photos?.outside ?? null,
    inside: sourceVehicle?.photos?.inside ?? null,
  });
  const [saving, setSaving] = React.useState(false);
  const cardFill = isDark ? '#1C1C1E' : '#FFFFFF';
  const missingSubmissionItems = React.useMemo(() => getMissingVehicleSubmissionItems(docs, vehiclePhotos), [docs, vehiclePhotos]);

  React.useEffect(() => {
    const nextForm = createVehicleFormFromSource(sourceVehicle ?? undefined);
    setForm(current => ({ ...current, ...nextForm, nationalId }));
    setDocs(buildVehicleUploadDraftFromSource(sourceVehicle ?? undefined));
  }, [nationalId, setDocs, setForm, sourceVehicle]);

  const pickVehiclePhoto = async (key: VehiclePhotoKey) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow camera access to take vehicle photos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.88, allowsEditing: false });
    if (!result.canceled && result.assets[0]) {
      if (!isValidImageAsset(result.assets[0])) {
        Alert.alert('Invalid image', 'Please take a valid image.');
        return;
      }
      setVehiclePhotos(current => ({ ...current, [key]: result.assets[0].uri }));
    }
  };

  const pickVehicleImage = async (key: VehiclePhotoKey) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow photo access to upload vehicle photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.88, allowsEditing: false });
    if (!result.canceled && result.assets[0]) {
      if (!isValidImageAsset(result.assets[0])) {
        Alert.alert('Invalid image', 'Please select a valid image file.');
        return;
      }
      setVehiclePhotos(current => ({ ...current, [key]: result.assets[0].uri }));
    }
  };

  const submit = async () => {
    const errors: string[] = [];
    const trimmedBrand = brand.trim();
    const trimmedModel = model.trim();
    const year = manufactureYear.trim() ? Number.parseInt(manufactureYear, 10) : NaN;

    if (!form.vehicleType) errors.push('Select a vehicle type.');
    if (!trimmedBrand) errors.push('Brand is required.');
    if (!trimmedModel) errors.push('Model is required.');
    if (!Number.isInteger(year) || year < 1950 || year > new Date().getFullYear() + 1) errors.push('Enter a valid manufacture year.');
    if (!form.plateNumber || !isValidRwandaPlateNumber(normalizeRwandaPlateNumber(form.plateNumber))) errors.push('Enter a valid Rwanda plate.');
    if (!form.licenseNumber || !isValidDriverLicenceNumber(form.licenseNumber)) errors.push('Driver licence number must be exactly 16 digits.');
    if (!form.licenseExpiryDate || !isFutureExpiryDate(form.licenseExpiryDate)) errors.push('License expiry date must be in the future.');
    if (!form.insuranceExpiryDate || !isFutureExpiryDate(form.insuranceExpiryDate)) errors.push('Insurance expiry date must be in the future.');
    if (!form.authorizationExpiryDate || !isFutureExpiryDate(form.authorizationExpiryDate)) errors.push('Authorization expiry date must be in the future.');
    if (!nationalId || !isValidRwandaNationalId(nationalId)) errors.push('National ID is required.');
    if (missingSubmissionItems.length > 0) {
      errors.push(`Missing: ${missingSubmissionItems.join(', ')}`);
    }

    if (errors.length > 0) {
      Alert.alert('Missing information', errors[0]);
      return;
    }

    const documents = buildInitialDriverDocuments(
      {
        ...form,
        plateNumber: normalizeRwandaPlateNumber(form.plateNumber),
        licenseNumber: form.licenseNumber,
        nationalId,
        passengerSeats: form.passengerSeats,
        loadCapacityKg: form.loadCapacityKg,
      },
      docs,
      new Date().toISOString(),
    );

    const applicationInput = {
      vehicleType: form.vehicleType as VehicleType,
      plateNumber: normalizeRwandaPlateNumber(form.plateNumber),
      licenseNumber: form.licenseNumber,
      model: trimmedModel,
      brand: trimmedBrand,
      manufactureYear: year,
      passengerSeats: form.passengerSeats ? Number.parseInt(form.passengerSeats, 10) : undefined,
      loadCapacityKg: form.loadCapacityKg ? Number.parseInt(form.loadCapacityKg, 10) : undefined,
      licenseExpiryDate: form.licenseExpiryDate,
      insuranceExpiryDate: form.insuranceExpiryDate,
      authorizationExpiryDate: form.authorizationExpiryDate,
      photos: { outside: vehiclePhotos.outside, inside: vehiclePhotos.inside },
      documents,
      submittedAt: new Date().toISOString(),
    };

    const vehicle = sourceVehicle
      ? resubmitDriverVehicleApplication(sourceVehicle, applicationInput)
      : buildDriverVehicleFromApplication(applicationInput, 'pending_review');

    const nextProfile = appendDriverVehicle(driverProfile!, sourceVehicleId ? { ...vehicle, id: sourceVehicleId } : vehicle);
    setSaving(true);
    await saveDriverProfile(nextProfile);
    setSaving(false);
    Alert.alert('Submitted', 'Your vehicle has been submitted for review.');
    router.replace('/driver-vehicles');
  };

  const canShowPassengerSeats = form.vehicleType === 'cab' || form.vehicleType === 'hilux';
  const canShowLoadCapacity = form.vehicleType === 'fuso';

  return (
    <View style={[styles.root, { backgroundColor: isDark ? '#000' : '#F2F2F7' }]}>
      <GlassHeader
        title="Add Vehicle"
        subtitle="Submit another vehicle for review"
        onBackPress={() => router.back()}
      />
      <ScrollView
        contentContainerStyle={{
          paddingTop: headerMetrics.contentTop,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: 16,
          gap: 16,
        }}
      >
        <View style={[styles.sectionCard, { backgroundColor: cardFill }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Vehicle type</Text>
          <View style={styles.vehicleGrid}>
            {(['moto', 'rifani', 'cab', 'hilux', 'fuso'] as VehicleType[]).map(type => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.vehicleTypeChip,
                  {
                    borderColor: form.vehicleType === type ? colors.primary : colors.border,
                    backgroundColor: form.vehicleType === type ? colors.primaryHex + '10' : 'transparent',
                },
              ]}
                onPress={() => update('vehicleType', type)}
                activeOpacity={0.8}
              >
                <Text style={[styles.vehicleTypeText, { color: form.vehicleType === type ? colors.primary : colors.foreground }]}>{VEHICLE_LABELS[type]}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={[styles.sectionCard, { backgroundColor: cardFill }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Vehicle details</Text>
          <AppInput label="Brand" value={brand} onChangeText={setBrand} placeholder="Toyota" />
          <AppInput label="Model" value={model} onChangeText={setModel} placeholder="Corolla" />
          <AppInput label="Manufacture Year" value={manufactureYear} onChangeText={text => setManufactureYear(text.replace(/\D/g, '').slice(0, 4))} keyboardType="numeric" placeholder="2020" />
          <AppInput label="Plate Number" value={form.plateNumber} onChangeText={value => update('plateNumber', normalizeRwandaPlateNumber(value))} placeholder="RAD 000 A" />
          <AppInput label="Licence Number" value={form.licenseNumber} onChangeText={value => update('licenseNumber', value.replace(/\D/g, '').slice(0, 16))} keyboardType="numeric" placeholder="16 digits" maxLength={16} />
          {canShowPassengerSeats ? (
            <AppInput label="Passenger Seats" value={form.passengerSeats} onChangeText={value => update('passengerSeats', value.replace(/\D/g, '').slice(0, 2))} keyboardType="numeric" placeholder="4" />
          ) : null}
          {canShowLoadCapacity ? (
            <AppInput label="Load Capacity (kg)" value={form.loadCapacityKg} onChangeText={value => update('loadCapacityKg', value.replace(/\D/g, '').slice(0, 5))} keyboardType="numeric" placeholder="5000" />
          ) : null}
          <DatePickerField label="Licence expiry date" value={form.licenseExpiryDate} onChange={value => update('licenseExpiryDate', value)} placeholder="DD/MM/YYYY" minimumDate={new Date()} />
          <DatePickerField label="Insurance expiry date" value={form.insuranceExpiryDate} onChange={value => update('insuranceExpiryDate', value)} placeholder="DD/MM/YYYY" minimumDate={new Date()} />
          <DatePickerField label="Authorization expiry date" value={form.authorizationExpiryDate} onChange={value => update('authorizationExpiryDate', value)} placeholder="DD/MM/YYYY" minimumDate={new Date()} />
        </View>

        <View style={[styles.sectionCard, { backgroundColor: cardFill }]}>
          <DocumentUploadSection
            colors={colors}
            docs={docs}
            errors={{}}
            form={form}
            pickDocument={pickDocument}
            takeDocumentPhoto={takeDocumentPhoto}
            update={update}
          />
        </View>

        <View style={[styles.sectionCard, { backgroundColor: cardFill }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Vehicle photos</Text>
          <PhotoRow
            colors={colors}
            label="Outside photo"
            uri={vehiclePhotos.outside}
            onPick={() => void pickVehicleImage('outside')}
            onCamera={() => void pickVehiclePhoto('outside')}
          />
          <PhotoRow
            colors={colors}
            label="Inside photo"
            uri={vehiclePhotos.inside}
            onPick={() => void pickVehicleImage('inside')}
            onCamera={() => void pickVehiclePhoto('inside')}
          />
          {missingSubmissionItems.length > 0 ? (
            <View style={[styles.warningBox, { borderColor: colors.warningHex, backgroundColor: colors.warningHex + '10' }]}>
              <Text style={[styles.warningTitle, { color: colors.foreground }]}>Missing</Text>
              {missingSubmissionItems.map(item => (
                <Text key={item} style={[styles.warningItem, { color: colors.mutedForeground }]}>• {item}</Text>
              ))}
            </View>
          ) : null}
        </View>

        <AppButton title="Submit Vehicle" onPress={() => void submit()} fullWidth size="lg" loading={saving} disabled={missingSubmissionItems.length > 0} />
      </ScrollView>
    </View>
  );
}

function PhotoRow({ colors, label, onCamera, onPick, uri }: {
  colors: ReturnType<typeof useColors>;
  label: string;
  onCamera: () => void;
  onPick: () => void;
  uri: string | null;
}) {
  return (
    <View style={styles.photoRow}>
      <Text style={[styles.photoLabel, { color: colors.foreground }]}>{label}</Text>
      <View style={styles.photoActions}>
        {uri ? <Image source={{ uri }} style={styles.photoPreview} /> : <View style={[styles.photoPreview, { backgroundColor: colors.muted }]}><Feather name="image" size={18} color={colors.mutedForeground} /></View>}
        <TouchableOpacity style={[styles.photoButton, { borderColor: colors.border }]} onPress={onPick}>
          <Feather name="upload" size={14} color={colors.foreground} />
          <Text style={[styles.photoButtonText, { color: colors.foreground }]}>Gallery</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.photoButton, { borderColor: colors.border }]} onPress={onCamera}>
          <Feather name="camera" size={14} color={colors.foreground} />
          <Text style={[styles.photoButtonText, { color: colors.foreground }]}>Camera</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  sectionCard: { borderRadius: 18, padding: 14, gap: 12 },
  sectionTitle: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  vehicleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  vehicleTypeChip: { borderWidth: 1, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12 },
  vehicleTypeText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  photoRow: { gap: 8 },
  photoLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  photoActions: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  photoPreview: { width: 52, height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  photoButton: { minHeight: 42, paddingHorizontal: 12, borderWidth: 1, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
  photoButtonText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  warningBox: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 4 },
  warningTitle: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  warningItem: { fontSize: 11, fontFamily: 'Inter_400Regular', lineHeight: 16 },
});
