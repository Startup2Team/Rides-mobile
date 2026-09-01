import React from 'react';
import { StyleSheet, View } from 'react-native';
import Reanimated from 'react-native-reanimated';
import { ProfileAvatarCircle } from '@/components/ProfileAvatarCircle';
import { useColors } from '@/hooks/useColors';
import { useMarkerAppear } from '@/hooks/map/useMarkerAppear';
import { sizes } from '@/constants/sizes';

const AVATAR_SIZE = sizes.avatar.sm;
const STATUS_DOT_SIZE = 12;

interface CustomerLocationMarkerProps {
  initial: string;
  imageUri: string | null;
  /** No fresh fix for a while — dim the marker instead of showing a possibly wrong position with full confidence. */
  stale: boolean;
}

/**
 * The driver's live view of the customer's position (from `customer_location`
 * WS events) — an avatar bubble with a status ring, distinct from the static
 * pickup/destination pins (LocationMapPin). Callers should also set the map
 * Marker's `title`/`description` so tapping it surfaces the staleness copy
 * as a native callout, since there's no room for a text label here.
 */
export function CustomerLocationMarker({ initial, imageUri, stale }: CustomerLocationMarkerProps) {
  const colors = useColors();
  const appearStyle = useMarkerAppear();
  const ringColor = stale ? colors.mutedForeground : colors.successHex;

  return (
    <Reanimated.View style={[styles.wrap, appearStyle]} collapsable={false}>
      <ProfileAvatarCircle
        size={AVATAR_SIZE}
        initial={initial}
        imageUri={imageUri}
        accessibilityLabel="Customer"
        style={[
          styles.avatar,
          { borderColor: ringColor },
          stale && styles.avatarStale,
        ]}
      />
      <View
        style={[
          styles.statusDot,
          { backgroundColor: ringColor, borderColor: colors.background },
        ]}
      />
    </Reanimated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    borderWidth: 2,
  },
  avatarStale: {
    opacity: 0.55,
  },
  statusDot: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: STATUS_DOT_SIZE,
    height: STATUS_DOT_SIZE,
    borderRadius: STATUS_DOT_SIZE / 2,
    borderWidth: 2,
  },
});
