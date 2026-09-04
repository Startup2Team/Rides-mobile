import { typography } from '@/constants/typography';
import { AppText } from '@/components/AppText';
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Alert, StyleSheet, View, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { AppButton } from '@/components/AppButton';
import { AppInput } from '@/components/AppInput';
import { GlassHeader, useGlassHeaderMetrics } from '@/components/GlassHeader';
import { GlassScrollView } from '@/components/GlassScrollView';
import { FORM_BOTTOM_PADDING } from '@/constants/tabBar';
import { useVehicle, useVehicles } from '@/domains/vehicle';
import { ConflictError } from '@/data/remote/contracts/backendErrors';
import { updateVehicleByPlate } from '@/services/driverVehicles';
import { readBackendError } from '@/utils/backendErrorMessage';
import { useColors } from '@/hooks/useColors';
import { getVehicleBrandModelPlaceholders } from '@/hooks/driver-onboarding/onboardingTypes';
import { formatRwandaPlateInput, isValidRwandaPlateNumber, normalizeRwandaPlateNumber } from '@/utils/rwandaValidation';
import { VEHICLE_LABELS } from '@/types';
import { icons } from '@/constants/icons';
import { radius } from '@/constants/radius';
import { spacing, semanticSpacing } from '@/constants/spacing';

// Focused edit of the core vehicle-identity fields the backend actually owns
// on PATCH /v1/driver/vehicles/{id} (brand/model/year/plate/capacity). This is
// deliberately NOT the KYC application form (app/driver-add-vehicle.tsx) —
// that screen submits documents for review and has no wiring to this
// endpoint; reusing it here would offer document upload fields whose
// "submission" would never reach this edit at all. Vehicle TYPE is not
// editable from this screen: UpdateVehicleInput on the backend has no
// vehicle_type_code field, so sending one would be silently ignored.

function statusLabel(status: string | null): string {
  if (status === 'PENDING_REVIEW') return 'Pending review';
  if (status === 'APPROVED') return 'Approved';
  if (status === 'REJECTED') return 'Rejected';
  return 'Unknown';
}

