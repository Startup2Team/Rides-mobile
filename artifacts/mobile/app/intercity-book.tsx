import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform, StyleSheet, View, useColorScheme } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { AppButton } from '@/components/AppButton';
import { AppText } from '@/components/AppText';
import { GlassHeader, useGlassHeaderMetrics } from '@/components/GlassHeader';
import { GlassScrollView } from '@/components/GlassScrollView';
import { IntercityStateCard } from '@/components/intercity/IntercityStateCard';
import { SeatStepper } from '@/components/intercity/SeatStepper';
import { SeatsRemaining } from '@/components/intercity/SeatsRemaining';
import { icons } from '@/constants/icons';
import { radius } from '@/constants/radius';
import { semanticSpacing, spacing } from '@/constants/spacing';
import { FORM_BOTTOM_PADDING } from '@/constants/tabBar';
import { typography } from '@/constants/typography';
import {
  classifyIntercityError,
  clampSeatSelection,
  formatDepartureDate,
  formatDepartureTime,
  formatRwf,
  holdStatus,
  intercityErrorMessage,
  isSoldOut,
  selectableSeats,
  totalPriceRwf,
  useCancelIntercityBookingMutation,
  useConfirmBookingMutation,
  useHoldSeatsMutation,
  useIntercityTripQuery,
  type IntercityBooking,
  type IntercityFailure,
} from '@/domains/intercity';
import { useColors } from '@/hooks/useColors';
import { useIsOffline } from '@/hooks/useIsOffline';
import { generateIdempotencyKey } from '@/utils/idempotencyKey';

/**
 * Hold, then confirm.
 *
 * The hold is a five-minute reservation (INTERCITY_DESIGN §4). Its countdown
 * is derived from `hold_expires_at` against the wall clock on every tick —
 * never decremented from a local counter — so backgrounding the app, losing
 * the network, or killing and reopening it all show the same, correct, time.
 *
 * `409 SEATS_UNAVAILABLE` is an expected outcome here, not a failure: someone
 * else took the last seats between the render and the tap. It renders as a
 * recoverable message and the trip is refetched underneath it.
 */
