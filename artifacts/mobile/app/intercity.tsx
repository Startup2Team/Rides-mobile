import React, { useEffect, useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, TouchableOpacity, View, useColorScheme } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { AppButton } from '@/components/AppButton';
import { AppText } from '@/components/AppText';
import { GlassHeader, useGlassHeaderMetrics } from '@/components/GlassHeader';
import { GlassScrollView } from '@/components/GlassScrollView';
import { IntercityStateCard } from '@/components/intercity/IntercityStateCard';
import { SeatStepper } from '@/components/intercity/SeatStepper';
import { icons } from '@/constants/icons';
import { radius } from '@/constants/radius';
import { semanticSpacing, spacing } from '@/constants/spacing';
import { FORM_BOTTOM_PADDING } from '@/constants/tabBar';
import { typography } from '@/constants/typography';
import {
  MAX_SEATS_PER_BOOKING,
  bookingStatusLabel,
  buildDayOptions,
  formatDepartureDate,
  formatDepartureTime,
  intercityErrorMessage,
  isActiveBooking,
  useIntercityBookingsQuery,
  useIntercityCorridorsQuery,
  type IntercityCorridor,
} from '@/domains/intercity';
import { useColors } from '@/hooks/useColors';
import { useIsOffline } from '@/hooks/useIsOffline';

const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 } as const;

/**
 * Intercity search — one screen, one action: pick a corridor, a day and a seat
 * count, then "Find trips".
 *
 * An in-flight booking is surfaced at the top from SERVER truth
 * (`GET /customer/intercity/bookings`), not from anything the app remembered:
 * after a force-kill or a cold start the passenger still lands on their ticket.
 */
