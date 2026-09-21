import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View, useColorScheme } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { AppButton } from '@/components/AppButton';
import { AppInput } from '@/components/AppInput';
import { AppText } from '@/components/AppText';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { GlassHeader, useGlassHeaderMetrics } from '@/components/GlassHeader';
import { IntercityStateCard } from '@/components/intercity/IntercityStateCard';
import { SeatsRemaining } from '@/components/intercity/SeatsRemaining';
import { icons } from '@/constants/icons';
import { radius } from '@/constants/radius';
import { semanticSpacing, spacing } from '@/constants/spacing';
import { FORM_BOTTOM_PADDING } from '@/constants/tabBar';
import { typography } from '@/constants/typography';
import {
  bookingStatusLabel,
  formatDepartureDate,
  formatDepartureTime,
  formatRwf,
  intercityErrorMessage,
  totalPriceRwf,
  tripStatusLabel,
  useBoardPassengerMutation,
  useIntercityManifestQuery,
  useIntercityTripLifecycleMutation,
  useMarkNoShowMutation,
  type IntercityManifestPassenger,
  type IntercityTrip,
} from '@/domains/intercity';
import { useColors } from '@/hooks/useColors';
import { useIsOffline } from '@/hooks/useIsOffline';

/**
 * The driver's manifest: who is coming, how many seats each, and the two
 * actions that matter at the staging point — board, or mark a no-show.
 *
 * Passenger phone numbers are shown EXACTLY as the server sends them. The
 * §9 PII tier (masked at booking, full from `depart_at - 30min`) is a
 * server-side decision; this screen never unmasks, never stores, and never
 * reconstructs a number.
 */