export default function IntercityBookScreen() {
  const params = useLocalSearchParams<{ tripId?: string; seats?: string }>();
  const tripId = typeof params.tripId === 'string' ? params.tripId : '';
  const requestedSeats = Math.max(1, Number.parseInt(String(params.seats ?? '1'), 10) || 1);

  const colors = useColors();
  const insets = useSafeAreaInsets();
  const headerMetrics = useGlassHeaderMetrics();
  const isDark = useColorScheme() === 'dark';
  const isOffline = useIsOffline();

  const tripQuery = useIntercityTripQuery(tripId);
  const trip = tripQuery.data ?? null;

  const [seats, setSeats] = useState(requestedSeats);
  const [booking, setBooking] = useState<IntercityBooking | null>(null);
  const [failure, setFailure] = useState<IntercityFailure | null>(null);
  const [now, setNow] = useState(() => Date.now());
  // Stable per (trip, seat count) so a transport retry of the SAME attempt is
  // deduped server-side instead of consuming the seats twice.
  const holdKeyRef = useRef<{ signature: string; key: string } | null>(null);

  const holdMutation = useHoldSeatsMutation();
  const confirmMutation = useConfirmBookingMutation();
  const releaseMutation = useCancelIntercityBookingMutation();

  const maxSeats = trip ? selectableSeats(trip) : 0;

  // Keep the selection inside what the trip can actually sell. When a refetch
  // shrinks availability the stepper follows it down rather than offering a
  // number the server is certain to refuse.
  useEffect(() => {
    if (!trip || booking) return;
    setSeats(current => {
      const clamped = clampSeatSelection(current, trip);
      return clamped === 0 ? current : clamped;
    });
  }, [booking, trip]);

  const hold = useMemo(
    () => holdStatus(booking?.holdExpiresAt ?? null, now),
    [booking?.holdExpiresAt, now],
  );
  const isHolding = booking?.status === 'HELD' && hold.state === 'active';
  const isExpired = booking?.status === 'HELD' && hold.state === 'expired';

  // One ticking clock, driving a value that is always recomputed from the
  // expiry instant. Stops the moment there is nothing counting down.
  useEffect(() => {
    if (!booking?.holdExpiresAt || hold.state !== 'active') return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [booking?.holdExpiresAt, hold.state]);

  // Resuming from background must not show a stale countdown for a frame.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') setNow(Date.now());
    });
    return () => subscription.remove();
  }, []);

  const handleRecoverableFailure = useCallback(
    (error: unknown) => {
      const classified = classifyIntercityError(error);
      setFailure(classified);
      if (classified.shouldRefresh) {
        setBooking(null);
        holdKeyRef.current = null;
        void tripQuery.refetch();
      }
    },
    [tripQuery],
  );

  const handleHold = () => {
    if (!trip || seats <= 0) return;
    setFailure(null);
    const signature = `${trip.id}:${seats}`;
    if (holdKeyRef.current?.signature !== signature) {
      holdKeyRef.current = { signature, key: generateIdempotencyKey('intercity-hold') };
    }
    holdMutation.mutate(
      { tripId: trip.id, seats, idempotencyKey: holdKeyRef.current.key },
      {
        onSuccess: held => {
          setBooking(held);
          setNow(Date.now());
        },
        onError: handleRecoverableFailure,
      },
    );
  };

  const handleConfirm = () => {
    if (!booking || !trip) return;
    setFailure(null);
    confirmMutation.mutate(
      { bookingId: booking.id, tripId: trip.id },
      {
        onSuccess: confirmed => {
          router.replace({ pathname: '/intercity-ticket', params: { bookingId: confirmed.id } });
        },
        onError: handleRecoverableFailure,
      },
    );
  };

  const resetToSelection = useCallback(() => {
    setBooking(null);
    setFailure(null);
    holdKeyRef.current = null;
    void tripQuery.refetch();
  }, [tripQuery]);

  // Giving the seats back is a SERVER action. Dropping the booking from local
  // state alone would leave a live HELD row holding inventory for five minutes
  // while the passenger believes they released it.
  const handleRelease = () => {
    if (!booking || !trip) {
      resetToSelection();
      return;
    }
    releaseMutation.mutate(
      { bookingId: booking.id, tripId: trip.id },
      { onSettled: resetToSelection },
    );
  };

  if (!tripId) {
    return (
      <Shell isDark={isDark} headerMetrics={headerMetrics} insets={insets} title="Book seats">
        <IntercityStateCard
          icon="alert-circle"
          title="Trip not found"
          detail="This trip link is not valid any more."
          tone="error"
          actionLabel="Back to trips"
          onAction={() => router.back()}
        />
      </Shell>
    );
  }

  if (tripQuery.isLoading) {
    return (
      <Shell isDark={isDark} headerMetrics={headerMetrics} insets={insets} title="Book seats">
        <IntercityStateCard icon="loader" title="Loading trip" detail="Checking live seat availability." />
      </Shell>
    );
  }

  if (tripQuery.isError || !trip) {
    return (
      <Shell isDark={isDark} headerMetrics={headerMetrics} insets={insets} title="Book seats">
        {isOffline ? (
          <IntercityStateCard
            icon="wifi-off"
            title="You are offline"
            detail="Seats cannot be held offline — the server decides who gets them. Reconnect and try again."
            tone="warning"
            actionLabel="Try again"
            onAction={() => void tripQuery.refetch()}
          />
        ) : (
          <IntercityStateCard
            icon="alert-triangle"
            title="Could not load this trip"
            detail={intercityErrorMessage(tripQuery.error)}
            tone="error"
            actionLabel="Try again"
            onAction={() => void tripQuery.refetch()}
          />
        )}
      </Shell>
    );
  }

  const soldOut = isSoldOut(trip) && !isHolding;
  const total = totalPriceRwf(seats, trip.pricePerSeatRwf);

  return (
    <Shell
      isDark={isDark}
      headerMetrics={headerMetrics}
      insets={insets}
      title="Book seats"
      subtitle={`${trip.originName} → ${trip.destinationName}`}
    >
      <View style={[styles.tripCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.tripHeader}>
          <View style={styles.tripHeaderCopy}>
            <AppText style={[styles.departTime, { color: colors.foreground }]}>
              {formatDepartureTime(trip.departAt)}
            </AppText>
            <AppText style={[styles.departDate, { color: colors.mutedForeground }]}>
              {formatDepartureDate(trip.departAt)}
            </AppText>
          </View>
          <SeatsRemaining remaining={trip.remainingSeats} />
        </View>

        <DetailRow icon="users" label="Operator" value={trip.operatorName?.trim() || 'Rides operator'} />
        {trip.vehicleLabel || trip.plateNumber ? (
          <DetailRow
            icon="truck"
            label="Vehicle"
            value={[trip.vehicleLabel, trip.plateNumber].filter(Boolean).join(' · ')}
          />
        ) : null}
        <DetailRow icon="map-pin" label="Boarding point" value={trip.stagingAddress} />
        <DetailRow icon="tag" label="Price per seat" value={formatRwf(trip.pricePerSeatRwf)} />
      </View>

      {failure ? (
        <View
          accessible
          accessibilityRole="alert"
          accessibilityLabel={failure.message}
          style={[styles.notice, { borderColor: `${colors.destructiveHex}40`, backgroundColor: `${colors.destructiveHex}10` }]}
        >
          <Feather name="alert-circle" size={icons.size.sm} color={colors.destructive} />
          <AppText style={[styles.noticeText, { color: colors.destructive }]}>{failure.message}</AppText>
        </View>
      ) : null}

      {soldOut ? (
        <IntercityStateCard
          icon="slash"
          title="Sold out"
          detail="Every seat on this departure is taken. Another operator may still have seats on this route."
          actionLabel="Back to trips"
          onAction={() => router.back()}
        />
      ) : isExpired ? (
        <IntercityStateCard
          icon="clock"
          title="Hold expired"
          detail="Your seats were released so someone else could book them. You can try to hold them again."
          tone="warning"
          actionLabel="Hold seats again"
          onAction={resetToSelection}
        />
      ) : (
        <>
          {!booking ? (
            <View style={styles.section}>
              <AppText style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
                How many seats
              </AppText>
              <SeatStepper
                value={seats}
                min={1}
                max={Math.max(1, maxSeats)}
                onChange={next => {
                  setSeats(next);
                  setFailure(null);
                }}
                disabled={holdMutation.isPending}
              />
            </View>
          ) : null}

          {isHolding ? (
            <View
              accessible
              accessibilityRole="timer"
              accessibilityLabel={`Seats held. ${hold.label} left to confirm`}
              style={[styles.holdBanner, { backgroundColor: `${colors.warningHex}14`, borderColor: `${colors.warningHex}40` }]}
            >
              <Feather name="clock" size={icons.size.md} color={colors.warning} />
              <View style={styles.holdCopy}>
                <AppText style={[styles.holdTitle, { color: colors.warning }]}>
                  Seats held · {hold.label}
                </AppText>
                <AppText style={[styles.holdDetail, { color: colors.mutedForeground }]}>
                  Confirm before the timer runs out or the seats go back on sale.
                </AppText>
              </View>
            </View>
          ) : null}

          <View style={[styles.totalRow, { borderColor: colors.border }]}>
            <View>
              <AppText style={[styles.totalLabel, { color: colors.mutedForeground }]}>
                {booking ? booking.seats : seats} × {formatRwf(trip.pricePerSeatRwf)}
              </AppText>
              <AppText style={[styles.totalValue, { color: colors.foreground }]}>
                {formatRwf(booking ? booking.seats * booking.pricePerSeatRwf : total)}
              </AppText>
            </View>
            <View style={[styles.cashChip, { backgroundColor: colors.muted }]}>
              <Feather name="dollar-sign" size={icons.size.xs} color={colors.mutedForeground} />
              <AppText style={[styles.cashChipText, { color: colors.mutedForeground }]}>
                Cash on board
              </AppText>
            </View>
          </View>

          <View style={styles.actions}>
            <AppButton
              title={isHolding ? 'Confirm booking' : 'Hold these seats'}
              onPress={isHolding ? handleConfirm : handleHold}
              loading={holdMutation.isPending || confirmMutation.isPending}
              disabled={
                holdMutation.isPending || confirmMutation.isPending || (!isHolding && maxSeats <= 0)
              }
              fullWidth
              size="lg"
              accessibilityLabel={
                isHolding
                  ? `Confirm booking for ${booking?.seats ?? seats} seats`
                  : `Hold ${seats} ${seats === 1 ? 'seat' : 'seats'} for five minutes`
              }
            />
            {isHolding ? (
              <AppButton
                title="Release seats"
                onPress={handleRelease}
                variant="plain"
                loading={releaseMutation.isPending}
                disabled={releaseMutation.isPending || confirmMutation.isPending}
                fullWidth
                accessibilityLabel="Release the held seats and go back"
              />
            ) : null}
          </View>
        </>
      )}
    </Shell>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  value: string;
}) {
  const colors = useColors();
  return (
    <View accessible accessibilityLabel={`${label}: ${value}`} style={styles.detailRow}>
      <Feather name={icon} size={icons.size.sm} color={colors.mutedForeground} />
      <AppText style={[styles.detailLabel, { color: colors.mutedForeground }]}>{label}</AppText>
      <AppText numberOfLines={2} style={[styles.detailValue, { color: colors.foreground }]}>
        {value}
      </AppText>
    </View>
  );
}

