import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, Platform, StyleSheet, View, useColorScheme } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { AppButton } from '@/components/AppButton';
import { AppText } from '@/components/AppText';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { GlassHeader, useGlassHeaderMetrics } from '@/components/GlassHeader';
import { GlassScrollView } from '@/components/GlassScrollView';
import { IntercityStateCard } from '@/components/intercity/IntercityStateCard';
import { icons } from '@/constants/icons';
import { radius } from '@/constants/radius';
import { semanticSpacing, spacing } from '@/constants/spacing';
import { FORM_BOTTOM_PADDING } from '@/constants/tabBar';
import { typography } from '@/constants/typography';
import {
  bookingStatusLabel,
  bookingTotalRwf,
  canCancelBooking,
  formatDepartureDate,
  formatDepartureTime,
  formatRwf,
  holdStatus,
  intercityErrorMessage,
  useCancelIntercityBookingMutation,
  useIntercityBookingQuery,
  type IntercityBooking,
} from '@/domains/intercity';
import { useColors } from '@/hooks/useColors';
import { useIsOffline } from '@/hooks/useIsOffline';

/**
 * The passenger's ticket — read straight from the server on every focus.
 *
 * Nothing on this screen is remembered locally: a force-kill, a reinstall or a
 * second device all resolve to the same `GET /customer/intercity/bookings/:id`.
 * The driver cancelling the trip, the hold expiring, or the driver marking a
 * no-show all arrive as a status change here, each with its own designed state.
 */
