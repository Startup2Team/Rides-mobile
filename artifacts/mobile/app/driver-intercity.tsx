import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Platform, StyleSheet, TouchableOpacity, View, useColorScheme } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { AppButton } from '@/components/AppButton';
import { AppInput } from '@/components/AppInput';
import { AppText } from '@/components/AppText';
import { GlassHeader, useGlassHeaderMetrics } from '@/components/GlassHeader';
import { GlassScrollView } from '@/components/GlassScrollView';
import { IntercityStateCard } from '@/components/intercity/IntercityStateCard';
import { SeatsRemaining } from '@/components/intercity/SeatsRemaining';
import { TimePickerField } from '@/components/intercity/TimePickerField';
import { icons } from '@/constants/icons';
import { radius } from '@/constants/radius';
import { semanticSpacing, spacing } from '@/constants/spacing';
import { FORM_BOTTOM_PADDING } from '@/constants/tabBar';
import { typography } from '@/constants/typography';
import {
  buildDayOptions,
  classifyIntercityError,
  formatDepartureDate,
  formatDepartureTime,
  formatRwf,
  tripStatusLabel,
  useDriverIntercityTripsQuery,
  useIntercityCorridorsQuery,
  useIntercityDriverVehiclesQuery,
  usePublishIntercityTripMutation,
  type IntercityFailure,
  type IntercityTrip,
} from '@/domains/intercity';
import { useColors } from '@/hooks/useColors';
import { useIsOffline } from '@/hooks/useIsOffline';

const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 } as const;
const MAX_TOTAL_SEATS = 30;

/**
 * Publish an intercity departure.
 *
 * One flow for both operator kinds (INTERCITY_DESIGN §15): a bus company with
 * a Coaster and an individual with a cab fill in exactly the same form. The
 * seat ceiling comes from the chosen vehicle's registered capacity, so an
 * 18-seater and a 4-seater need no special case.
 *
 * The server owns everything that matters: it derives the corridor's
 * origin/destination points, resolves the operator from the caller, and
 * refuses a departure outside NOW..NOW+7d or a driver without credits (402).
 */