export default function DriverIntercityTripScreen() {
  const params = useLocalSearchParams<{ tripId?: string }>();
  const tripId = typeof params.tripId === 'string' ? params.tripId : '';

  const colors = useColors();
  const insets = useSafeAreaInsets();
  const headerMetrics = useGlassHeaderMetrics();
  const isDark = useColorScheme() === 'dark';
  const isOffline = useIsOffline();

  const manifestQuery = useIntercityManifestQuery(tripId);
  const { refetch } = manifestQuery;
  const boardMutation = useBoardPassengerMutation();
  const noShowMutation = useMarkNoShowMutation();
  const lifecycleMutation = useIntercityTripLifecycleMutation();

  const [actionError, setActionError] = useState<string | null>(null);
  const [cancelVisible, setCancelVisible] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  const manifest = manifestQuery.data ?? null;
  const trip = manifest?.trip ?? null;
  const passengers = useMemo(() => manifest?.passengers ?? [], [manifest?.passengers]);

  const runLifecycle = (action: 'start' | 'complete' | 'cancel', reason?: string) => {
    if (!tripId) return;
    setActionError(null);
    lifecycleMutation.mutate(
      { tripId, action, reason },
      {
        onSuccess: () => {
          setCancelVisible(false);
          setCancelReason('');
          void refetch();
          if (action === 'complete' || action === 'cancel') router.back();
        },
        onError: error => {
          setCancelVisible(false);
          setActionError(intercityErrorMessage(error));
        },
      },
    );
  };

  if (!tripId) {
    return (
      <Shell headerMetrics={headerMetrics} isDark={isDark} title="Trip">
        <IntercityStateCard
          icon="alert-circle"
          title="Trip not found"
          detail="This trip link is not valid any more."
          tone="error"
          actionLabel="Back"
          onAction={() => router.back()}
        />
      </Shell>
    );
  }

  if (manifestQuery.isLoading) {
    return (
      <Shell headerMetrics={headerMetrics} isDark={isDark} title="Trip">
        <IntercityStateCard icon="loader" title="Loading manifest" detail="Fetching your passenger list." />
      </Shell>
    );
  }

  if (manifestQuery.isError || !manifest || !trip) {
    return (
      <Shell headerMetrics={headerMetrics} isDark={isDark} title="Trip">
        {isOffline ? (
          <IntercityStateCard
            icon="wifi-off"
            title="You are offline"
            detail="The manifest changes as people book, so we will not show you a stale one. Reconnect to load it."
            tone="warning"
            actionLabel="Try again"
            onAction={() => void refetch()}
          />
        ) : (
          <IntercityStateCard
            icon="alert-triangle"
            title="Could not load the manifest"
            detail={intercityErrorMessage(manifestQuery.error)}
            tone="error"
            actionLabel="Try again"
            onAction={() => void refetch()}
          />
        )}
      </Shell>
    );
  }

  const canStart = trip.status === 'OPEN' || trip.status === 'BOARDING';
  const canComplete = trip.status === 'IN_TRANSIT';
  const canCancel = trip.status === 'OPEN' || trip.status === 'BOARDING';
  const expectedCash = totalPriceRwf(manifest.seatsSold, trip.pricePerSeatRwf);

  return (
    <Shell
      headerMetrics={headerMetrics}
      isDark={isDark}
      title={`${trip.originName} → ${trip.destinationName}`}
      subtitle={`${formatDepartureDate(trip.departAt)} · ${formatDepartureTime(trip.departAt)}`}
    >
      <FlatList
        data={passengers}
        keyExtractor={passenger => passenger.bookingId}
        contentContainerStyle={{
          paddingTop: headerMetrics.contentTop,
          paddingBottom: insets.bottom + FORM_BOTTOM_PADDING,
        }}
        showsVerticalScrollIndicator={false}
        refreshing={manifestQuery.isFetching && passengers.length > 0}
        onRefresh={() => void refetch()}
        ListHeaderComponent={
          <View>
            <TripSummary trip={trip} seatsSold={manifest.seatsSold} expectedCash={expectedCash} />

            {actionError ? (
              <View
                accessible
                accessibilityRole="alert"
                accessibilityLabel={actionError}
                style={[
                  styles.notice,
                  { borderColor: `${colors.destructiveHex}40`, backgroundColor: `${colors.destructiveHex}10` },
                ]}
              >
                <Feather name="alert-circle" size={icons.size.sm} color={colors.destructive} />
                <AppText style={[styles.noticeText, { color: colors.destructive }]}>{actionError}</AppText>
              </View>
            ) : null}

            <View style={styles.actions}>
              {canStart ? (
                <AppButton
                  title="Start trip"
                  onPress={() => runLifecycle('start')}
                  loading={lifecycleMutation.isPending}
                  disabled={lifecycleMutation.isPending}
                  fullWidth
                  size="lg"
                  accessibilityLabel="Start this intercity trip"
                />
              ) : null}
              {canComplete ? (
                <AppButton
                  title="Complete trip"
                  onPress={() => runLifecycle('complete')}
                  loading={lifecycleMutation.isPending}
                  disabled={lifecycleMutation.isPending}
                  fullWidth
                  size="lg"
                  accessibilityLabel="Complete this intercity trip"
                />
              ) : null}
              {canCancel ? (
                <AppButton
                  title="Cancel trip"
                  onPress={() => setCancelVisible(true)}
                  variant="dangerPlain"
                  disabled={lifecycleMutation.isPending}
                  fullWidth
                  accessibilityLabel="Cancel this intercity trip"
                />
              ) : null}
            </View>

            <AppText style={[styles.listTitle, { color: colors.mutedForeground }]}>
              Passengers ({passengers.length})
            </AppText>
          </View>
        }
        renderItem={({ item }) => (
          <PassengerRow
            passenger={item}
            busy={boardMutation.isPending || noShowMutation.isPending}
            onBoard={() => {
              setActionError(null);
              boardMutation.mutate(
                { tripId, bookingId: item.bookingId },
                { onError: error => setActionError(intercityErrorMessage(error)) },
              );
            }}
            onNoShow={() => {
              setActionError(null);
              noShowMutation.mutate(
                { tripId, bookingId: item.bookingId },
                { onError: error => setActionError(intercityErrorMessage(error)) },
              );
            }}
          />
        )}
        ListEmptyComponent={
          <IntercityStateCard
            icon="users"
            title="No bookings yet"
            detail="Nobody has booked a seat on this departure yet. Passengers appear here as they book."
          />
        }
      />

      <ConfirmDialog visible={cancelVisible} onClose={() => setCancelVisible(false)}>
        <AppText style={[styles.dialogTitle, { color: colors.foreground }]}>Cancel this trip?</AppText>
        <AppText style={[styles.dialogBody, { color: colors.mutedForeground }]}>
          Every passenger is notified immediately with your reason, and all seats are released.
        </AppText>
        <AppInput
          label="Reason"
          value={cancelReason}
          onChangeText={setCancelReason}
          placeholder="Vehicle breakdown"
          maxLength={120}
          accessibilityLabel="Reason for cancelling the trip"
        />
        <View style={styles.dialogActions}>
          <AppButton
            title="Keep trip"
            onPress={() => setCancelVisible(false)}
            variant="secondary"
            fullWidth
          />
          <AppButton
            title="Cancel trip"
            onPress={() => runLifecycle('cancel', cancelReason.trim())}
            variant="danger"
            disabled={cancelReason.trim().length < 3 || lifecycleMutation.isPending}
            loading={lifecycleMutation.isPending}
            fullWidth
          />
        </View>
      </ConfirmDialog>
    </Shell>
  );
}