export default function IntercityTicketScreen() {
  const params = useLocalSearchParams<{ bookingId?: string }>();
  const bookingId = typeof params.bookingId === 'string' ? params.bookingId : '';

  const colors = useColors();
  const insets = useSafeAreaInsets();
  const headerMetrics = useGlassHeaderMetrics();
  const isDark = useColorScheme() === 'dark';
  const isOffline = useIsOffline();

  const bookingQuery = useIntercityBookingQuery(bookingId);
  const { refetch } = bookingQuery;
  const cancelMutation = useCancelIntercityBookingMutation();

  const [confirmVisible, setConfirmVisible] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const booking = bookingQuery.data ?? null;

  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') setNow(Date.now());
    });
    return () => subscription.remove();
  }, []);

  const hold = useMemo(
    () => holdStatus(booking?.status === 'HELD' ? booking.holdExpiresAt : null, now),
    [booking?.holdExpiresAt, booking?.status, now],
  );

  useEffect(() => {
    if (hold.state !== 'active') return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [hold.state]);

  const handleCancel = () => {
    if (!booking) return;
    setCancelError(null);
    cancelMutation.mutate(
      { bookingId: booking.id, tripId: booking.tripId },
      {
        onSuccess: () => {
          setConfirmVisible(false);
          void refetch();
        },
        onError: error => {
          setConfirmVisible(false);
          setCancelError(intercityErrorMessage(error));
        },
      },
    );
  };

  if (!bookingId) {
    return (
      <Shell headerMetrics={headerMetrics} insets={insets} isDark={isDark} title="Your ticket">
        <IntercityStateCard
          icon="alert-circle"
          title="Ticket not found"
          detail="This ticket link is not valid any more."
          tone="error"
          actionLabel="Back"
          onAction={() => router.back()}
        />
      </Shell>
    );
  }

  if (bookingQuery.isLoading) {
    return (
      <Shell headerMetrics={headerMetrics} insets={insets} isDark={isDark} title="Your ticket">
        <IntercityStateCard icon="loader" title="Loading ticket" detail="Fetching your booking." />
      </Shell>
    );
  }

  if (bookingQuery.isError || !booking) {
    return (
      <Shell headerMetrics={headerMetrics} insets={insets} isDark={isDark} title="Your ticket">
        {isOffline ? (
          <IntercityStateCard
            icon="wifi-off"
            title="You are offline"
            detail="We will show your ticket as soon as you are back online."
            tone="warning"
            actionLabel="Try again"
            onAction={() => void refetch()}
          />
        ) : (
          <IntercityStateCard
            icon="alert-triangle"
            title="Could not load your ticket"
            detail={intercityErrorMessage(bookingQuery.error)}
            tone="error"
            actionLabel="Try again"
            onAction={() => void refetch()}
          />
        )}
      </Shell>
    );
  }

  const trip = booking.trip;
  const cancellable = canCancelBooking(booking);

  return (
    <Shell
      headerMetrics={headerMetrics}
      insets={insets}
      isDark={isDark}
      title="Your ticket"
      subtitle={trip ? `${trip.originName} → ${trip.destinationName}` : undefined}
    >
      <StatusBanner booking={booking} holdLabel={hold.state === 'active' ? hold.label : null} />

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {trip ? (
          <>
            <View style={styles.departBlock}>
              <AppText style={[styles.departTime, { color: colors.foreground }]}>
                {formatDepartureTime(trip.departAt)}
              </AppText>
              <AppText style={[styles.departDate, { color: colors.mutedForeground }]}>
                {formatDepartureDate(trip.departAt)}
              </AppText>
            </View>
            <Row icon="users" label="Operator" value={trip.operatorName?.trim() || 'Rides operator'} />
            {trip.vehicleLabel || trip.plateNumber ? (
              <Row
                icon="truck"
                label="Vehicle"
                value={[trip.vehicleLabel, trip.plateNumber].filter(Boolean).join(' · ')}
              />
            ) : null}
            <Row icon="map-pin" label="Boarding point" value={trip.stagingAddress} />
            {trip.driverPhone ? <Row icon="phone" label="Driver" value={trip.driverPhone} /> : null}
          </>
        ) : (
          <AppText style={[styles.departDate, { color: colors.mutedForeground }]}>
            Trip details are not available right now.
          </AppText>
        )}

        <Row
          icon="hash"
          label="Seats"
          value={`${booking.seats} ${booking.seats === 1 ? 'seat' : 'seats'}`}
        />
        <Row
          icon="tag"
          label="Total"
          value={`${formatRwf(bookingTotalRwf(booking))} · cash on board`}
        />
      </View>

      {cancelError ? (
        <View
          accessible
          accessibilityRole="alert"
          accessibilityLabel={cancelError}
          style={[styles.notice, { borderColor: `${colors.destructiveHex}40`, backgroundColor: `${colors.destructiveHex}10` }]}
        >
          <Feather name="alert-circle" size={icons.size.sm} color={colors.destructive} />
          <AppText style={[styles.noticeText, { color: colors.destructive }]}>{cancelError}</AppText>
        </View>
      ) : null}

      {cancellable ? (
        <View style={styles.actions}>
          <AppButton
            title="Cancel booking"
            onPress={() => setConfirmVisible(true)}
            variant="dangerPlain"
            fullWidth
            accessibilityLabel="Cancel this intercity booking"
          />
        </View>
      ) : (
        <View style={styles.actions}>
          <AppButton
            title="Find another trip"
            onPress={() => router.replace('/intercity')}
            variant="secondary"
            fullWidth
          />
        </View>
      )}

      <ConfirmDialog visible={confirmVisible} onClose={() => setConfirmVisible(false)}>
        <AppText style={[styles.dialogTitle, { color: colors.foreground }]}>Cancel this booking?</AppText>
        <AppText style={[styles.dialogBody, { color: colors.mutedForeground }]}>
          Your {booking.seats === 1 ? 'seat goes' : 'seats go'} back on sale immediately and cannot be
          reserved again automatically.
        </AppText>
        <View style={styles.dialogActions}>
          <AppButton
            title="Keep booking"
            onPress={() => setConfirmVisible(false)}
            variant="secondary"
            fullWidth
          />
          <AppButton
            title="Cancel booking"
            onPress={handleCancel}
            variant="danger"
            loading={cancelMutation.isPending}
            disabled={cancelMutation.isPending}
            fullWidth
          />
        </View>
      </ConfirmDialog>
    </Shell>
  );
}