export default function DriverIntercityScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const headerMetrics = useGlassHeaderMetrics();
  const isDark = useColorScheme() === 'dark';
  const isOffline = useIsOffline();

  const dayOptions = useMemo(() => buildDayOptions(), []);
  const corridorsQuery = useIntercityCorridorsQuery();
  const vehiclesQuery = useIntercityDriverVehiclesQuery();
  const tripsQuery = useDriverIntercityTripsQuery();
  const publishMutation = usePublishIntercityTripMutation();

  const corridors = useMemo(() => corridorsQuery.data ?? [], [corridorsQuery.data]);
  const vehicles = useMemo(() => vehiclesQuery.data ?? [], [vehiclesQuery.data]);
  const trips = useMemo(() => tripsQuery.data ?? [], [tripsQuery.data]);

  const [corridorCode, setCorridorCode] = useState<string | null>(null);
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [dateKey, setDateKey] = useState(dayOptions[0]?.key ?? '');
  const [departTime, setDepartTime] = useState(() => {
    const next = new Date();
    next.setHours(next.getHours() + 2, 0, 0, 0);
    return next;
  });
  const [totalSeats, setTotalSeats] = useState('');
  const [price, setPrice] = useState('');
  const [staging, setStaging] = useState('');
  const [failure, setFailure] = useState<IntercityFailure | null>(null);

  useEffect(() => {
    if (!corridorCode && corridors.length === 1) setCorridorCode(corridors[0].code);
  }, [corridorCode, corridors]);

  useEffect(() => {
    if (vehicleId) return;
    const preferred = vehicles.find(vehicle => vehicle.isActive) ?? vehicles[0];
    if (preferred) setVehicleId(preferred.id);
  }, [vehicleId, vehicles]);

  const selectedVehicle = vehicles.find(vehicle => vehicle.id === vehicleId) ?? null;
  const seatCeiling = Math.min(
    MAX_TOTAL_SEATS,
    Math.max(1, selectedVehicle?.passengerSeats ?? MAX_TOTAL_SEATS),
  );

  const seatsValue = Number.parseInt(totalSeats, 10);
  const priceValue = Number.parseInt(price, 10);
  const seatsError =
    totalSeats && (!Number.isFinite(seatsValue) || seatsValue < 1 || seatsValue > seatCeiling)
      ? `Enter 1 to ${seatCeiling} seats`
      : undefined;
  const priceError =
    price && (!Number.isFinite(priceValue) || priceValue < 1 || priceValue > 500000)
      ? 'Enter a price between 1 and 500,000 RWF'
      : undefined;

  const departAt = useMemo(() => {
    const day = dayOptions.find(option => option.key === dateKey)?.date ?? new Date();
    const combined = new Date(day);
    combined.setHours(departTime.getHours(), departTime.getMinutes(), 0, 0);
    return combined;
  }, [dateKey, dayOptions, departTime]);

  const departInPast = departAt.getTime() <= Date.now();

  const canPublish =
    Boolean(corridorCode && vehicleId && staging.trim().length >= 3) &&
    !seatsError &&
    !priceError &&
    Number.isFinite(seatsValue) &&
    seatsValue >= 1 &&
    Number.isFinite(priceValue) &&
    priceValue >= 1 &&
    !departInPast &&
    !publishMutation.isPending;

  const handlePublish = () => {
    if (!canPublish || !corridorCode || !vehicleId) return;
    setFailure(null);
    publishMutation.mutate(
      {
        corridor: corridorCode,
        vehicleId,
        departAt: departAt.toISOString(),
        totalSeats: seatsValue,
        pricePerSeatRwf: priceValue,
        stagingAddress: staging.trim(),
      },
      {
        onSuccess: trip => {
          setTotalSeats('');
          setPrice('');
          setStaging('');
          router.push({ pathname: '/driver-intercity-trip', params: { tripId: trip.id } });
        },
        onError: error => setFailure(classifyIntercityError(error)),
      },
    );
  };

  const blocker = !corridorsQuery.isLoading && corridors.length === 0
    ? (
        <IntercityStateCard
          icon="map"
          title="No routes available"
          detail={
            isOffline
              ? 'Connect to the internet to load the routes you can publish on.'
              : 'Rides is not running intercity on any route yet.'
          }
          tone={isOffline ? 'warning' : 'neutral'}
          actionLabel="Try again"
          onAction={() => void corridorsQuery.refetch()}
        />
      )
    : !vehiclesQuery.isLoading && vehicles.length === 0
      ? (
          <IntercityStateCard
            icon="truck"
            title="Add a vehicle first"
            detail="Intercity trips are published against a registered, approved vehicle."
            actionLabel="My vehicles"
            onAction={() => router.push('/driver-vehicles')}
          />
        )
      : null;

  return (
    <View style={[styles.root, { backgroundColor: isDark ? '#000' : '#F2F2F7' }]}>
      <GlassHeader
        title="Intercity"
        subtitle="Publish a scheduled departure"
        onBackPress={() => router.back()}
      />

      <GlassScrollView
        style={styles.root}
        indicatorTop={headerMetrics.indicatorTop}
        contentContainerStyle={{
          paddingTop: Platform.OS === 'ios' ? 0 : headerMetrics.contentTop,
          paddingBottom: insets.bottom + FORM_BOTTOM_PADDING,
        }}
        contentInset={Platform.OS === 'ios' ? { top: headerMetrics.contentTop } : undefined}
        contentOffset={Platform.OS === 'ios' ? { x: 0, y: -headerMetrics.contentTop } : undefined}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <UpcomingTrips
          trips={trips}
          isLoading={tripsQuery.isLoading}
          onSelect={trip =>
            router.push({ pathname: '/driver-intercity-trip', params: { tripId: trip.id } })
          }
        />

        {blocker ? (
          <View style={styles.blockerWrap}>{blocker}</View>
        ) : (
          <>
            <Section title="Route">
              <View style={styles.chipWrap}>
                {corridors.map(corridor => (
                  <Chip
                    key={corridor.code}
                    label={`${corridor.originName} → ${corridor.destinationName}`}
                    selected={corridor.code === corridorCode}
                    onPress={() => setCorridorCode(corridor.code)}
                  />
                ))}
              </View>
            </Section>

            <Section title="Vehicle">
              <View style={styles.chipWrap}>
                {vehicles.map(vehicle => (
                  <Chip
                    key={vehicle.id}
                    label={[vehicle.plateNumber, vehicle.passengerSeats ? `${vehicle.passengerSeats} seats` : null]
                      .filter(Boolean)
                      .join(' · ')}
                    selected={vehicle.id === vehicleId}
                    onPress={() => setVehicleId(vehicle.id)}
                  />
                ))}
              </View>
            </Section>

            <Section title="Departure">
              <View style={styles.chipWrap}>
                {dayOptions.map(option => (
                  <Chip
                    key={option.key}
                    label={option.label}
                    selected={option.key === dateKey}
                    onPress={() => setDateKey(option.key)}
                  />
                ))}
              </View>
              <TimePickerField
                label="Time"
                value={departTime}
                onChange={setDepartTime}
                error={departInPast ? 'Pick a time in the future' : undefined}
              />
              <AppText style={[styles.hint, { color: colors.mutedForeground }]}>
                Passengers are told the vehicle never leaves before this time.
              </AppText>
            </Section>

            <Section title="Seats and price">
              <AppInput
                label={`Seats for sale (max ${seatCeiling})`}
                value={totalSeats}
                onChangeText={setTotalSeats}
                keyboardType="number-pad"
                placeholder={String(seatCeiling)}
                error={seatsError}
                accessibilityLabel="Number of seats for sale"
              />
              <AppInput
                label="Price per seat (RWF)"
                value={price}
                onChangeText={setPrice}
                keyboardType="number-pad"
                placeholder="5000"
                error={priceError}
                accessibilityLabel="Price per seat in Rwandan francs"
              />
              {Number.isFinite(seatsValue) && Number.isFinite(priceValue) && !seatsError && !priceError ? (
                <AppText style={[styles.hint, { color: colors.mutedForeground }]}>
                  A full vehicle collects {formatRwf(seatsValue * priceValue)} in cash on board.
                </AppText>
              ) : null}
            </Section>

            <Section title="Boarding point">
              <AppInput
                label="Where passengers meet you"
                value={staging}
                onChangeText={setStaging}
                placeholder="Nyabugogo taxi park, gate 3"
                maxLength={120}
                accessibilityLabel="Boarding point address"
              />
            </Section>

            {failure ? (
              <View
                accessible
                accessibilityRole="alert"
                accessibilityLabel={failure.message}
                style={[
                  styles.notice,
                  { borderColor: `${colors.destructiveHex}40`, backgroundColor: `${colors.destructiveHex}10` },
                ]}
              >
                <Feather name="alert-circle" size={icons.size.sm} color={colors.destructive} />
                <View style={styles.noticeCopy}>
                  <AppText style={[styles.noticeText, { color: colors.destructive }]}>
                    {failure.message}
                  </AppText>
                  {failure.kind === 'no-credits' ? (
                    <AppButton
                      title="Buy ride credits"
                      onPress={() => router.push('/driver-packages')}
                      variant="secondary"
                      size="sm"
                    />
                  ) : null}
                </View>
              </View>
            ) : null}

            <View style={styles.actions}>
              <AppButton
                title="Publish trip"
                onPress={handlePublish}
                disabled={!canPublish}
                loading={publishMutation.isPending}
                fullWidth
                size="lg"
                accessibilityLabel="Publish this intercity trip"
              />
            </View>
          </>
        )}
      </GlassScrollView>
    </View>
  );
}