function Shell({
  children,
  headerMetrics,
  insets,
  isDark,
  subtitle,
  title,
}: {
  children: React.ReactNode;
  headerMetrics: ReturnType<typeof useGlassHeaderMetrics>;
  insets: { bottom: number };
  isDark: boolean;
  subtitle?: string;
  title: string;
}) {
  return (
    <View style={[styles.root, { backgroundColor: isDark ? '#000' : '#F2F2F7' }]}>
      <GlassHeader title={title} subtitle={subtitle} onBackPress={() => router.back()} />
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
      >
        {children}
      </GlassScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  tripCard: {
    marginHorizontal: semanticSpacing.cardPadding,
    marginBottom: semanticSpacing.rowGap,
    padding: semanticSpacing.cardPadding,
    borderRadius: radius.sheetCompact,
    borderWidth: 1,
    gap: spacing[10],
  },
  tripHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[12] },
  tripHeaderCopy: { flex: 1, gap: spacing[2] },
  departTime: { ...typography.display, lineHeight: 34 },
  departDate: { ...typography.caption },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[8] },
  detailLabel: { ...typography.tiny, width: 92 },
  detailValue: { ...typography.caption, flex: 1, lineHeight: 18 },
  section: { marginHorizontal: semanticSpacing.cardPadding, marginBottom: semanticSpacing.rowGap, gap: spacing[10] },
  sectionTitle: { ...typography.tiny, textTransform: 'uppercase', letterSpacing: 0.6 },
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
  noticeText: { ...typography.caption, flex: 1, lineHeight: 18 },
  holdBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[10],
    marginHorizontal: semanticSpacing.cardPadding,
    marginBottom: semanticSpacing.rowGap,
    padding: semanticSpacing.cardPadding,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  holdCopy: { flex: 1, gap: spacing[2] },
  holdTitle: { ...typography.label },
  holdDetail: { ...typography.tiny, lineHeight: 16 },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[12],
    marginHorizontal: semanticSpacing.cardPadding,
    marginBottom: semanticSpacing.rowGap,
    paddingVertical: spacing[14],
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  totalLabel: { ...typography.tiny },
  totalValue: { ...typography.h2, lineHeight: 28 },
  cashChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    paddingHorizontal: spacing[10],
    paddingVertical: spacing[6],
    borderRadius: radius.pill,
  },
  cashChipText: { ...typography.tiny },
  actions: { marginHorizontal: semanticSpacing.cardPadding, gap: spacing[8] },
});