function StatusBanner({ booking, holdLabel }: { booking: IntercityBooking; holdLabel: string | null }) {
  const colors = useColors();
  const { detail, icon, tint } = describeStatus(booking, holdLabel, colors);

  return (
    <View
      accessible
      accessibilityRole="header"
      accessibilityLabel={`${bookingStatusLabel(booking.status)}. ${detail}`}
      style={[styles.statusBanner, { backgroundColor: `${tint}14`, borderColor: `${tint}40` }]}
    >
      <Feather name={icon} size={icons.size.lg} color={tint} />
      <View style={styles.statusCopy}>
        <AppText style={[styles.statusTitle, { color: tint }]}>
          {bookingStatusLabel(booking.status)}
          {holdLabel ? ` · ${holdLabel}` : ''}
        </AppText>
        <AppText style={[styles.statusDetail, { color: colors.mutedForeground }]}>{detail}</AppText>
      </View>
    </View>
  );
}

function describeStatus(
  booking: IntercityBooking,
  holdLabel: string | null,
  colors: ReturnType<typeof useColors>,
): { detail: string; icon: React.ComponentProps<typeof Feather>['name']; tint: string } {
  switch (booking.status) {
    case 'HELD':
      return holdLabel
        ? {
            detail: 'Confirm before the timer runs out or the seats go back on sale.',
            icon: 'clock',
            tint: colors.warningHex,
          }
        : {
            detail: 'The hold ran out and the seats were released.',
            icon: 'clock',
            tint: colors.mutedForeground,
          };
    case 'CONFIRMED':
      return {
        detail: 'Be at the boarding point before departure and pay the driver in cash.',
        icon: 'check-circle',
        tint: colors.successHex,
      };
    case 'BOARDED':
      return { detail: 'You are on board. Safe travels.', icon: 'check-circle', tint: colors.successHex };
    case 'COMPLETED':
      return { detail: 'This trip is finished.', icon: 'flag', tint: colors.mutedForeground };
    case 'EXPIRED':
      return {
        detail: 'The five-minute hold ran out and the seats went back on sale.',
        icon: 'clock',
        tint: colors.mutedForeground,
      };
    case 'CANCELLED':
      return {
        detail: booking.trip?.cancelReason
          ? `Cancelled: ${booking.trip.cancelReason}`
          : 'This booking was cancelled and the seats were released.',
        icon: 'x-circle',
        tint: colors.destructiveHex,
      };
    case 'NO_SHOW':
      return {
        detail: 'The driver recorded that you did not board. Contact support if this is wrong.',
        icon: 'alert-triangle',
        tint: colors.destructiveHex,
      };
    default:
      return { detail: '', icon: 'info', tint: colors.mutedForeground };
  }
}

function Row({
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
    <View accessible accessibilityLabel={`${label}: ${value}`} style={styles.row}>
      <Feather name={icon} size={icons.size.sm} color={colors.mutedForeground} />
      <AppText style={[styles.rowLabel, { color: colors.mutedForeground }]}>{label}</AppText>
      <AppText numberOfLines={2} style={[styles.rowValue, { color: colors.foreground }]}>
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
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[10],
    marginHorizontal: semanticSpacing.cardPadding,
    marginBottom: semanticSpacing.rowGap,
    padding: semanticSpacing.cardPadding,
    borderRadius: radius.sheetCompact,
    borderWidth: 1,
  },
  statusCopy: { flex: 1, gap: spacing[2] },
  statusTitle: { ...typography.label },
  statusDetail: { ...typography.tiny, lineHeight: 16 },
  card: {
    marginHorizontal: semanticSpacing.cardPadding,
    marginBottom: semanticSpacing.rowGap,
    padding: semanticSpacing.cardPadding,
    borderRadius: radius.sheetCompact,
    borderWidth: 1,
    gap: spacing[10],
  },
  departBlock: { gap: spacing[2] },
  departTime: { ...typography.display, lineHeight: 34 },
  departDate: { ...typography.caption },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[8] },
  rowLabel: { ...typography.tiny, width: 92 },
  rowValue: { ...typography.caption, flex: 1, lineHeight: 18 },
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
  actions: { marginHorizontal: semanticSpacing.cardPadding, gap: spacing[8] },
  dialogTitle: { ...typography.title, textAlign: 'center' },
  dialogBody: { ...typography.caption, lineHeight: 18, textAlign: 'center', marginTop: spacing[8] },
  dialogActions: { marginTop: semanticSpacing.cardPadding, gap: spacing[8] },
});
