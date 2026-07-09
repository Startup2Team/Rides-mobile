import React, { useState, useMemo, useCallback } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { GlassHeader } from '@/components/GlassHeader';
import { ProgressRing } from '@/components/driver-statistics/ProgressRing';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { useDriverEntitlement } from '@/context/DriverEntitlementContext';
import { useRideHistoryQuery } from '@/query/hooks/useRideHistoryQuery';
import { loadStoredDriverRatings } from '@/persistence/driverRatingPersistence';
import { getDriverRatingSummary, type DriverRatingSummary } from '@/domain/driverWallet';
import { createDriverStatisticsViewModel } from '@/domains/driver-statistics';
import { formatRwf } from '@/domain/driverActivitySummary';
import { spacing } from '@/constants/spacing';
import { typography } from '@/constants/typography';
import { radius } from '@/constants/radius';

type MetricType = 'earnings' | 'completedTrips' | 'earningsPerTrip' | 'rating' | 'acceptance' | 'trends' | 'performance';

interface MetricConfig {
  title: string;
  color: string;
  target: number;
  unit: string;
  targetLabel: string;
}

const METRIC_CONFIGS: Record<MetricType, MetricConfig> = {
  earnings: { title: 'Earnings', color: '#FF2D55', target: 30000, unit: 'RWF', targetLabel: 'Daily Target: 30K RWF' },
  completedTrips: { title: 'Trips', color: '#A38DF8', target: 8, unit: 'trips', targetLabel: 'Daily Target: 8 Trips' },
  earningsPerTrip: { title: 'Earnings Per Trip', color: '#2AC1E4', target: 5000, unit: 'RWF', targetLabel: 'Daily Target: 5K / Trip' },
  rating: { title: 'Driver Rating', color: '#FFCC00', target: 5.0, unit: '★', targetLabel: 'Rating Goal: 5.0' },
  acceptance: { title: 'Acceptance', color: '#8CE62A', target: 90, unit: '%', targetLabel: 'Acceptance Target: 90%' },
  trends: { title: 'Trends', color: '#FF2D55', target: 1, unit: 'insight', targetLabel: 'Explore insights' },
  performance: { title: 'Performance', color: '#2AC1E4', target: 1, unit: 'score', targetLabel: 'Performance Stats' },
};