function UpcomingTrips({
  isLoading,
  onSelect,
  trips,
}: {
  isLoading: boolean;
  onSelect: (trip: IntercityTrip) => void;
  trips: IntercityTrip[];
}) {
  const colors = useColors();

  if (isLoading && trips.length === 0) return null;
  if (trips.length === 0) return null;

  return (
    <View style={styles.upcoming}>
      <AppText style={[styles.sectionTitle, styles.upcomingTitle, { color: colors.mutedForeground }]}>
        Your trips
      </AppText>
      <FlatList
        horizontal
        data={trips}
        keyExtractor={trip => trip.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.upcomingStrip}
        renderItem={({ item }) => (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`${formatDepartureDate(item.departAt)} ${formatDepartureTime(item.departAt)}, ${item.originName} to ${item.destinationName}, ${tripStatusLabel(item.status)}, ${item.remainingSeats} of ${item.totalSeats} seats left`}
            accessibilityHint="Opens the manifest for this trip"
            activeOpacity={0.8}
            onPress={() => onSelect(item)}
            style={[styles.upcomingCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <AppText style={[styles.upcomingTime, { color: colors.foreground }]}>
              {formatDepartureTime(item.departAt)}
            </AppText>
            <AppText style={[styles.upcomingMeta, { color: colors.mutedForeground }]}>
              {formatDepartureDate(item.departAt)} · {tripStatusLabel(item.status)}
            </AppText>
            <SeatsRemaining remaining={item.remainingSeats} size="sm" />
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

function Chip({ label, onPress, selected }: { label: string; onPress: () => void; selected: boolean }) {
  const colors = useColors();
  return (
    <TouchableOpacity
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      hitSlop={HIT_SLOP}
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? colors.primary : colors.surface,
          borderColor: selected ? colors.primary : colors.border,
        },
      ]}
    >
      <AppText style={[styles.chipText, { color: selected ? '#FFFFFF' : colors.foreground }]}>
        {label}
      </AppText>
    </TouchableOpacity>
  );
}

function Section({ children, title }: { children: React.ReactNode; title: string }) {
  const colors = useColors();
  return (
    <View style={styles.section}>
      <AppText style={[styles.sectionTitle, { color: colors.mutedForeground }]}>{title}</AppText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  section: {
    marginHorizontal: semanticSpacing.cardPadding,
    marginBottom: semanticSpacing.sectionGap,
    gap: spacing[10],
  },
  sectionTitle: { ...typography.tiny, textTransform: 'uppercase', letterSpacing: 0.6 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[8] },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: semanticSpacing.cardPadding,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  chipText: { ...typography.label },
  hint: { ...typography.tiny, lineHeight: 16 },
  upcoming: { marginBottom: semanticSpacing.sectionGap, gap: spacing[10] },
  upcomingTitle: { marginHorizontal: semanticSpacing.cardPadding },
  upcomingStrip: { gap: spacing[10], paddingHorizontal: semanticSpacing.cardPadding },
  upcomingCard: {
    minWidth: 150,
    minHeight: 96,
    gap: spacing[4],
    padding: semanticSpacing.cardPadding,
    borderRadius: radius.sheetCompact,
    borderWidth: 1,
  },
  upcomingTime: { ...typography.h2, lineHeight: 26 },
  upcomingMeta: { ...typography.tiny, lineHeight: 16 },
  blockerWrap: { marginBottom: semanticSpacing.sectionGap },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[8],
    marginHorizontal: semanticSpacing.cardPadding,
    marginBottom: semanticSpacing.rowGap,
    padding: spacing[12],
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  noticeCopy: { flex: 1, gap: spacing[8] },
  noticeText: { ...typography.caption, lineHeight: 18 },
  actions: { marginHorizontal: semanticSpacing.cardPadding },
});
