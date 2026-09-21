import React, { useCallback, useMemo } from 'react';
import { FlatList, Platform, StyleSheet, View, useColorScheme } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { GlassHeader, useGlassHeaderMetrics } from '@/components/GlassHeader';
import { IntercityStateCard } from '@/components/intercity/IntercityStateCard';
import { TripRow } from '@/components/intercity/TripRow';
import { semanticSpacing, spacing } from '@/constants/spacing';
import { FORM_BOTTOM_PADDING } from '@/constants/tabBar';
import { typography } from '@/constants/typography';
import {
  formatDepartureDate,
  intercityErrorMessage,
  useIntercityTripSearchQuery,
  type IntercityTrip,
} from '@/domains/intercity';
import { useColors } from '@/hooks/useColors';
import { useIsOffline } from '@/hooks/useIsOffline';

/**
 * Trips on a corridor for a day.
 *
 * Remaining seats is the headline of every row and must be right: the query
 * carries a 15s staleTime and refetches whenever this screen regains focus —
 * coming back from a booking that someone else won, for instance. Browsing
 * customers are deliberately NOT streamed (INTERCITY_DESIGN §8); the hold call
 * is the authority and answers 409 when the seats are gone.
 */
export default function IntercityResultsScreen() {
  const params = useLocalSearchParams<{ corridor?: string; date?: string; seats?: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const headerMetrics = useGlassHeaderMetrics();
  const isDark = useColorScheme() === 'dark';
  const isOffline = useIsOffline();

  const corridor = typeof params.corridor === 'string' ? params.corridor : '';
  const date = typeof params.date === 'string' ? params.date : '';
  const seats = Math.max(1, Number.parseInt(String(params.seats ?? '1'), 10) || 1);

  const tripsQuery = useIntercityTripSearchQuery({ corridor, date, seats });
  const { refetch } = tripsQuery;
  const trips = useMemo(() => tripsQuery.data ?? [], [tripsQuery.data]);

  // Returning to this list (e.g. after a 409, or after cancelling a hold) must
  // re-read the seat counts — navigation focus is not app focus.
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  const handleSelect = useCallback(
    (trip: IntercityTrip) => {
      router.push({
        pathname: '/intercity-book',
        params: { tripId: trip.id, seats: String(seats) },
      });
    },
    [seats],
  );

  const subtitle = date ? formatDepartureDate(`${date}T00:00:00Z`) : undefined;

  const emptyState = tripsQuery.isLoading ? (
    <IntercityStateCard icon="loader" title="Finding trips" detail="Checking who is going today." />
  ) : tripsQuery.isError ? (
    isOffline ? (
      <IntercityStateCard
        icon="wifi-off"
        title="You are offline"
        detail="Seat numbers change constantly, so we will not show you stale ones. Reconnect to see live seats."
        tone="warning"
        actionLabel="Try again"
        onAction={() => void refetch()}
      />
    ) : (
      <IntercityStateCard
        icon="alert-triangle"
        title="Could not load trips"
        detail={intercityErrorMessage(tripsQuery.error)}
        tone="error"
        actionLabel="Try again"
        onAction={() => void refetch()}
      />
    )
  ) : (
    <IntercityStateCard
      icon="calendar"
      title="No trips on this day"
      detail="Nobody has published a departure for this route and day yet. Try another day."
      actionLabel="Change day"
      onAction={() => router.back()}
    />
  );

  return (
    <View style={[styles.root, { backgroundColor: isDark ? '#000' : '#F2F2F7' }]}>
      <GlassHeader title="Trips" subtitle={subtitle} onBackPress={() => router.back()} />

      <FlatList
        data={trips}
        keyExtractor={trip => trip.id}
        renderItem={({ item }) => <TripRow trip={item} onPress={handleSelect} />}
        contentContainerStyle={{
          paddingTop: headerMetrics.contentTop,
          paddingBottom: insets.bottom + FORM_BOTTOM_PADDING,
        }}
        contentInsetAdjustmentBehavior={Platform.OS === 'ios' ? 'never' : undefined}
        showsVerticalScrollIndicator={false}
        refreshing={tripsQuery.isFetching && trips.length > 0}
        onRefresh={() => void refetch()}
        ListHeaderComponent={
          trips.length > 0 ? (
            <AppText style={[styles.listHint, { color: colors.mutedForeground }]}>
              Seats update every time you open this list. Pay the driver in cash on board.
            </AppText>
          ) : null
        }
        ListEmptyComponent={<View style={styles.emptyWrap}>{emptyState}</View>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  listHint: {
    ...typography.tiny,
    lineHeight: 16,
    marginHorizontal: semanticSpacing.cardPadding,
    marginBottom: spacing[12],
  },
  emptyWrap: { paddingTop: spacing[8] },
});
