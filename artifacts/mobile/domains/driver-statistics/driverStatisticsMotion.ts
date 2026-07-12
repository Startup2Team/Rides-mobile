import { Easing } from 'react-native';

const fallbackEasing = {
  cubic: (value: number) => value,
  inOut: (fn: (value: number) => number) => fn,
  out: (fn: (value: number) => number) => fn,
};

const easingSource = {
  cubic: Easing?.cubic ?? fallbackEasing.cubic,
  inOut: Easing?.inOut ?? fallbackEasing.inOut,
  out: Easing?.out ?? fallbackEasing.out,
};

/** Driver-statistics interaction timing — keep scoped to this feature. */
export const DRIVER_STATISTICS_MOTION = {
  summaryCardPressInMs: 95,
  summaryCardPressOutMs: 120,
  summaryCardPressedScale: 0.985,
  summaryCardPressedOpacity: 0.92,

  dateCellPressedScale: 0.96,
  dateSelectionMs: 150,

  weekSwipeSuccessMs: 210,
  weekSwipeFailMs: 180,
  weekSwipePageThresholdRatio: 0.35,
  weekSwipeVelocityThreshold: 0.55,
  weekSwipeFutureResistance: 0.22,

  calendarOpenMs: 220,
  calendarCloseMs: 180,
  calendarBackdropOpacity: 0.55,
  calendarPanelScaleFrom: 0.96,
  calendarPanelTranslateY: 10,

  detailRingEntryDelayMs: 60,
  detailSupportingRevealDelayMs: 120,
  detailSupportingRevealMs: 180,
  detailSupportingTranslateY: 8,

  ringEntryMs: 750,
  ringUpdateMs: 450,
  progressChangeEpsilon: 0.0005,

  arrowContactMs: 160,
  arrowFormMs: 170,
  arrowForwardBounceMs: 55,
  arrowReboundMs: 45,
  arrowSettleMs: 70,
  arrowBounceTranslateX: 1.0,

  goalButtonPressMs: 100,
  goalSaveSuccessMs: 120,
} as const;

export const driverStatisticsEasing = {
  easeOutCubic: easingSource.out(easingSource.cubic),
  easeInOutCubic: easingSource.inOut(easingSource.cubic),
} as const;

export type DriverStatisticsMotion = typeof DRIVER_STATISTICS_MOTION;