function TripSummary({
  expectedCash,
  seatsSold,
  trip,
}: {
  expectedCash: number;
  seatsSold: number;
  trip: IntercityTrip;
}) {
  const colors = useColors();
  return (
    <View style={[styles.summary, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.summaryTop}>
        <View style={styles.summaryCopy}>
          <AppText style={[styles.summaryStatus, { color: colors.mutedForeground }]}>
            {tripStatusLabel(trip.status)}
          </AppText>
          <AppText style={[styles.summarySeats, { color: colors.foreground }]}>
            {seatsSold} of {trip.totalSeats} seats sold
          </AppText>
          <AppText style={[styles.summaryMeta, { color: colors.mutedForeground }]}>
            {formatRwf(expectedCash)} to collect in cash · {formatRwf(trip.pricePerSeatRwf)} per seat
          </AppText>
        </View>
        <SeatsRemaining remaining={trip.remainingSeats} />
      </View>
      <View style={styles.summaryRow}>
        <Feather name="map-pin" size={icons.size.xs} color={colors.mutedForeground} />
        <AppText style={[styles.summaryMeta, { color: colors.mutedForeground, flex: 1 }]}>
          {trip.stagingAddress}
        </AppText>
      </View>
    </View>
  );
}

function PassengerRow({
  busy,
  onBoard,
  onNoShow,
  passenger,
}: {
  busy: boolean;
  onBoard: () => void;
  onNoShow: () => void;
  passenger: IntercityManifestPassenger;
}) {
  const colors = useColors();
  const actionable = passenger.status === 'CONFIRMED';
  const seatCopy = `${passenger.seats} ${passenger.seats === 1 ? 'seat' : 'seats'}`;

  return (
    <View
      style={[styles.passenger, { backgroundColor: colors.surface, borderColor: colors.border }]}
      accessible={false}
    >
      <View style={styles.passengerCopy}>
        <AppText style={[styles.passengerName, { color: colors.foreground }]}>
          {passenger.firstName}
        </AppText>
        <AppText
          accessibilityLabel={`${seatCopy}, ${bookingStatusLabel(passenger.status)}`}
          style={[styles.passengerMeta, { color: colors.mutedForeground }]}
        >
          {seatCopy} · {bookingStatusLabel(passenger.status)}
        </AppText>
        {passenger.phone ? (
          <AppText
            accessibilityLabel={
              passenger.phoneMasked
                ? 'Phone number hidden until closer to departure'
                : `Phone ${passenger.phone}`
            }
            style={[styles.passengerMeta, { color: colors.mutedForeground }]}
          >
            {passenger.phone}
          </AppText>
        ) : null}
      </View>

      {actionable ? (
        <View style={styles.passengerActions}>
          <AppButton
            title="Board"
            onPress={onBoard}
            size="sm"
            compact
            disabled={busy}
            accessibilityLabel={`Board ${passenger.firstName}, ${seatCopy}`}
          />
          <AppButton
            title="No-show"
            onPress={onNoShow}
            size="sm"
            variant="dangerPlain"
            compact
            disabled={busy}
            accessibilityLabel={`Mark ${passenger.firstName} as a no-show`}
          />
        </View>
      ) : null}
    </View>
  );
}

function Shell({
  children,
  headerMetrics,
  isDark,
  subtitle,
  title,
}: {
  children: React.ReactNode;
  headerMetrics: ReturnType<typeof useGlassHeaderMetrics>;
  isDark: boolean;
  subtitle?: string;
  title: string;
}) {
  return (
    <View style={[styles.root, { backgroundColor: isDark ? '#000' : '#F2F2F7' }]}>
      <GlassHeader title={title} subtitle={subtitle} onBackPress={() => router.back()} />
      <View style={[styles.body, { paddingTop: headerMetrics.contentTop }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1 },
  summary: {
    marginHorizontal: semanticSpacing.cardPadding,
    marginBottom: semanticSpacing.rowGap,
    padding: semanticSpacing.cardPadding,
    borderRadius: radius.sheetCompact,
    borderWidth: 1,
    gap: spacing[10],
  },
  summaryTop: { flexDirection: 'row', alignItems: 'center', gap: spacing[12] },
  summaryCopy: { flex: 1, gap: spacing[2] },
  summaryStatus: { ...typography.tiny, textTransform: 'uppercase', letterSpacing: 0.6 },
  summarySeats: { ...typography.h2, lineHeight: 28 },
  summaryMeta: { ...typography.tiny, lineHeight: 16 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[6] },
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
  actions: { marginHorizontal: semanticSpacing.cardPadding, gap: spacing[8], marginBottom: semanticSpacing.sectionGap },
  listTitle: {
    ...typography.tiny,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginHorizontal: semanticSpacing.cardPadding,
    marginBottom: spacing[10],
  },
  passenger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[12],
    marginHorizontal: semanticSpacing.cardPadding,
    marginBottom: spacing[10],
    padding: semanticSpacing.cardPadding,
    borderRadius: radius.sheetCompact,
    borderWidth: 1,
    minHeight: 72,
  },
  passengerCopy: { flex: 1, gap: spacing[2] },
  passengerName: { ...typography.bodySmall },
  passengerMeta: { ...typography.tiny, lineHeight: 16 },
  passengerActions: { gap: spacing[6] },
  dialogTitle: { ...typography.title, textAlign: 'center' },
  dialogBody: {
    ...typography.caption,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: spacing[8],
    marginBottom: semanticSpacing.cardPadding,
  },
  dialogActions: { marginTop: semanticSpacing.cardPadding, gap: spacing[8] },
});
