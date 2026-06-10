import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { type RefObject } from 'react';
import {
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Text,
  TouchableOpacity,
  View,
  type PanResponderInstance,
} from 'react-native';
import { AppButton } from '@/components/AppButton';
import { CloseButton, type CloseButtonHandle } from '@/components/BackButton';
import type { RideLocation } from '@/types';
import { formatDistance, formatDuration } from '@/utils/mapUtils';
import type { useColors } from '@/hooks/useColors';
import { styles } from './homeStyles';

interface RouteSummary {
  durationSeconds: number;
  distanceMeters: number;
}

export function BookingSheet({
  visible,
  height,
  bottomPadding,
  colors,
  animation,
  panResponder,
  closeButtonRef,
  onClose,
  pickup,
  destination,
  destinationText,
  focusedField,
  userLocation,
  onOpenLocationSearch,
  onUseMap,
  onUseGpsPickup,
  onUseGpsDestination,
  route,
  routeLoading,
  distance,
  onBook,
  booking,
}: {
  visible: boolean;
  height: number;
  bottomPadding: number;
  colors: ReturnType<typeof useColors>;
  animation: Animated.Value;
  panResponder: PanResponderInstance;
  closeButtonRef: RefObject<CloseButtonHandle | null>;
  onClose: () => void;
  pickup: RideLocation;
  destination: RideLocation | null;
  destinationText: string;
  focusedField: 'pickup' | 'dropoff' | null;
  userLocation: RideLocation;
  onOpenLocationSearch: (target: 'pickup' | 'dropoff') => void;
  onUseMap: (target: 'pickup' | 'dropoff', location: RideLocation) => void;
  onUseGpsPickup: () => void;
  onUseGpsDestination: () => void;
  route: RouteSummary | null;
  routeLoading: boolean;
  distance: number;
  onBook: () => void;
  booking: boolean;
}) {
  if (!visible) return null;

  return (
    <KeyboardAvoidingView
      style={[styles.bookingSheetWrapper, { height }]}
      behavior={Platform.OS === 'ios' ? 'position' : 'height'}
      keyboardVerticalOffset={0}
    >
      <Animated.View
        style={[
          styles.bookingSheet,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            height,
            paddingBottom: bottomPadding,
            transform: [{ translateY: animation }],
          },
        ]}
        {...panResponder.panHandlers}
      >
        <View style={styles.formSheetCloseAnchor} pointerEvents="box-none">
          <CloseButton
            ref={closeButtonRef}
            shutOnPress={false}
            onPress={onClose}
            accessibilityLabel="Close booking"
          />
        </View>
        <View style={styles.formSheetBody}>
          <View style={[styles.sheetDragZone, styles.formSheetDragZone]}>
            <View style={[styles.sheetHandleTouch, styles.formSheetHandleTouch]}>
              <View style={styles.sheetHandle} />
            </View>
            <View style={styles.formSheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Book a Ride</Text>
            </View>
          </View>

          <View style={[styles.locationCard, { backgroundColor: colors.muted }]}>
            <TouchableOpacity style={styles.locRow} onPress={() => onOpenLocationSearch('pickup')} activeOpacity={0.75}>
              <View style={[styles.locDot, { backgroundColor: colors.primary }]} />
              <View style={styles.locTextBlock}>
                <Text style={[styles.locInlineLabel, { color: colors.mutedForeground }]}>Pickup</Text>
                <Text style={[styles.locValue, { color: colors.foreground }]} numberOfLines={1}>
                  {pickup.address || 'Enter pickup location'}
                </Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
            <View style={[styles.locDivider, { backgroundColor: colors.border }]} />
            <TouchableOpacity style={styles.locRow} onPress={() => onOpenLocationSearch('dropoff')} activeOpacity={0.75}>
              <View style={[styles.locDot, { backgroundColor: colors.destructive, borderRadius: 3 }]} />
              <View style={styles.locTextBlock}>
                <Text style={[styles.locInlineLabel, { color: colors.mutedForeground }]}>Drop off</Text>
                <Text style={[styles.locValue, { color: destination ? colors.foreground : colors.mutedForeground }]} numberOfLines={1}>
                  {destination?.address?.trim() || destinationText.trim() || 'Where to?'}
                </Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          <View style={styles.locationActions}>
            <TouchableOpacity
              style={styles.currentLocBtn}
              onPress={() => {
                Keyboard.dismiss();
                onUseMap(focusedField ?? 'pickup', focusedField === 'dropoff' ? destination ?? userLocation : userLocation);
              }}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="map-outline" size={16} color={colors.primary} />
              <Text style={[styles.currentLocText, { color: colors.primary }]} numberOfLines={1}>Use Map</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.currentLocBtn}
              onPress={focusedField === 'dropoff' ? onUseGpsDestination : onUseGpsPickup}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="crosshairs-gps" size={16} color={colors.primary} />
              <Text style={[styles.currentLocText, { color: colors.primary }]} numberOfLines={1}>
                {focusedField === 'dropoff' ? 'Use GPS as destination' : 'Use GPS as pickup'}
              </Text>
            </TouchableOpacity>
          </View>

          {destination && (
            <View style={styles.rideInfoRow}>
              <View style={[styles.rideInfoCard, { backgroundColor: colors.muted }]}>
                <MaterialCommunityIcons name="clock-outline" size={16} color={colors.primary} />
                <View style={styles.rideInfoText}>
                  <Text style={[styles.rideInfoLabel, { color: colors.mutedForeground }]}>Est. Time</Text>
                  <Text style={[styles.rideInfoValue, { color: colors.foreground }]}>
                    {routeLoading ? '...' : route ? formatDuration(route.durationSeconds) : `~${Math.round(distance * 3 + 5)} min`}
                  </Text>
                </View>
              </View>
              <View style={[styles.rideInfoCard, { backgroundColor: colors.muted }]}>
                <MaterialCommunityIcons name="map-marker-distance" size={16} color={colors.primary} />
                <View style={styles.rideInfoText}>
                  <Text style={[styles.rideInfoLabel, { color: colors.mutedForeground }]}>Distance</Text>
                  <Text style={[styles.rideInfoValue, { color: colors.foreground }]}>
                    {routeLoading ? '...' : route ? formatDistance(route.distanceMeters) : `${distance.toFixed(1)} km`}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {(destination || destinationText.trim().length > 0) && (
            <View style={styles.findDriverAction}>
              <AppButton title="Find Driver" onPress={onBook} fullWidth size="sm" loading={booking} />
            </View>
          )}
        </View>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}
