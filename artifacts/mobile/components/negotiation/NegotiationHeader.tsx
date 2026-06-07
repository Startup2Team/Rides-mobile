import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Image, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import type { Ride } from '@/types';
import { VEHICLE_LABELS } from '@/types';
import { resolveDriverProfileImage } from '@/utils/driverProfileImage';
import { NegotiationStatusCard } from './NegotiationStatusCard';
import { MAX_OFFERS, WARNING, type NegotiationStatusTone } from './negotiationUtils';
import { styles } from './negotiationStyles';

export function NegotiationHeader({
  chatStatus,
  messagesUsed,
  offersRemaining,
  ride,
}: {
  chatStatus: { tone: NegotiationStatusTone; title: string; hint: string };
  messagesUsed: number;
  offersRemaining: number;
  ride: Ride;
}) {
  const colors = useColors();
  const driverInitial = ride.driver?.name?.trim()?.[0]?.toUpperCase() ?? 'D';
  const driverProfileImage = resolveDriverProfileImage(ride.driver);
  const destinationIsGeneric = ride.destination.locationType === 'generic';
  const dropoffAccent = destinationIsGeneric ? WARNING : colors.destructive;

  return (
    <View style={styles.topSection}>
      <View style={styles.header}>
        <View style={styles.identityRow}>
          {driverProfileImage ? (
            <Image
              source={{ uri: driverProfileImage }}
              style={styles.avatarImage}
              accessibilityLabel={ride.driver?.name ?? 'Driver profile photo'}
            />
          ) : (
            <LinearGradient
              colors={['#9DBBE0', '#7984C3']}
              style={styles.avatar}
              accessibilityLabel={ride.driver?.name ?? 'Driver'}
              accessibilityRole="image"
            >
              <Text style={styles.avatarInitial}>{driverInitial}</Text>
            </LinearGradient>
          )}
          <View style={styles.identityText}>
            <Text style={[styles.title, { color: colors.foreground }]}>
              {ride.driver?.name ?? 'Driver'}
            </Text>
            <View style={styles.subtitleRow}>
              <Text style={[styles.subtitle, { color: colors.mutedForeground }]} numberOfLines={1}>
                {VEHICLE_LABELS[ride.vehicleType]} - {ride.driver?.plateNumber ?? 'Plate pending'}
              </Text>
              <Text style={[styles.ratingText, { color: colors.star }]}>
                â˜… {ride.driver?.rating?.toFixed(1) ?? '4.8'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View style={[styles.tripSummaryCard, { backgroundColor: colors.card }]}>
        <View style={styles.tripRoute}>
          <View style={styles.tripRouteTrack}>
            <View style={[styles.tripDot, { backgroundColor: colors.primary }]} />
            <View style={[styles.tripConnector, { backgroundColor: colors.border }]} />
            <View style={[styles.tripDot, styles.tripDotSquare, { backgroundColor: dropoffAccent }]} />
          </View>
          <View style={styles.tripStops}>
            <View style={styles.tripStop}>
              <Text style={[styles.tripStopLabel, { color: colors.mutedForeground }]}>Pickup</Text>
              <Text style={[styles.tripStopValue, { color: colors.foreground }]} numberOfLines={1}>
                {ride.pickup.address ?? 'Pickup location'}
              </Text>
            </View>
            <View style={styles.tripStop}>
              <Text style={[styles.tripStopLabel, { color: colors.mutedForeground }]}>Drop off</Text>
              <Text style={[styles.tripStopValue, { color: colors.foreground }]} numberOfLines={1}>
                {destinationIsGeneric
                  ? (ride.destination.address?.trim() || 'To be confirmed in chat')
                  : (ride.destination.address ?? 'Destination')}
              </Text>
            </View>
          </View>
        </View>
        {destinationIsGeneric && (
          <View style={[styles.tripGenericNote, { backgroundColor: WARNING + '14' }]}>
            <Feather name="info" size={12} color={WARNING} />
            <Text style={[styles.tripGenericText, { color: WARNING }]} numberOfLines={1}>
              Drop off to confirm with driver
            </Text>
          </View>
        )}
        <View style={[styles.tripStatsRow, { borderTopColor: colors.border }]}>
          <View style={styles.tripStatInline}>
            <Feather name="navigation" size={12} color={colors.primary} />
            <Text style={[styles.tripStatLabel, { color: colors.mutedForeground }]}>Distance</Text>
            <Text style={[styles.tripStatValue, { color: colors.foreground }]}>{ride.distance.toFixed(1)} km</Text>
          </View>
          <View style={styles.tripStatInline}>
            <Feather name="clock" size={12} color={colors.primary} />
            <Text style={[styles.tripStatLabel, { color: colors.mutedForeground }]}>ETA</Text>
            <Text style={[styles.tripStatValue, { color: colors.foreground }]}>~{ride.duration} min</Text>
          </View>
        </View>
      </View>

      <NegotiationStatusCard
        tone={chatStatus.tone}
        title={chatStatus.title}
        hint={chatStatus.hint}
        offersSent={messagesUsed}
        maxOffers={MAX_OFFERS}
        offersRemaining={offersRemaining}
      />
    </View>
  );
}