export default function DriverEditVehicleScreen() {
  const colors = useColors();
  const isDark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const headerMetrics = useGlassHeaderMetrics();
  const params = useLocalSearchParams<{ vehicleId?: string }>();
  const vehicleId = typeof params.vehicleId === 'string' ? params.vehicleId : null;
  const vehicle = useVehicle(vehicleId);
  const { updateVehicle } = useVehicles();

  const [plateNumber, setPlateNumber] = React.useState(vehicle?.plateNumber ?? '');
  const [brand, setBrand] = React.useState(vehicle?.brand ?? '');
  const [model, setModel] = React.useState(vehicle?.model ?? '');
  const [manufactureYear, setManufactureYear] = React.useState(vehicle?.manufactureYear?.toString() ?? '');
  const [passengerSeats, setPassengerSeats] = React.useState(vehicle?.passengerSeats?.toString() ?? '');
  const [loadCapacityKg, setLoadCapacityKg] = React.useState(vehicle?.loadCapacityKg?.toString() ?? '');
  const [saving, setSaving] = React.useState(false);

  if (!vehicle) {
    return (
      <View style={[styles.root, { backgroundColor: isDark ? '#000' : '#F2F2F7' }]}>
        <GlassHeader title="Edit Vehicle" onBackPress={() => router.back()} />
        <View style={styles.emptyState}>
          <AppText style={[styles.emptyStateTitle, { color: colors.foreground }]}>Vehicle not found</AppText>
          <AppText style={[styles.emptyStateText, { color: colors.mutedForeground }]}>This vehicle is no longer available in your account.</AppText>
        </View>
      </View>
    );
  }

  const canShowPassengerSeats = vehicle.vehicleType === 'cab' || vehicle.vehicleType === 'hilux';
  const canShowLoadCapacity = vehicle.vehicleType === 'fuso';
  const placeholders = getVehicleBrandModelPlaceholders(vehicle.vehicleType);

  const trimmedBrand = brand.trim();
  const trimmedModel = model.trim();
  const normalizedPlate = normalizeRwandaPlateNumber(plateNumber);
  const originalPlate = normalizeRwandaPlateNumber(vehicle.plateNumber);
  const yearNumber = manufactureYear.trim() ? Number.parseInt(manufactureYear, 10) : NaN;
  const seatsNumber = passengerSeats.trim() ? Number.parseInt(passengerSeats, 10) : NaN;
  const loadNumber = loadCapacityKg.trim() ? Number.parseInt(loadCapacityKg, 10) : NaN;

  const hasChanges =
    normalizedPlate !== originalPlate ||
    trimmedBrand !== (vehicle.brand ?? '') ||
    trimmedModel !== (vehicle.model ?? '') ||
    (Number.isFinite(yearNumber) ? yearNumber : null) !== (vehicle.manufactureYear ?? null) ||
    (canShowPassengerSeats && (Number.isFinite(seatsNumber) ? seatsNumber : null) !== (vehicle.passengerSeats ?? null)) ||
    (canShowLoadCapacity && (Number.isFinite(loadNumber) ? loadNumber : null) !== (vehicle.loadCapacityKg ?? null));

  const save = async () => {
    const errors: string[] = [];
    if (!normalizedPlate || !isValidRwandaPlateNumber(normalizedPlate)) errors.push('Enter a valid Rwanda plate.');
    if (!trimmedBrand) errors.push('Brand is required.');
    if (!trimmedModel) errors.push('Model is required.');
    if (!Number.isInteger(yearNumber) || yearNumber < 1950 || yearNumber > new Date().getFullYear() + 1) errors.push('Enter a valid manufacture year.');
    if (canShowPassengerSeats && passengerSeats.trim() && !Number.isInteger(seatsNumber)) errors.push('Enter a valid passenger seat count.');
    if (canShowLoadCapacity && loadCapacityKg.trim() && !Number.isInteger(loadNumber)) errors.push('Enter a valid load capacity.');

    if (errors.length > 0) {
      Alert.alert('Check your details', errors[0]);
      return;
    }
    if (!hasChanges) {
      Alert.alert('No changes', 'Nothing has changed yet.');
      return;
    }

    // Null-normalized (not raw NaN) comparisons: NaN !== NaN is always true in
    // JS, which would mark an untouched, never-set seats/capacity/year field
    // as "changed" on every save and send a spurious PATCH field.
    const yearValue = Number.isFinite(yearNumber) ? yearNumber : null;
    const seatsValue = Number.isFinite(seatsNumber) ? seatsNumber : null;
    const loadValue = Number.isFinite(loadNumber) ? loadNumber : null;

    setSaving(true);
    try {
      const result = await updateVehicleByPlate(vehicle.plateNumber, {
        plateNumber: normalizedPlate !== originalPlate ? normalizedPlate : undefined,
        brand: trimmedBrand !== (vehicle.brand ?? '') ? trimmedBrand : undefined,
        model: trimmedModel !== (vehicle.model ?? '') ? trimmedModel : undefined,
        manufactureYear: yearValue !== (vehicle.manufactureYear ?? null) ? yearValue : undefined,
        passengerSeats: canShowPassengerSeats && seatsValue !== (vehicle.passengerSeats ?? null) ? seatsValue : undefined,
        loadCapacityKg: canShowLoadCapacity && loadValue !== (vehicle.loadCapacityKg ?? null) ? loadValue : undefined,
      });

      // The backend just told us the truth for THIS vehicle — write it through
      // to local storage too. reconcileDriverVehicles prefers the local copy
      // over the backend's for these overlapping fields (it layers richer
      // on-device KYC data over the backend list), so without this the edit
      // would show "saved" here and then silently revert on the vehicles list.
      await updateVehicle({
        ...vehicle,
        plateNumber: result.plateNumber,
        brand: result.brand ?? undefined,
        model: result.model ?? undefined,
        manufactureYear: result.manufactureYear ?? undefined,
        passengerSeats: result.passengerSeats ?? vehicle.passengerSeats,
        loadCapacityKg: result.loadCapacityKg ?? vehicle.loadCapacityKg,
      });

      setSaving(false);
      const wasSafetyEdit = normalizedPlate !== originalPlate
        || (canShowPassengerSeats && (Number.isFinite(seatsNumber) ? seatsNumber : null) !== (vehicle.passengerSeats ?? null))
        || (canShowLoadCapacity && (Number.isFinite(loadNumber) ? loadNumber : null) !== (vehicle.loadCapacityKg ?? null));
      const message = result.approvalStatus === 'PENDING_REVIEW'
        ? "Your vehicle details were updated and sent for re-approval. If this is your active vehicle, check your online status — a safety-relevant change like this can pause it until it's reviewed again."
        : wasSafetyEdit
          ? `Your vehicle details were updated. Status: ${statusLabel(result.approvalStatus)}.`
          : 'Your vehicle details were updated.';
      Alert.alert('Saved', message, [{ text: 'OK', onPress: () => router.back() }]);
    } catch (error) {
      setSaving(false);
      const backendError = readBackendError(error);
      if (error instanceof ConflictError && backendError.code === 'VEHICLE_LOCKED_ON_RIDE') {
        Alert.alert(
          'Cannot edit right now',
          backendError.message ?? 'You cannot edit your active vehicle while a ride is in progress. Finish the ride, then try again.',
        );
        return;
      }
      if (error instanceof ConflictError && backendError.code === 'DUPLICATE_PLATE') {
        Alert.alert('Plate already registered', backendError.message ?? 'That plate number is already registered to another vehicle.');
        return;
      }
      if (error instanceof Error && error.message === 'VEHICLE_NOT_REGISTERED') {
        Alert.alert(
          "Couldn't save changes",
          "This vehicle isn't registered with our servers yet. Pull to refresh on the vehicles list and try again, or contact support.",
        );
        return;
      }
      Alert.alert(
        "Couldn't save changes",
        backendError.message ?? 'Check your connection and try again.',
      );
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: isDark ? '#000' : '#F2F2F7' }]}>
      <GlassHeader title="Edit Vehicle" onBackPress={() => router.back()} />
      <GlassScrollView
        indicatorTop={headerMetrics.indicatorTop}
        contentContainerStyle={{
          paddingTop: headerMetrics.contentTop,
          paddingBottom: insets.bottom + FORM_BOTTOM_PADDING,
          paddingHorizontal: semanticSpacing.cardPadding,
          gap: semanticSpacing.cardPadding,
        }}
      >
        <View style={[styles.banner, { borderColor: colors.warningHex, backgroundColor: colors.warningHex + '12' }]}>
          <Feather name="alert-triangle" size={icons.size.sm} color={colors.warningHex} />
          <AppText style={[styles.bannerText, { color: colors.foreground }]} accessibilityLabel="Re-approval notice">
            Changing the plate number, passenger seats or load capacity can send this vehicle for re-approval. If it's your active, approved vehicle, check your online status afterwards — this kind of change can pause it until it's reviewed again.
          </AppText>
        </View>

        <View style={[styles.section, { borderBottomColor: colors.border }]}>
          <AppText style={[styles.sectionTitle, { color: colors.foreground }]}>Vehicle type</AppText>
          <AppText style={[styles.readonlyValue, { color: colors.foreground }]}>{VEHICLE_LABELS[vehicle.vehicleType]}</AppText>
          <AppText style={[styles.readonlyHint, { color: colors.mutedForeground }]}>
            Vehicle type can&apos;t be changed here. Contact support if you need to switch types.
          </AppText>
        </View>

        <View style={styles.sectionLast}>
          <AppText style={[styles.sectionTitle, { color: colors.foreground }]}>Vehicle details</AppText>
          <AppInput
            label="Brand"
            value={brand}
            onChangeText={setBrand}
            placeholder={placeholders.brand}
            accessibilityLabel="Brand"
          />
          <AppInput
            label="Model"
            value={model}
            onChangeText={setModel}
            placeholder={placeholders.model}
            accessibilityLabel="Model"
          />
          <AppInput
            label="Manufacture Year"
            value={manufactureYear}
            onChangeText={text => setManufactureYear(text.replace(/\D/g, '').slice(0, 4))}
            keyboardType="numeric"
            placeholder="2020"
            accessibilityLabel="Manufacture year"
          />
          <AppInput
            label="Plate Number"
            value={plateNumber}
            onChangeText={value => setPlateNumber(formatRwandaPlateInput(value))}
            placeholder="RAD 000 A"
            accessibilityLabel="Plate number"
          />
          {canShowPassengerSeats ? (
            <AppInput
              label="Passenger Seats"
              value={passengerSeats}
              onChangeText={value => setPassengerSeats(value.replace(/\D/g, '').slice(0, 2))}
              keyboardType="numeric"
              placeholder="4"
              accessibilityLabel="Passenger seats"
            />
          ) : null}
          {canShowLoadCapacity ? (
            <AppInput
              label="Load Capacity (kg)"
              value={loadCapacityKg}
              onChangeText={value => setLoadCapacityKg(value.replace(/\D/g, '').slice(0, 5))}
              keyboardType="numeric"
              placeholder="5000"
              accessibilityLabel="Load capacity in kilograms"
            />
          ) : null}
        </View>

        <AppButton
          title="Save Changes"
          onPress={() => void save()}
          fullWidth
          size="lg"
          loading={saving}
          disabled={!hasChanges || saving}
        />
      </GlassScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: semanticSpacing.inlineGap,
    borderWidth: 1,
    borderRadius: radius.card,
    padding: semanticSpacing.rowGap,
  },
  bannerText: { ...typography.caption, flex: 1, lineHeight: 18 },
  section: {
    gap: spacing[14],
    paddingBottom: radius.sheetCompact,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sectionLast: {
    gap: spacing[14],
    paddingBottom: spacing[4],
  },
  sectionTitle: { ...typography.title },
  readonlyValue: { ...typography.body },
  readonlyHint: { ...typography.tiny, lineHeight: 16 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: semanticSpacing.inlineGap, padding: semanticSpacing.sectionGap },
  emptyStateTitle: { ...typography.h3 },
  emptyStateText: { ...typography.label, textAlign: 'center', lineHeight: 18 },
});
