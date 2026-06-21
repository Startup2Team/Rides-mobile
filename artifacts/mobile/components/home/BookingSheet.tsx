import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import {
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { AppButton } from '@/components/AppButton';
import type { RideLocation } from '@/types';
import { formatDistance, formatDuration } from '@/utils/mapUtils';
import { hasUsablePickup } from '@/utils/locationUtils';
import type { useColors } from '@/hooks/useColors';
import { styles } from './homeStyles';
import {
  BOOKING_SHEET_MIN_HEIGHT,
  getBookingSheetMaxHeight,
  resolveBookingSheetHeight,
} from './bookingSheetLayout';

interface RouteSummary {
  durationSeconds: number;
  distanceMeters: number;
}

export function BookingSheet({
  visible,
  height,
  bottomOffset,
  bottomPadding,
  onHeightChange,
  colors,
  pickup,
  destination,
  destinationText,
  focusedField,
  userLocation,
  gpsLocation,
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
  height?: number;
  bottomOffset: number;
  bottomPadding: number;
  onHeightChange?: (height: number) => void;
  colors: ReturnType<typeof useColors>;
  pickup: RideLocation;
  destination: RideLocation | null;
  destinationText: string;
  focusedField: 'pickup' | 'dropoff' | null;
  userLocation: RideLocation;
  gpsLocation?: RideLocation | null;
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

  const maxHeight = getBookingSheetMaxHeight(950);
  const [contentHeight, setContentHeight] = React.useState(Math.max(height ?? BOOKING_SHEET_MIN_HEIGHT, BOOKING_SHEET_MIN_HEIGHT));
  const resolvedHeight = resolveBookingSheetHeight(contentHeight, height, maxHeight);

  React.useEffect(() => {
    onHeightChange?.(resolvedHeight);
  }, [onHeightChange, resolvedHeight]);

  return (
    <KeyboardAvoidingView
      style={[styles.bookingSheetWrapper, { height: resolvedHeight, bottom: bottomOffset }]}
      behavior={Platform.OS === 'ios' ? 'position' : 'height'}
      keyboardVerticalOffset={0}
    >
      <Animated.View
        style={[
          styles.bookingSheet,
          {
            height: resolvedHeight,
          },
        ]}
      >
        <ScrollView
          style={{ height: resolvedHeight }}
          contentContainerStyle={{ flexGrow: 1 }}
          scrollEnabled={contentHeight > resolvedHeight}
          bounces={false}
          alwaysBounceVertical={false}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          onContentSizeChange={(_, contentHeightNext) => {
            setContentHeight(contentHeightNext);
          }}
        >
          <View
            style={[
              styles.bookingSheetContent,
              {
                paddingBottom: bottomPadding,
              },
            ]}
          >
            <View style={styles.formSheetBody}>
              <View style={styles.formSheetHeader}>
                <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Book a Ride</Text>
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
                {gpsLocation ? <TouchableOpacity
                  style={styles.currentLocBtn}
                  onPress={focusedField === 'dropoff' ? onUseGpsDestination : onUseGpsPickup}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons name="crosshairs-gps" size={16} color={colors.primary} />
                  <Text style={[styles.currentLocText, { color: colors.primary }]} numberOfLines={1}>
                    {focusedField === 'dropoff' ? 'Use GPS as destination' : 'Use GPS as pickup'}
                  </Text>
                </TouchableOpacity> : null}
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
                  <AppButton
                    title="Find Driver"
                    onPress={onBook}
                    fullWidth
                    size="sm"
                    loading={booking}
                    disabled={!hasUsablePickup(pickup)}
                  />
                </View>
              )}
            </View>
          </View>
        </ScrollView>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}
