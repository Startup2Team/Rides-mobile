import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import {
  Keyboard,
  Platform,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  BOOKING_SHEET_PADDING_H,
  BOOKING_HANDLE_TO_TITLE_GAP,
  BOOKING_TITLE_TO_CONTENT_GAP,
} from './homeUtils';
import { AppText } from '@/components/AppText';
import { AppButton } from '@/components/AppButton';
import { icons } from '@/constants/icons';
import type { useColors } from '@/hooks/useColors';
import type { RideLocation } from '@/types';
import { formatDistance, formatDuration } from '@/utils/mapUtils';
import { hasUsablePickup } from '@/utils/locationUtils';
import { styles } from './homeStyles';

interface RouteSummary {
  durationSeconds: number;
  distanceMeters: number;
}

export type BookingCardData = {
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
};

type Props = BookingCardData & {
  colors: ReturnType<typeof useColors>;
  bottomPadding: number;
};

export function BookingCard({
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
  colors,
  bottomPadding,
}: Props) {
  return (
    // Root View must NOT use bookingSheetWrapper (position: absolute) — an
    // absolutely-positioned child does not contribute height to its parent, so
    // the shell's onLayout wrapper would always measure height 0, collapsing the
    // sheet to invisible. Use a simple relative-positioned root instead.
    <View testID="booking-card">
      {/* Title band — handle pill lives at the sheet level (CustomerBottomSheet)
          so it is always centered on the full sheet width. This area holds only
          the title, with paddingTop equal to BOOKING_HANDLE_TO_TITLE_GAP so the
          visual gap between pill and title is preserved. */}
      <View
        style={{
          paddingLeft: BOOKING_SHEET_PADDING_H,
          paddingRight: 52,
          paddingTop: BOOKING_HANDLE_TO_TITLE_GAP,
          paddingBottom: BOOKING_TITLE_TO_CONTENT_GAP,
        }}
      >
        <AppText
          variant="title"
          style={[styles.bookingSheetTitle, { color: colors.foreground }]}
          {...(Platform.OS === 'android' ? { includeFontPadding: false } : {})}
        >
          Book a Ride
        </AppText>
      </View>

      {/* Body — plain View so the container auto-sizes from content height.
          ScrollView collapsed to 0 inside an unsized absolute container (root
          cause of the blank booking card). Add scrolling back if content ever
          exceeds screen height after proper height management is in place. */}
      <View>
        <View style={[styles.bookingSheetContent, { paddingBottom: bottomPadding }]}>
          <View style={[styles.formSheetBody, styles.bookingFormSheetBody]}>

            {/* Pickup / drop-off card */}
            <View style={[styles.locationCard, { backgroundColor: colors.card }]}>
              <TouchableOpacity
                style={styles.locRow}
                onPress={() => onOpenLocationSearch('pickup')}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel="Set pickup location"
              >
                <View style={[styles.locDot, { backgroundColor: colors.primary }]} />
                <View style={styles.locTextBlock}>
                  <AppText variant="tiny" style={[styles.locInlineLabel, { color: colors.mutedForeground }]}>
                    Pickup
                  </AppText>
                  <AppText variant="body" style={[styles.locValue, { color: colors.foreground }]} numberOfLines={1}>
                    {pickup.address || 'Enter pickup location'}
                  </AppText>
                </View>
                <Feather name="chevron-right" size={icons.semantic.row} color={colors.mutedForeground} />
              </TouchableOpacity>

              <View style={[styles.locDivider, { backgroundColor: colors.border }]} />

              <TouchableOpacity
                style={styles.locRow}
                onPress={() => onOpenLocationSearch('dropoff')}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel="Set drop-off location"
              >
                <View style={[styles.locDot, { backgroundColor: colors.destructive, borderRadius: 3 }]} />
                <View style={styles.locTextBlock}>
                  <AppText variant="tiny" style={[styles.locInlineLabel, { color: colors.mutedForeground }]}>
                    Drop off
                  </AppText>
                  <AppText
                    variant="body"
                    style={[
                      styles.locValue,
                      { color: destination ? colors.foreground : colors.mutedForeground },
                    ]}
                    numberOfLines={1}
                  >
                    {destination?.address?.trim() || destinationText.trim() || 'Where to?'}
                  </AppText>
                </View>
                <Feather name="chevron-right" size={icons.semantic.row} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            {/* Use Map / Use GPS actions */}
            <View style={styles.locationActions}>
              <TouchableOpacity
                style={styles.currentLocBtn}
                onPress={() => {
                  Keyboard.dismiss();
                  onUseMap(
                    focusedField ?? 'pickup',
                    focusedField === 'dropoff' ? destination ?? userLocation : userLocation,
                  );
                }}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="map-outline" size={icons.semantic.button} color={colors.primary} />
                <AppText variant="caption" style={[styles.currentLocText, { color: colors.primary }]} numberOfLines={1}>
                  Use Map
                </AppText>
              </TouchableOpacity>

              {gpsLocation ? (
                <TouchableOpacity
                  style={styles.currentLocBtn}
                  onPress={focusedField === 'dropoff' ? onUseGpsDestination : onUseGpsPickup}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons name="crosshairs-gps" size={icons.semantic.button} color={colors.primary} />
                  <AppText variant="caption" style={[styles.currentLocText, { color: colors.primary }]} numberOfLines={1}>
                    {focusedField === 'dropoff' ? 'Use GPS as destination' : 'Use GPS as pickup'}
                  </AppText>
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Route preview — ETA + distance */}
            {destination ? (
              <View style={styles.rideInfoRow}>
                <View style={[styles.rideInfoCard, { backgroundColor: colors.card }]}>
                  <MaterialCommunityIcons name="clock-outline" size={icons.semantic.button} color={colors.primary} />
                  <View style={styles.rideInfoText}>
                    <AppText variant="tiny" style={[styles.rideInfoLabel, { color: colors.mutedForeground }]}>
                      Est. Time
                    </AppText>
                    <AppText variant="label" style={[styles.rideInfoValue, { color: colors.foreground }]}>
                      {routeLoading
                        ? '...'
                        : route
                          ? formatDuration(route.durationSeconds)
                          : `~${Math.round(distance * 3 + 5)} min`}
                    </AppText>
                  </View>
                </View>
                <View style={[styles.rideInfoCard, { backgroundColor: colors.card }]}>
                  <MaterialCommunityIcons name="map-marker-distance" size={icons.semantic.button} color={colors.primary} />
                  <View style={styles.rideInfoText}>
                    <AppText variant="tiny" style={[styles.rideInfoLabel, { color: colors.mutedForeground }]}>
                      Distance
                    </AppText>
                    <AppText variant="label" style={[styles.rideInfoValue, { color: colors.foreground }]}>
                      {routeLoading
                        ? '...'
                        : route
                          ? formatDistance(route.distanceMeters)
                          : `${distance.toFixed(1)} km`}
                    </AppText>
                  </View>
                </View>
              </View>
            ) : null}

            {/* Find Driver button */}
            {(destination || destinationText.trim().length > 0) ? (
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
            ) : null}

          </View>
        </View>
      </View>
    </View>
  );
}