export default function DriverStatsDetail() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ metric: string; period: string }>();
  const activeMetric: MetricType = (params.metric as MetricType) || 'earnings';
  const config = useMemo(() => {
    const baseConfig = METRIC_CONFIGS[activeMetric];
    if (activeMetric === 'earnings') {
      return {
        ...baseConfig,
        color: colors.primaryHex,
      };
    }
    return baseConfig;
  }, [activeMetric, colors.primary]);

  const { user, driverProfile } = useAuth();
  const { entitlement } = useDriverEntitlement();
  const { data: rideHistory = [], refetch: refetchRideHistory } = useRideHistoryQuery(user?.id);

  const [ratingSummary, setRatingSummary] = useState<DriverRatingSummary>({ averageRating: null, ratingCount: 0 });
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [calendarVisible, setCalendarVisible] = useState(false);

  // Load rating summary
  React.useEffect(() => {
    async function loadRatings() {
      const stored = await loadStoredDriverRatings();
      const summary = user?.id ? getDriverRatingSummary(stored.data ?? [], user.id) : { averageRating: null, ratingCount: 0 };
      setRatingSummary(summary);
    }
    void loadRatings();
  }, [user?.id]);

  // Build last 7 days for the weekday ring selector
  const weekDays = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d);
    }
    return days;
  }, []);

  // Compute daily metrics specifically for a given date
  const getDailyStatsForDate = useCallback((date: Date) => {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const dayRides = rideHistory.filter(ride => {
      const rideDate = new Date(ride.createdAt);
      return rideDate >= startOfDay && rideDate <= endOfDay;
    });

    const tripsCount = dayRides.filter(r => r.status === 'completed').length;
    const earnings = dayRides.reduce((sum, r) => sum + (r.agreedFare ?? 0), 0);
    const earningsPerTrip = tripsCount > 0 ? earnings / tripsCount : 0;

    return { tripsCount, earnings, earningsPerTrip };
  }, [rideHistory]);

  const activeStats = useMemo(() => getDailyStatsForDate(selectedDate), [selectedDate, getDailyStatsForDate]);

  // Extract values based on active metric
  const currentValue = useMemo(() => {
    switch (activeMetric) {
      case 'earnings':
        return activeStats.earnings;
      case 'completedTrips':
        return activeStats.tripsCount;
      case 'earningsPerTrip':
        return activeStats.earningsPerTrip;
      case 'rating':
        return ratingSummary.averageRating ?? 0;
      case 'acceptance':
        return driverProfile?.acceptanceRate ?? 0;
      default:
        return 0;
    }
  }, [activeMetric, activeStats, ratingSummary, driverProfile]);

  const progressRatio = useMemo(() => {
    if (config.target <= 0) return 0;
    return currentValue / config.target;
  }, [currentValue, config.target]);
  const mainRingStrokeWidth = activeMetric === 'earnings' ? 50 : 36;

  // Build calendar month days (July 2026 or Current Month)
  const calendarDays = useMemo(() => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay(); // Sunday is 0
    const startOffset = firstDayIndex === 0 ? 6 : firstDayIndex - 1; // Align to Monday as 0
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days = [];
    // Pad initial slots
    for (let i = 0; i < startOffset; i++) {
      days.push(null);
    }
    // Populate month days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  }, [selectedDate]);

  const handleShare = () => {
    // Shared mock action
    alert("Sharing statistics report!");
  };

  // Mock hourly data for the chart based on selected date and active stats
  const hourlyData = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => ({ hour: i, value: 0 }));
    // Spread the active stats across midday peak hours for visualization
    if (currentValue > 0) {
      hours[8].value = currentValue * 0.15;
      hours[9].value = currentValue * 0.25;
      hours[12].value = currentValue * 0.1;
      hours[13].value = currentValue * 0.2;
      hours[17].value = currentValue * 0.18;
      hours[18].value = currentValue * 0.12;
    }
    return hours;
  }, [currentValue]);

  const maxHourlyValue = useMemo(() => {
    const max = Math.max(...hourlyData.map(h => h.value));
    return max > 0 ? max : 1;
  }, [hourlyData]);

  const formattedDateTitle = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    weekday: 'long',
  }).format(selectedDate);

  const displayValueStr = useMemo(() => {
    if (activeMetric === 'earnings' || activeMetric === 'earningsPerTrip') {
      return formatRwf(currentValue);
    }
    if (activeMetric === 'rating') {
      return currentValue > 0 ? currentValue.toFixed(1) : 'No Rating';
    }
    if (activeMetric === 'acceptance') {
      return `${currentValue}%`;
    }
    return String(currentValue);
  }, [currentValue, activeMetric]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Detail Screen Header */}
      <GlassHeader
        title={config.title}
        showBack={true}
        onBackPress={() => router.back()}
        right={
          activeMetric === 'earnings' ? (
            <Pressable onPress={() => setCalendarVisible(true)} style={styles.headerBtn}>
              <Feather name="calendar" size={20} color={colors.foreground} />
            </Pressable>
          ) : undefined
        }
      />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContainer,
          {
            paddingTop: Platform.OS === 'ios' ? 100 : 120,
            paddingBottom: insets.bottom + spacing[20],
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Horizontal Weekly Day Selector */}
        <View style={styles.weekdayRow}>
          {weekDays.map((date, idx) => {
            const isSelected = date.getDate() === selectedDate.getDate() && date.getMonth() === selectedDate.getMonth();
            const dayName = date.toLocaleDateString('en-US', { weekday: 'narrow' });
            const dayStats = getDailyStatsForDate(date);
            
            // Calculate progress ring percentage for this day
            let dayProgress = 0;
            if (activeMetric === 'earnings' && dayStats.earnings > 0) {
              dayProgress = dayStats.earnings / config.target;
            } else if (activeMetric === 'completedTrips' && dayStats.tripsCount > 0) {
              dayProgress = dayStats.tripsCount / config.target;
            }

            return (
              <Pressable
                key={idx}
                onPress={() => setSelectedDate(date)}
                style={styles.weekdayItem}
              >
                <AppText style={[styles.weekdayLabel, { color: colors.mutedForeground }]}>
                  {dayName}
                </AppText>
                <ProgressRing
                  size={32}
                  strokeWidth={3}
                  progress={dayProgress}
                  color={config.color}
                >
                  <View style={[
                    styles.dayTextBubble,
                    isSelected && { backgroundColor: config.color }
                  ]}>
                    <AppText style={[
                      styles.dayText, 
                      { color: isSelected ? '#FFFFFF' : colors.foreground }
                    ]}>
                      {date.getDate()}
                    </AppText>
                  </View>
                </ProgressRing>
              </Pressable>
            );
          })}
        </View>

        {/* Selected Date Header */}
        <View style={styles.dateBlock}>
          <AppText style={[styles.dateTitle, { color: colors.foreground }]}>
            {formattedDateTitle}
          </AppText>
        </View>

        {/* Center: Large Progress Ring */}
        <View style={styles.ringContainer}>
          <ProgressRing
            size={250}
            strokeWidth={mainRingStrokeWidth}
            progress={progressRatio}
            color={config.color}
            showArrow={activeMetric === 'earnings'}
          >
            {activeMetric !== 'earnings' && (
              <View style={styles.ringCenterText}>
                <AppText style={[styles.ringMetricTitle, { color: colors.mutedForeground }]}>
                  {config.title}
                </AppText>
                <AppText style={[styles.ringValue, { color: config.color }]}>
                  {displayValueStr}
                </AppText>
                <AppText style={[styles.ringSub, { color: colors.mutedForeground }]}>
                  {activeMetric === 'completedTrips'
                    ? `Goal: ${config.target}`
                    : config.targetLabel}
                </AppText>
              </View>
            )}
          </ProgressRing>
        </View>

        {/* Metric Chart */}
        <View style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.chartHeader}>
            <AppText style={[styles.chartTitle, { color: colors.foreground }]}>Activity breakdown</AppText>
            <AppText style={[styles.chartSubtitle, { color: colors.mutedForeground }]}>Hourly view</AppText>
          </View>

          {/* Svg / Custom View Bar Chart */}
          <View style={styles.chartArea}>
            {/* Dashed Target Line */}
            <View style={[
              styles.chartTargetLine, 
              { borderBottomColor: config.color + '44', top: '40%' }
            ]} />
            
            <View style={styles.barsContainer}>
              {hourlyData.map((h, i) => {
                const heightRatio = h.value / maxHourlyValue;
                const barHeight = heightRatio > 0 ? Math.max(4, Math.round(heightRatio * 110)) : 0;
                
                // Show X labels at specific hours
                const showLabel = h.hour % 6 === 0;

                return (
                  <View key={i} style={styles.chartBarSlot}>
                    <View style={[styles.chartBarTrack, { backgroundColor: colors.border }]}>
                      {barHeight > 0 && (
                        <View style={[
                          styles.chartBarFill, 
                          { backgroundColor: config.color, height: barHeight }
                        ]} />
                      )}
                    </View>
                    {showLabel ? (
                      <AppText style={[styles.chartAxisLabel, { color: colors.mutedForeground }]}>
                        {String(h.hour).padStart(2, '0')}
                      </AppText>
                    ) : (
                      <View style={styles.chartAxisSpacer} />
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        </View>

        {/* Sub-Metrics Details */}
        <View style={[styles.subCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <AppText style={[styles.subCardTitle, { color: colors.foreground }]}>Daily Metrics Summary</AppText>
          
          <View style={styles.subGrid}>
            <View style={[styles.subGridItem, { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
              <AppText style={[styles.subLabel, { color: colors.mutedForeground }]}>Completed Rides</AppText>
              <AppText style={[styles.subValue, { color: colors.foreground }]}>{activeStats.tripsCount}</AppText>
            </View>
            <View style={[styles.subGridItem, { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
              <AppText style={[styles.subLabel, { color: colors.mutedForeground }]}>Total Earnings</AppText>
              <AppText style={[styles.subValue, { color: colors.foreground }]}>{formatRwf(activeStats.earnings)}</AppText>
            </View>
            <View style={styles.subGridItem}>
              <AppText style={[styles.subLabel, { color: colors.mutedForeground }]}>Earnings per Trip</AppText>
              <AppText style={[styles.subValue, { color: colors.foreground }]}>{formatRwf(activeStats.earningsPerTrip)}</AppText>
            </View>
            <View style={styles.subGridItem}>
              <AppText style={[styles.subLabel, { color: colors.mutedForeground }]}>Rating Index</AppText>
              <AppText style={[styles.subValue, { color: colors.foreground }]}>
                {ratingSummary.averageRating?.toFixed(1) ?? '--'} ★
              </AppText>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Calendar Overlay Modal */}
      <Modal
        visible={calendarVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setCalendarVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.calendarModal, { backgroundColor: '#121214', borderColor: colors.border }]}>
            {/* Header */}
            <View style={styles.calendarHeader}>
              <AppText style={[styles.calendarMonthTitle, { color: colors.foreground }]}>
                {selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </AppText>
              <Pressable
                onPress={() => setCalendarVisible(false)}
                style={styles.calendarCloseBtn}
              >
                <Feather name="x" size={18} color="#FFFFFF" />
              </Pressable>
            </View>

            {/* Weekdays Row */}
            <View style={styles.calendarWeekHeader}>
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, idx) => (
                <AppText key={idx} style={[styles.calendarWeekText, { color: colors.mutedForeground }]}>
                  {day}
                </AppText>
              ))}
            </View>

            {/* Month Grid */}
            <View style={styles.calendarGrid}>
              {calendarDays.map((date, idx) => {
                if (!date) {
                  return <View key={idx} style={styles.calendarGridSlot} />;
                }

                const isCurrentSelected = date.getDate() === selectedDate.getDate() && date.getMonth() === selectedDate.getMonth();
                const dayStats = getDailyStatsForDate(date);
                
                let dayProgress = 0;
                if (activeMetric === 'earnings' && dayStats.earnings > 0) {
                  dayProgress = dayStats.earnings / config.target;
                } else if (activeMetric === 'completedTrips' && dayStats.tripsCount > 0) {
                  dayProgress = dayStats.tripsCount / config.target;
                }

                return (
                  <Pressable
                    key={idx}
                    onPress={() => {
                      setSelectedDate(date);
                      setCalendarVisible(false);
                    }}
                    style={styles.calendarGridSlot}
                  >
                    <ProgressRing
                      size={32}
                      strokeWidth={3}
                      progress={dayProgress}
                      color={config.color}
                      trackColor="rgba(255, 255, 255, 0.05)"
                    >
                      <View style={[
                        styles.calendarDayBubble,
                        isCurrentSelected && { backgroundColor: config.color }
                      ]}>
                        <AppText style={[
                          styles.calendarDayText, 
                          { color: isCurrentSelected ? '#FFFFFF' : colors.foreground }
                        ]}>
                          {date.getDate()}
                        </AppText>
                      </View>
                    </ProgressRing>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    paddingHorizontal: 16,
    gap: 20,
  },
  headerRightActions: {
    flexDirection: 'row',
    gap: 16,
  },
  headerBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  weekdayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  weekdayItem: {
    alignItems: 'center',
    gap: 6,
  },
  weekdayLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  dayTextBubble: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayText: {
    fontSize: 12,
    fontWeight: '700',
  },
  dateBlock: {
    marginTop: 4,
  },
  dateTitle: {
    ...typography.h2,
    fontSize: 20,
    fontWeight: '700',
  },
  ringContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  ringCenterText: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  ringMetricTitle: {
    fontSize: 14,
    textTransform: 'uppercase',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  ringValue: {
    fontSize: 36,
    lineHeight: 42,
    fontWeight: '800',
  },
  ringSub: {
    fontSize: 13,
  },
  chartCard: {
    borderRadius: radius['3xl'],
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 16,
  },
  chartHeader: {
    gap: 2,
  },
  chartTitle: {
    ...typography.title,
    fontSize: 16,
  },
  chartSubtitle: {
    ...typography.tiny,
  },
  chartArea: {
    height: 140,
    position: 'relative',
    justifyContent: 'flex-end',
  },
  chartTargetLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderBottomWidth: 1,
    borderStyle: 'dashed',
    zIndex: 1,
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 120,
    justifyContent: 'space-between',
  },
  chartBarSlot: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
  },
  chartBarTrack: {
    width: 4,
    height: 110,
    borderRadius: 2,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  chartBarFill: {
    width: '100%',
    borderRadius: 2,
  },
  chartAxisLabel: {
    fontSize: 8,
    marginTop: 6,
    height: 10,
    fontWeight: '600',
  },
  chartAxisSpacer: {
    height: 10,
    marginTop: 6,
  },
  subCard: {
    borderRadius: radius['3xl'],
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 16,
  },
  subCardTitle: {
    ...typography.title,
    fontSize: 16,
  },
  subGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  subGridItem: {
    width: '50%',
    paddingVertical: 12,
    gap: 4,
  },
  subLabel: {
    fontSize: 12,
  },
  subValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  calendarModal: {
    width: '100%',
    borderRadius: radius['3xl'],
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 16,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  calendarMonthTitle: {
    ...typography.h2,
    fontSize: 18,
    fontWeight: '700',
  },
  calendarCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarWeekHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  calendarWeekText: {
    width: 36,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 12,
  },
  calendarGridSlot: {
    width: '14.28%',
    alignItems: 'center',
    justifyContent: 'center',
    height: 36,
  },
  calendarDayBubble: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarDayText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
