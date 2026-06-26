import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { CUSTOMER_VEHICLE_TYPES } from '@/constants/vehicles';
import { AppText } from '@/components/AppText';
import { VehicleTypeIcon } from '@/components/VehicleTypeIcon';
import type { useColors } from '@/hooks/useColors';
import { VEHICLE_LABELS, type VehicleType } from '@/types';
import { styles } from './homeStyles';
import { BOOKING_SHEET_PADDING_H } from './homeUtils';

export type HomeCardData = {
  userName: string;
  locationStatus: 'available' | 'unavailable' | 'loading';
  selectedVehicle: VehicleType;
  onSelectVehicle: (v: VehicleType) => void;
  onContinue: () => void;
  onRetryLocation: () => void;
  onSelectPickupManually: () => void;
};

type Props = HomeCardData & {
  colors: ReturnType<typeof useColors>;
  bottomPadding: number;
};

export function HomeCard({
  userName,
  locationStatus,
  selectedVehicle,
  onSelectVehicle,
  onContinue,
  onRetryLocation,
  onSelectPickupManually,
  colors,
  bottomPadding,
}: Props) {
  return (
    <View
      testID="home-card"
      style={{
        paddingTop: 22,
        paddingHorizontal: BOOKING_SHEET_PADDING_H,
        paddingBottom: bottomPadding,
        gap: 10,
      }}
    >
      <AppText variant="h2" style={[styles.greeting, { color: colors.foreground }]}>
        Hi, {userName} {'\u{1F44B}'}
      </AppText>
      <AppText variant="bodySmall" style={[styles.selectRide, { color: colors.mutedForeground }]}>
        Select your ride
      </AppText>

      {locationStatus === 'unavailable' ? (
        <View style={[styles.locationUnavailable, { backgroundColor: colors.muted }]}>
          <AppText variant="label" style={[styles.locationUnavailableText, { color: colors.foreground }]}>
            Unable to determine your location.
          </AppText>
          <View style={styles.locationUnavailableActions}>
            <TouchableOpacity onPress={onRetryLocation} activeOpacity={0.75}>
              <AppText variant="caption" style={[styles.locationUnavailableAction, { color: colors.primary }]}>
                Retry location
              </AppText>
            </TouchableOpacity>
            <TouchableOpacity onPress={onSelectPickupManually} activeOpacity={0.75}>
              <AppText variant="caption" style={[styles.locationUnavailableAction, { color: colors.primary }]}>
                Select pickup manually
              </AppText>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      <View style={styles.vehicleRow}>
        {CUSTOMER_VEHICLE_TYPES.map(v => (
          <TouchableOpacity
            key={v}
            testID={`vehicle-chip-${v}`}
            style={[
              styles.vehicleChip,
              {
                backgroundColor: selectedVehicle === v ? colors.primary : colors.muted,
                borderWidth: selectedVehicle === v ? 0 : 1,
                borderColor: colors.border,
              },
            ]}
            onPress={() => onSelectVehicle(v)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={VEHICLE_LABELS[v]}
            accessibilityState={{ selected: selectedVehicle === v }}
          >
            <VehicleTypeIcon type={v} selected={selectedVehicle === v} />
            <AppText
              variant="tiny"
              style={[
                styles.vehicleLabel,
                { color: selectedVehicle === v ? colors.primaryForeground : colors.foreground },
              ]}
            >
              {VEHICLE_LABELS[v]}
            </AppText>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        testID="continue-btn"
        style={[styles.continueBtn, { backgroundColor: colors.primary }]}
        onPress={onContinue}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={`Continue with ${VEHICLE_LABELS[selectedVehicle]}`}
      >
        <AppText variant="button" style={[styles.continueBtnText, { color: colors.primaryForeground }]}>
          Continue with {VEHICLE_LABELS[selectedVehicle]}
        </AppText>
      </TouchableOpacity>
    </View>
  );
}