export default function IntercityScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const headerMetrics = useGlassHeaderMetrics();
  const isDark = useColorScheme() === 'dark';
  const isOffline = useIsOffline();

  const dayOptions = useMemo(() => buildDayOptions(), []);
  const [corridorCode, setCorridorCode] = useState<string | null>(null);
  const [dateKey, setDateKey] = useState<string>(dayOptions[0]?.key ?? '');
  const [seats, setSeats] = useState(1);

  const corridorsQuery = useIntercityCorridorsQuery();
  const bookingsQuery = useIntercityBookingsQuery();

  const corridors = useMemo(() => corridorsQuery.data ?? [], [corridorsQuery.data]);
  const activeBooking = useMemo(
    () => (bookingsQuery.data ?? []).find(isActiveBooking) ?? null,
    [bookingsQuery.data],
  );

  // Preselect the only corridor there is — Phase 1 ships one, and making the
  // passenger tap it would be ceremony.
  useEffect(() => {
    if (!corridorCode && corridors.length === 1) {
      setCorridorCode(corridors[0].code);
    }
  }, [corridorCode, corridors]);

  const canSearch = Boolean(corridorCode && dateKey);

  const handleSearch = () => {
    if (!canSearch) return;
    router.push({
      pathname: '/intercity-results',
      params: { corridor: corridorCode ?? '', date: dateKey, seats: String(seats) },
    });
  };

  const corridorsState = renderCorridorsState({
    isLoading: corridorsQuery.isLoading,
    isError: corridorsQuery.isError,
    error: corridorsQuery.error,
    isEmpty: corridors.length === 0,
    isOffline,
    onRetry: () => void corridorsQuery.refetch(),
  });

  return (
    <View style={[styles.root, { backgroundColor: isDark ? '#000' : '#F2F2F7' }]}>
      <GlassHeader title="Intercity" subtitle="Book a seat between cities" onBackPress={() => router.back()} />

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
        onRefresh={() => {
          void corridorsQuery.refetch();
          void bookingsQuery.refetch();
        }}
        refreshing={corridorsQuery.isFetching || bookingsQuery.isFetching}
        refreshIndicatorTop={headerMetrics.headerInset + 44}
      >
        {activeBooking ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`Your booking: ${bookingStatusLabel(activeBooking.status)}, ${activeBooking.seats} ${activeBooking.seats === 1 ? 'seat' : 'seats'}`}
            accessibilityHint="Opens your intercity ticket"
            activeOpacity={0.8}
            onPress={() =>
              router.push({ pathname: '/intercity-ticket', params: { bookingId: activeBooking.id } })
            }
            style={[styles.ticketLink, { backgroundColor: colors.surface, borderColor: colors.primary }]}
          >
            <Feather name="bookmark" size={icons.size.md} color={colors.primary} />
            <View style={styles.ticketCopy}>
              <AppText style={[styles.ticketTitle, { color: colors.foreground }]}>
                {bookingStatusLabel(activeBooking.status)} · {activeBooking.seats}{' '}
                {activeBooking.seats === 1 ? 'seat' : 'seats'}
              </AppText>
              {activeBooking.trip ? (
                <AppText style={[styles.ticketDetail, { color: colors.mutedForeground }]}>
                  {activeBooking.trip.originName} → {activeBooking.trip.destinationName} ·{' '}
                  {formatDepartureDate(activeBooking.trip.departAt)}{' '}
                  {formatDepartureTime(activeBooking.trip.departAt)}
                </AppText>
              ) : null}
            </View>
            <Feather name="chevron-right" size={icons.semantic.row} color={colors.mutedForeground} />
          </TouchableOpacity>
        ) : null}

        <Section title="Route">
          {corridorsState ? (
            corridorsState
          ) : (
            <View style={styles.corridorList}>
              {corridors.map(corridor => (
                <CorridorCard
                  key={corridor.code}
                  corridor={corridor}
                  selected={corridor.code === corridorCode}
                  onPress={() => setCorridorCode(corridor.code)}
                />
              ))}
            </View>
          )}
        </Section>

        <Section title="Day">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dayStrip}
          >
            {dayOptions.map(option => {
              const selected = option.key === dateKey;
              return (
                <TouchableOpacity
                  key={option.key}
                  accessibilityRole="radio"
                  accessibilityLabel={option.label}
                  accessibilityState={{ checked: selected }}
                  hitSlop={HIT_SLOP}
                  onPress={() => setDateKey(option.key)}
                  style={[
                    styles.dayChip,
                    {
                      backgroundColor: selected ? colors.primary : colors.surface,
                      borderColor: selected ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <AppText
                    style={[styles.dayChipText, { color: selected ? '#FFFFFF' : colors.foreground }]}
                  >
                    {option.label}
                  </AppText>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </Section>

        <Section title="Seats">
          <SeatStepper value={seats} min={1} max={MAX_SEATS_PER_BOOKING} onChange={setSeats} />
          <AppText style={[styles.hint, { color: colors.mutedForeground }]}>
            You pay the driver in cash when you board.
          </AppText>
        </Section>

        <View style={styles.actions}>
          <AppButton
            title="Find trips"
            onPress={handleSearch}
            disabled={!canSearch}
            fullWidth
            size="lg"
            accessibilityLabel="Find intercity trips"
          />
        </View>
      </GlassScrollView>
    </View>
  );
}

function renderCorridorsState(input: {
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  isEmpty: boolean;
  isOffline: boolean;
  onRetry: () => void;
}): React.ReactElement | null {
  if (input.isLoading) {
    return <IntercityStateCard icon="loader" title="Loading routes" detail="Fetching the corridors we serve." />;
  }
  if (input.isError) {
    return input.isOffline ? (
      <IntercityStateCard
        icon="wifi-off"
        title="You are offline"
        detail="Connect to the internet to see intercity routes."
        tone="warning"
        actionLabel="Try again"
        onAction={input.onRetry}
      />
    ) : (
      <IntercityStateCard
        icon="alert-triangle"
        title="Could not load routes"
        detail={intercityErrorMessage(input.error)}
        tone="error"
        actionLabel="Try again"
        onAction={input.onRetry}
      />
    );
  }
  if (input.isEmpty) {
    return (
      <IntercityStateCard
        icon="map"
        title="No routes yet"
        detail="Intercity is not running on any route right now. Check back soon."
      />
    );
  }
  return null;
}

function CorridorCard({
  corridor,
  onPress,
  selected,
}: {
  corridor: IntercityCorridor;
  onPress: () => void;
  selected: boolean;
}) {
  const colors = useColors();
  return (
    <TouchableOpacity
      accessibilityRole="radio"
      accessibilityLabel={`${corridor.originName} to ${corridor.destinationName}`}
      accessibilityState={{ checked: selected }}
      activeOpacity={0.8}
      onPress={onPress}
      style={[
        styles.corridorCard,
        {
          backgroundColor: selected ? `${colors.primaryHex}0A` : colors.surface,
          borderColor: selected ? colors.primary : colors.border,
        },
      ]}
    >
      <View style={styles.corridorCopy}>
        <AppText style={[styles.corridorTitle, { color: colors.foreground }]}>
          {corridor.originName}
        </AppText>
        <Feather name="arrow-right" size={icons.size.sm} color={colors.mutedForeground} />
        <AppText style={[styles.corridorTitle, { color: colors.foreground }]}>
          {corridor.destinationName}
        </AppText>
      </View>
      <View
        style={[
          styles.radio,
          {
            borderColor: selected ? colors.primary : colors.border,
            backgroundColor: selected ? colors.primary : 'transparent',
          },
        ]}
      >
        {selected ? <Feather name="check" size={14} color="#fff" /> : null}
      </View>
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
  section: { marginHorizontal: semanticSpacing.cardPadding, marginBottom: semanticSpacing.sectionGap, gap: spacing[10] },
  sectionTitle: { ...typography.tiny, textTransform: 'uppercase', letterSpacing: 0.6 },
  corridorList: { gap: spacing[10] },
  corridorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[10],
    minHeight: 60,
    paddingHorizontal: semanticSpacing.cardPadding,
    paddingVertical: spacing[14],
    borderRadius: radius.sheetCompact,
    borderWidth: 1.5,
  },
  corridorCopy: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing[8], flexWrap: 'wrap' },
  corridorTitle: { ...typography.bodySmall },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  dayStrip: { gap: spacing[8], paddingRight: semanticSpacing.cardPadding },
  dayChip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: semanticSpacing.cardPadding,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  dayChipText: { ...typography.label },
  hint: { ...typography.tiny, lineHeight: 16 },
  actions: { marginHorizontal: semanticSpacing.cardPadding, marginTop: spacing[4] },
  ticketLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[10],
    marginHorizontal: semanticSpacing.cardPadding,
    marginBottom: semanticSpacing.sectionGap,
    paddingHorizontal: semanticSpacing.cardPadding,
    paddingVertical: spacing[14],
    borderRadius: radius.sheetCompact,
    borderWidth: 1.5,
    minHeight: 64,
  },
  ticketCopy: { flex: 1, gap: spacing[2] },
  ticketTitle: { ...typography.label },
  ticketDetail: { ...typography.tiny, lineHeight: 16 },
});
