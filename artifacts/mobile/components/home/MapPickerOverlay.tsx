import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { type RefObject } from 'react';
import { Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppMap, type AppMapHandle, type AppMapRegion } from '@/components/map';
import { AppText } from '@/components/AppText';
import { AppButton } from '@/components/AppButton';
import { BackButton } from '@/components/BackButton';
import { spacing } from '@/constants/spacing';
import { FLOATING_ACTION_BOTTOM_OFFSET, TAB_SCREEN_BOTTOM_PADDING } from '@/constants/tabBar';
import type { Coords } from '@/types';
import type { useColors } from '@/hooks/useColors';
import { styles } from './homeStyles';
import type { AppMapType, MapPickerTarget } from './homeUtils';

export function MapPickerOverlay({
  target,
  mapRef,
  pinCoords,
  mapType,
  colors,
  topInset,
  bottomInset,
  isDragging,
  onLayout,
  onDragStart,
  onRegionChangeComplete,
  onClose,
  onCycleMapType,
  onCenterUser,
  onConfirm,
  savedLocationConfirmTitle,
  savedLocationHint,
}: {
  target: MapPickerTarget | null;
  mapRef: RefObject<AppMapHandle | null>;
  pinCoords: Coords;
  mapType: AppMapType;
  colors: ReturnType<typeof useColors>;
  topInset: number;
  bottomInset: number;
  isDragging: boolean;
  onLayout: (width: number, height: number) => void;
  onDragStart: () => void;
  onRegionChangeComplete: (region: AppMapRegion) => void;
  onClose: () => void;
  onCycleMapType: () => void;
  onCenterUser: () => void;
  onConfirm: () => void | Promise<void>;
  savedLocationConfirmTitle?: string;
  savedLocationHint?: string;
}) {
  if (target === null) return null;

  return (
    <View style={styles.mapPickerContainer}>
      <AppMap
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={{ ...pinCoords, latitudeDelta: 0.01, longitudeDelta: 0.01 }}
        mapType={mapType}
        onLayout={event => {
          const { width, height } = event.nativeEvent.layout;
          if (width > 0 && height > 0) onLayout(width, height);
        }}
        onPanDrag={onDragStart}
        onRegionChangeComplete={onRegionChangeComplete}
      />

      <View style={[styles.fixedPinContainer, isDragging && styles.fixedPinContainerDragging]} pointerEvents="none">
        <View style={[styles.uberPin, isDragging && styles.uberPinDragging]}>
          <View style={styles.uberPinHead}>
            <View style={styles.uberPinSquare} />
          </View>
          <View style={[styles.uberPinStem, isDragging && styles.uberPinStemDragging]} />
        </View>
        {isDragging && <View style={styles.uberPinGroundDot} />}
      </View>

      <BackButton
        flat={false}
        style={[styles.mapPickerBack, { top: topInset + (Platform.OS === 'web' ? 67 : spacing[0]) + spacing[12] }]}
        onPress={onClose}
      />

      <View style={styles.mapPickerControlsRail} pointerEvents="box-none">
        <TouchableOpacity
          style={[styles.mapPickerControl, { backgroundColor: colors.background }]}
          onPress={onCycleMapType}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Change map view"
        >
          <MaterialCommunityIcons
            name={mapType === 'standard' ? 'layers-outline' : mapType === 'satellite' ? 'satellite-variant' : 'map'}
            size={22}
            color={colors.primary}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.mapPickerControl, { backgroundColor: colors.background }]}
          onPress={onCenterUser}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Recenter on your location"
        >
          <MaterialCommunityIcons name="crosshairs-gps" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={[styles.mapPickerHint, { backgroundColor: colors.card }]}>
        <AppText variant="label" style={[styles.mapPickerHintText, { color: colors.foreground }]}>
          {target === 'pickup'
            ? 'Drag the map to set your pickup location'
            : target === 'savedLocation'
              ? savedLocationHint ?? 'Drag the map to update this saved location'
              : 'Drag the map to set your drop off location'}
        </AppText>
      </View>

      <View style={[styles.mapPickerFooter, { paddingBottom: bottomInset + TAB_SCREEN_BOTTOM_PADDING + FLOATING_ACTION_BOTTOM_OFFSET }]}>
        <AppButton
          title={
            target === 'pickup'
              ? 'Confirm Pickup Location'
              : target === 'savedLocation'
                ? savedLocationConfirmTitle ?? 'Confirm Saved Location'
                : 'Confirm Drop Off Location'
          }
          fullWidth
          size="lg"
          onPress={onConfirm}
        />
      </View>
    </View>
  );
}
