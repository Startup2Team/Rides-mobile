import React, { useEffect, useMemo, useRef, useState } from 'react';
import { InteractionManager, View, StyleSheet, Animated, Easing } from 'react-native';
import Svg, { Circle, Defs, FeGaussianBlur, Filter, G, Path } from 'react-native-svg';
import {
  DRIVER_STATISTICS_MOTION,
  driverStatisticsEasing,
} from '@/domains/driver-statistics/driverStatisticsMotion';

const AnimatedCircle = Animated.createAnimatedComponent
  ? Animated.createAnimatedComponent(Circle)
  : Circle;

const AnimatedPath = Animated.createAnimatedComponent
  ? Animated.createAnimatedComponent(Path)
  : Path;

const AnimatedView = Animated.createAnimatedComponent
  ? Animated.createAnimatedComponent(View)
  : View;

export type ProgressRingGoalState = 'configured' | 'unconfigured';

interface ProgressRingProps {
  size: number;
  strokeWidth: number;
  progress: number; // 0 to 1, or > 1 for overflow
  color: string;
  trackColor?: string;
  trackOpacity?: number;
  children?: React.ReactNode;
  showArrow?: boolean;
  allowSmallOverflowShadow?: boolean;
  showStartCapAtZero?: boolean;
  /**
   * Semantic goal state. Unconfigured forces an inactive track-only ring and
   * ignores progress (distinct from configured zero-earnings progress).
   * Defaults to "configured" for backward compatibility.
   */
  goalState?: ProgressRingGoalState;
  animationMode?: ProgressRingAnimationMode;
  animateArrow?: boolean;
  progressChangeThreshold?: number;
  detailLevel?: ProgressRingDetailLevel;
  reducedMotion?: boolean;
  /** Delay before the first entry draw. Defaults to 0 (backward compatible). */
  entryDelayMs?: number;
  testID?: string;
}

export type ProgressRingAnimationMode = 'entry-and-updates' | 'updates-only' | 'entry-only' | 'none';
export type ProgressRingDetailLevel = 'full' | 'compact';

const LAP_RESET_EPSILON = 0.0001;
const DEFAULT_TRACK_COLOR = '#111827';
const SHADOW_ARC_DEGREES = 14;
const CAP_BRIDGE_ARC_DEGREES = 6;
const CAP_POSITION_STEPS_PER_LAP = 72;
const SHADOW_PATH_STEPS = 8;
export const PROGRESS_CHANGE_EPSILON = DRIVER_STATISTICS_MOTION.progressChangeEpsilon;
const RING_ENTRY_DURATION_MS = DRIVER_STATISTICS_MOTION.ringEntryMs;
const RING_UPDATE_DURATION_MS = DRIVER_STATISTICS_MOTION.ringUpdateMs;
const ARROW_CONTACT_DURATION_MS = DRIVER_STATISTICS_MOTION.arrowContactMs;
const ARROW_FORM_DURATION_MS = DRIVER_STATISTICS_MOTION.arrowFormMs;
const ARROW_FORWARD_BOUNCE_DURATION_MS = DRIVER_STATISTICS_MOTION.arrowForwardBounceMs;
const ARROW_REBOUND_DURATION_MS = DRIVER_STATISTICS_MOTION.arrowReboundMs;
const ARROW_SETTLE_DURATION_MS = DRIVER_STATISTICS_MOTION.arrowSettleMs;
const SHADOW_SEGMENTS = [
  { start: 0, end: 2.8, opacity: 0.34 },
  { start: 1.6, end: 5.4, opacity: 0.22 },
  { start: 3.8, end: 8.5, opacity: 0.11 },
  { start: 6.8, end: 11.7, opacity: 0.052 },
  { start: 10.2, end: SHADOW_ARC_DEGREES, opacity: 0.022 },
];
const MIN_SHADOW_SIZE = 64;
const MIN_SHADOW_STROKE_WIDTH = 8;
const DEBUG_PROGRESS_RING_GEOMETRY = false;
const ARROW_MORPH_INPUT_RANGE = [0, 0.08, 0.21, 0.35, 0.63, 0.8, 0.92, 1];
const ARROW_KEYFRAMES = {
  shaft: [
    'M -13 0 L -13 0',
    'M -13 0 L -11 0',
    'M -13 0 L -6 0',
    'M -13 0 L 3.4 0',
    'M -13 0 L 8 0',
    'M -13 0 L 8 0',
    'M -13 0 L 8 0',
    'M -13 0 L 8 0',
  ],
  head: [
    'M 0 -11.25 L 0.8 0 L 0 11.25',
    'M 0 -11.25 L 1.0 0 L 0 11.25',
    'M 0 -11.25 L 1.8 0 L 0 11.25',
    'M 0 -11.25 L 3.4 0 L 0 11.25',
    'M 0 -11.25 L 9.5 0 L 0 11.25',
    'M 0 -11.25 L 10.0 0 L 0 11.25',
    'M 0 -11.25 L 9.35 0 L 0 11.25',
    'M 0 -11.25 L 9.5 0 L 0 11.25',
  ],
};
const ARROW_BOUNCE_TRANSLATE_X = [0, 0, 0, 0, 0, DRIVER_STATISTICS_MOTION.arrowBounceTranslateX, -0.35, 0];
const ARROW_BASE_BADGE_DIAMETER = 44;
const ARROW_STROKE_TO_BADGE_RATIO = 0.045;

function pointOnCircle(cx: number, cy: number, r: number, angleDegrees: number) {
  const angleRadians = angleDegrees * (Math.PI / 180);
  return {
    x: cx + r * Math.sin(angleRadians),
    y: cy - r * Math.cos(angleRadians),
  };
}

function describeArc(cx: number, cy: number, r: number, startDegrees: number, endDegrees: number) {
  const points = Array.from({ length: SHADOW_PATH_STEPS + 1 }, (_, index) => {
    const progress = index / SHADOW_PATH_STEPS;
    return pointOnCircle(cx, cy, r, startDegrees + (endDegrees - startDegrees) * progress);
  });
  const [first, ...rest] = points;

  return [
    `M ${first.x} ${first.y}`,
    ...rest.map(point => `L ${point.x} ${point.y}`),
  ].join(' ');
}

function getLapProgress(progress: number) {
  const lapProgress = progress % 1;
  return lapProgress === 0 && progress > 0 ? 1 : lapProgress;
}

function getRingGeometrySnapshot(progress: number, cx: number, cy: number, r: number) {
  const lapProgress = getLapProgress(progress);
  const leadingAngleDeg = lapProgress * 360;
  const cap = pointOnCircle(cx, cy, r, leadingAngleDeg);

  return {
    progress,
    lapProgress,
    leadingAngleDeg,
    capX: cap.x,
    capY: cap.y,
    shadowStart: leadingAngleDeg,
    shadowEnd: leadingAngleDeg + SHADOW_ARC_DEGREES,
  };
}

function buildLapPositionInterpolation(
  maxLaps: number,
  cx: number,
  cy: number,
  r: number,
  detailLevel: ProgressRingDetailLevel,
  includeOverflowShadow: boolean,
) {
  const includeFullDetail = detailLevel === 'full';
  const includeShadowPaths = includeFullDetail || includeOverflowShadow;
  const inputRange: number[] = [0, 1];
  const capXRange: number[] = [cx, cx];
  const capYRange: number[] = [cy - r, cy - r];
  const shadowPathRanges = (includeShadowPaths ? SHADOW_SEGMENTS : []).map(segment => ({
    segment,
    outputRange: [
      describeArc(cx, cy, r, segment.start, segment.end),
      describeArc(cx, cy, r, segment.start, segment.end),
    ],
  }));
  const capBridgePathRange = includeFullDetail
    ? [
        describeArc(cx, cy, r, -CAP_BRIDGE_ARC_DEGREES, 0),
        describeArc(cx, cy, r, -CAP_BRIDGE_ARC_DEGREES, 0),
      ]
    : [];

  for (let lap = 1; lap < maxLaps; lap++) {
    inputRange.push(lap + LAP_RESET_EPSILON);
    capXRange.push(cx);
    capYRange.push(cy - r);
    if (includeFullDetail) {
      capBridgePathRange.push(describeArc(cx, cy, r, -CAP_BRIDGE_ARC_DEGREES, 0));
    }
    shadowPathRanges.forEach(({ segment, outputRange }) => {
      outputRange.push(describeArc(cx, cy, r, segment.start, segment.end));
    });

    for (let step = 1; step <= CAP_POSITION_STEPS_PER_LAP; step++) {
      const lapProgress = step / CAP_POSITION_STEPS_PER_LAP;
      const progress = lap + lapProgress;
      const leadingAngleDeg = lapProgress * 360;
      const point = pointOnCircle(cx, cy, r, leadingAngleDeg);

      inputRange.push(progress);
      capXRange.push(point.x);
      capYRange.push(point.y);
      if (includeFullDetail) {
        capBridgePathRange.push(describeArc(cx, cy, r, leadingAngleDeg - CAP_BRIDGE_ARC_DEGREES, leadingAngleDeg));
      }
      shadowPathRanges.forEach(({ segment, outputRange }) => {
        outputRange.push(describeArc(cx, cy, r, leadingAngleDeg + segment.start, leadingAngleDeg + segment.end));
      });
    }
  }

  return { inputRange, capXRange, capYRange, capBridgePathRange, shadowPathRanges };
}

function modeAllowsEntry(mode: ProgressRingAnimationMode) {
  return mode === 'entry-and-updates' || mode === 'entry-only';
}

function modeAllowsUpdates(mode: ProgressRingAnimationMode) {
  return mode === 'entry-and-updates' || mode === 'updates-only';
}

export function shouldAnimateProgressRingArrow({
  animateArrow,
  animationMode,
  isInitialEntry,
  previousTarget,
  nextTarget,
  progressChangeThreshold,
  reducedMotion,
}: {
  animateArrow: boolean;
  animationMode: ProgressRingAnimationMode;
  isInitialEntry: boolean;
  previousTarget: number;
  nextTarget: number;
  progressChangeThreshold: number;
  reducedMotion: boolean;
}) {
  if (!animateArrow || reducedMotion) return false;
  if (isInitialEntry) return modeAllowsEntry(animationMode);
  return modeAllowsUpdates(animationMode)
    && Math.abs(nextTarget - previousTarget) > progressChangeThreshold;
}

function ProgressRingComponent({
  size,
  strokeWidth,
  progress,
  color,
  trackColor,
  trackOpacity = 0.72,
  children,
  showArrow = false,
  allowSmallOverflowShadow = false,
  showStartCapAtZero = false,
  goalState = 'configured',
  animationMode = 'entry-and-updates',
  animateArrow = showArrow,
  progressChangeThreshold = PROGRESS_CHANGE_EPSILON,
  detailLevel = 'full',
  reducedMotion = false,
  entryDelayMs = 0,
  testID = 'progress-ring',
}: ProgressRingProps) {
  const isUnconfiguredGoal = goalState === 'unconfigured';
  const clampedProgress = isUnconfiguredGoal
    ? 0
    : (Number.isFinite(progress) ? Math.max(0, progress) : 0);
  const center = size / 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const effectiveAnimationMode: ProgressRingAnimationMode = isUnconfiguredGoal
    ? 'none'
    : animationMode;
  const animatedProgressRef = useRef<Animated.Value | null>(null);
  if (!animatedProgressRef.current) {
    animatedProgressRef.current = new Animated.Value(
      modeAllowsEntry(effectiveAnimationMode) && !reducedMotion ? 0 : clampedProgress,
    );
  }
  const animatedArrowRef = useRef<Animated.Value | null>(null);
  if (!animatedArrowRef.current) {
    animatedArrowRef.current = new Animated.Value(
      showArrow && animateArrow && modeAllowsEntry(effectiveAnimationMode) && !reducedMotion
        ? 0
        : 1,
    );
  }
  const animatedProgress = animatedProgressRef.current;
  const animatedArrow = animatedArrowRef.current;
  const previousTargetProgressRef = useRef(clampedProgress);
  const hasProcessedInitialTargetRef = useRef(false);
  const geometryMaxLapsRef = useRef(2);
  const progressAnimationRef = useRef<Animated.CompositeAnimation | null>(null);
  const arrowAnimationRef = useRef<Animated.CompositeAnimation | null>(null);
  const arrowInteractionHandleRef = useRef<{ cancel?: () => void } | null>(null);
  const isMountedRef = useRef(false);
  const [renderedHasProgress, setRenderedHasProgress] = useState(clampedProgress > 0);
  const [renderedIsOverflow, setRenderedIsOverflow] = useState(clampedProgress > 1);
  geometryMaxLapsRef.current = Math.max(
    geometryMaxLapsRef.current,
    Math.ceil(Math.max(clampedProgress, previousTargetProgressRef.current)) + 2,
  );
  const maxLaps = geometryMaxLapsRef.current;
  const capPositionInterpolation = useMemo(
    () => buildLapPositionInterpolation(
      maxLaps,
      center,
      center,
      radius,
      detailLevel,
      allowSmallOverflowShadow,
    ),
    [allowSmallOverflowShadow, center, detailLevel, maxLaps, radius],
  );

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      progressAnimationRef.current?.stop();
      arrowAnimationRef.current?.stop();
      arrowInteractionHandleRef.current?.cancel?.();
    };
  }, []);

  useEffect(() => {
    const isInitialEntry = !hasProcessedInitialTargetRef.current;
    const previousTarget = previousTargetProgressRef.current;
    const meaningfullyChanged = Math.abs(clampedProgress - previousTarget) > progressChangeThreshold;

    if (isUnconfiguredGoal) {
      progressAnimationRef.current?.stop();
      arrowAnimationRef.current?.stop();
      arrowInteractionHandleRef.current?.cancel?.();
      previousTargetProgressRef.current = 0;
      hasProcessedInitialTargetRef.current = true;
      animatedProgress.setValue(0);
      setRenderedHasProgress(false);
      setRenderedIsOverflow(false);

      const shouldAnimateArrow = showArrow && shouldAnimateProgressRingArrow({
        animateArrow,
        animationMode: isInitialEntry ? 'entry-only' : 'none',
        isInitialEntry,
        previousTarget,
        nextTarget: 0,
        progressChangeThreshold,
        reducedMotion,
      });

      if (!shouldAnimateArrow) {
        animatedArrow.setValue(1);
        return;
      }

      let entryDelayHandle: ReturnType<typeof setTimeout> | null = null;
      const startArrowAnimation = () => {
        if (!isMountedRef.current) return;
        animatedArrow.setValue(0);
        const sequence = Animated.sequence([
          Animated.timing(animatedArrow, {
            toValue: 0.35,
            duration: ARROW_CONTACT_DURATION_MS,
            easing: Easing?.out?.(Easing.cubic) ?? driverStatisticsEasing.easeOutCubic,
            useNativeDriver: false,
          }),
          Animated.timing(animatedArrow, {
            toValue: 0.63,
            duration: ARROW_FORM_DURATION_MS,
            easing: Easing?.inOut?.(Easing.cubic) ?? driverStatisticsEasing.easeInOutCubic,
            useNativeDriver: false,
          }),
          Animated.timing(animatedArrow, {
            toValue: 0.8,
            duration: ARROW_FORWARD_BOUNCE_DURATION_MS,
            easing: Easing?.out?.(Easing.cubic) ?? driverStatisticsEasing.easeOutCubic,
            useNativeDriver: false,
          }),
          Animated.timing(animatedArrow, {
            toValue: 0.92,
            duration: ARROW_REBOUND_DURATION_MS,
            easing: Easing?.out?.(Easing.cubic) ?? driverStatisticsEasing.easeOutCubic,
            useNativeDriver: false,
          }),
          Animated.timing(animatedArrow, {
            toValue: 1,
            duration: ARROW_SETTLE_DURATION_MS,
            easing: Easing?.out?.(Easing.cubic) ?? driverStatisticsEasing.easeOutCubic,
            useNativeDriver: false,
          }),
        ]);
        arrowAnimationRef.current = sequence;
        sequence.start(({ finished }) => {
          if (finished) arrowAnimationRef.current = null;
        });
      };

      const run = () => {
        arrowInteractionHandleRef.current = InteractionManager?.runAfterInteractions?.(
          startArrowAnimation,
        ) ?? null;
        if (!arrowInteractionHandleRef.current) startArrowAnimation();
      };

      const delayMs = isInitialEntry ? Math.max(0, entryDelayMs) : 0;
      if (delayMs > 0) {
        entryDelayHandle = setTimeout(run, delayMs);
      } else {
        run();
      }

      return () => {
        if (entryDelayHandle) clearTimeout(entryDelayHandle);
        arrowInteractionHandleRef.current?.cancel?.();
      };
    }

    const shouldAnimateProgress = isInitialEntry
      ? modeAllowsEntry(effectiveAnimationMode)
      : meaningfullyChanged && modeAllowsUpdates(effectiveAnimationMode);
    const shouldAnimateArrow = showArrow && shouldAnimateProgressRingArrow({
      animateArrow,
      animationMode: effectiveAnimationMode,
      isInitialEntry,
      previousTarget,
      nextTarget: clampedProgress,
      progressChangeThreshold,
      reducedMotion,
    });

    hasProcessedInitialTargetRef.current = true;

    if (!isInitialEntry && !meaningfullyChanged && !reducedMotion) return;

    progressAnimationRef.current?.stop();
    arrowAnimationRef.current?.stop();
    arrowInteractionHandleRef.current?.cancel?.();

    previousTargetProgressRef.current = clampedProgress;
    setRenderedHasProgress(current => current || clampedProgress > 0);
    setRenderedIsOverflow(current => current || clampedProgress > 1 || previousTarget > 1);

    if (reducedMotion || !shouldAnimateProgress) {
      animatedProgress.setValue(clampedProgress);
      animatedArrow.setValue(1);
      setRenderedHasProgress(clampedProgress > 0);
      setRenderedIsOverflow(clampedProgress > 1);
      return;
    }

    let entryDelayHandle: ReturnType<typeof setTimeout> | null = null;
    const startProgressAndArrow = () => {
      if (!isMountedRef.current) return;
      if (isInitialEntry) animatedProgress.setValue(0);
      const progressAnimation = Animated.timing(animatedProgress, {
        toValue: clampedProgress,
        duration: isInitialEntry ? RING_ENTRY_DURATION_MS : RING_UPDATE_DURATION_MS,
        easing: isInitialEntry
          ? driverStatisticsEasing.easeOutCubic
          : driverStatisticsEasing.easeInOutCubic,
        useNativeDriver: false,
      });
      progressAnimationRef.current = progressAnimation;
      progressAnimation.start(({ finished }) => {
        if (!finished || !isMountedRef.current) return;
        progressAnimationRef.current = null;
        setRenderedHasProgress(clampedProgress > 0);
        setRenderedIsOverflow(clampedProgress > 1);
      });

      if (!shouldAnimateArrow) {
        animatedArrow.setValue(1);
        return;
      }

      const startArrowAnimation = () => {
        if (!isMountedRef.current) return;
        animatedArrow.setValue(0);
        const sequence = Animated.sequence([
          Animated.timing(animatedArrow, {
            toValue: 0.35,
            duration: ARROW_CONTACT_DURATION_MS,
            easing: Easing?.out?.(Easing.cubic) ?? driverStatisticsEasing.easeOutCubic,
            useNativeDriver: false,
          }),
          Animated.timing(animatedArrow, {
            toValue: 0.63,
            duration: ARROW_FORM_DURATION_MS,
            easing: Easing?.inOut?.(Easing.cubic) ?? driverStatisticsEasing.easeInOutCubic,
            useNativeDriver: false,
          }),
          Animated.timing(animatedArrow, {
            toValue: 0.8,
            duration: ARROW_FORWARD_BOUNCE_DURATION_MS,
            easing: Easing?.out?.(Easing.cubic) ?? driverStatisticsEasing.easeOutCubic,
            useNativeDriver: false,
          }),
          Animated.timing(animatedArrow, {
            toValue: 0.92,
            duration: ARROW_REBOUND_DURATION_MS,
            easing: Easing?.out?.(Easing.cubic) ?? driverStatisticsEasing.easeOutCubic,
            useNativeDriver: false,
          }),
          Animated.timing(animatedArrow, {
            toValue: 1,
            duration: ARROW_SETTLE_DURATION_MS,
            easing: Easing?.out?.(Easing.cubic) ?? driverStatisticsEasing.easeOutCubic,
            useNativeDriver: false,
          }),
        ]);
        arrowAnimationRef.current = sequence;
        sequence.start(({ finished }) => {
          if (finished) arrowAnimationRef.current = null;
        });
      };
      arrowInteractionHandleRef.current = InteractionManager?.runAfterInteractions?.(
        startArrowAnimation,
      ) ?? null;
      if (!arrowInteractionHandleRef.current) startArrowAnimation();
    };

    const delayMs = isInitialEntry ? Math.max(0, entryDelayMs) : 0;
    if (delayMs > 0) {
      entryDelayHandle = setTimeout(startProgressAndArrow, delayMs);
    } else {
      startProgressAndArrow();
    }

    return () => {
      if (entryDelayHandle) clearTimeout(entryDelayHandle);
      arrowInteractionHandleRef.current?.cancel?.();
    };
  }, [
    animateArrow,
    animatedArrow,
    animatedProgress,
    clampedProgress,
    effectiveAnimationMode,
    entryDelayMs,
    isUnconfiguredGoal,
    progressChangeThreshold,
    reducedMotion,
    showArrow,
  ]);

  useEffect(() => {
    if (!DEBUG_PROGRESS_RING_GEOMETRY) return;

    const snapshot = getRingGeometrySnapshot(clampedProgress, center, center, radius);
    console.debug('[ProgressRing geometry]', snapshot);
  }, [center, clampedProgress, radius]);

  const baseStrokeDashoffset = animatedProgress.interpolate({
    inputRange: [0, 1, maxLaps],
    outputRange: [circumference, 0, 0],
    extrapolate: 'clamp',
  });

  const overflowInputRange: number[] = [0, 1];
  const overflowOutputRange: number[] = [circumference, circumference];

  for (let i = 1; i < maxLaps; i++) {
    overflowInputRange.push(i + LAP_RESET_EPSILON);
    overflowOutputRange.push(circumference);
    overflowInputRange.push(i + 1);
    overflowOutputRange.push(0);
  }

  const overflowStrokeDashoffset = animatedProgress.interpolate({
    inputRange: overflowInputRange,
    outputRange: overflowOutputRange,
    extrapolate: 'clamp',
  });

  const overflowOpacity = animatedProgress.interpolate({
    inputRange: [0, 1, 1 + LAP_RESET_EPSILON, maxLaps],
    outputRange: [0, 0, 1, 1],
    extrapolate: 'clamp',
  });

  const baseProgressOpacity = animatedProgress.interpolate({
    inputRange: [0, 1, 1 + LAP_RESET_EPSILON, maxLaps],
    outputRange: [1, 1, 0, 0],
    extrapolate: 'clamp',
  });

  const baseCompleteOpacity = animatedProgress.interpolate({
    inputRange: [0, 1, 1 + LAP_RESET_EPSILON, maxLaps],
    outputRange: [0, 0, 1, 1],
    extrapolate: 'clamp',
  });

  const capX = animatedProgress.interpolate({
    inputRange: capPositionInterpolation.inputRange,
    outputRange: capPositionInterpolation.capXRange,
    extrapolate: 'clamp',
  });

  const capY = animatedProgress.interpolate({
    inputRange: capPositionInterpolation.inputRange,
    outputRange: capPositionInterpolation.capYRange,
    extrapolate: 'clamp',
  });
  const capBridgePath = detailLevel === 'full'
    ? animatedProgress.interpolate({
        inputRange: capPositionInterpolation.inputRange,
        outputRange: capPositionInterpolation.capBridgePathRange,
        extrapolate: 'clamp',
      })
    : null;
  const shadowPaths = capPositionInterpolation.shadowPathRanges.map(({ segment, outputRange }) => ({
    segment,
    d: animatedProgress.interpolate({
      inputRange: capPositionInterpolation.inputRange,
      outputRange,
      extrapolate: 'clamp',
    }),
  }));
  const arrowShaftPath = animatedArrow.interpolate({
    inputRange: ARROW_MORPH_INPUT_RANGE,
    outputRange: ARROW_KEYFRAMES.shaft,
    extrapolate: 'clamp',
  });
  const arrowHeadPath = animatedArrow.interpolate({
    inputRange: ARROW_MORPH_INPUT_RANGE,
    outputRange: ARROW_KEYFRAMES.head,
    extrapolate: 'clamp',
  });
  const arrowBounceTranslateX = animatedArrow.interpolate({
    inputRange: ARROW_MORPH_INPUT_RANGE,
    outputRange: ARROW_BOUNCE_TRANSLATE_X,
    extrapolate: 'clamp',
  });

  const hasProgress = isUnconfiguredGoal ? false : renderedHasProgress;
  const isOverflow = isUnconfiguredGoal ? false : renderedIsOverflow;
  const ringTrackColor = trackColor ?? DEFAULT_TRACK_COLOR;
  const shouldRenderShadow =
    !isUnconfiguredGoal
    && (
      allowSmallOverflowShadow
      || (
        detailLevel === 'full'
        && size >= MIN_SHADOW_SIZE
        && strokeWidth >= MIN_SHADOW_STROKE_WIDTH
      )
    );
  const arrowScale = strokeWidth / ARROW_BASE_BADGE_DIAMETER;
  const arrowStrokeWidth = Math.max(1.1, strokeWidth * ARROW_STROKE_TO_BADGE_RATIO);
  const showZeroStartCap = !isUnconfiguredGoal && !hasProgress && showStartCapAtZero;

  return (
    <View
      testID={testID}
      accessibilityRole="progressbar"
      accessibilityLabel={
        isUnconfiguredGoal && showArrow
          ? 'Daily earnings goal not set.'
          : undefined
      }
      accessibilityValue={{
        min: 0,
        max: 100,
        // Fabric requires integers; fractional progress crashes with "Loss of precision".
        now: Math.round(Math.min(1, clampedProgress) * 100),
      }}
      style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}
    >
      {/* Layer 1: inactive track. Layer 2: base progress ring. */}
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={ringTrackColor}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeOpacity={trackOpacity}
          />
          {isOverflow ? (
            <>
              <AnimatedCircle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={color}
                strokeWidth={strokeWidth}
                fill="transparent"
                strokeDasharray={circumference}
                strokeDashoffset={baseStrokeDashoffset as unknown as number}
                strokeLinecap="round"
                opacity={baseProgressOpacity as unknown as number}
              />
              <AnimatedCircle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={color}
                strokeWidth={strokeWidth}
                fill="none"
                opacity={baseCompleteOpacity as unknown as number}
              />
            </>
          ) : hasProgress ? (
            <AnimatedCircle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={color}
              strokeWidth={strokeWidth}
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={baseStrokeDashoffset as unknown as number}
              strokeLinecap="round"
            />
          ) : null}
        </G>
      </Svg>

      {/* Layer 3: overflow/current lap arc with flat ends. */}
      {isOverflow && (
        <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
          <Svg width={size} height={size}>
            <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
              <AnimatedCircle
                testID="progress-ring-overflow-arc"
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={color}
                strokeWidth={strokeWidth}
                fill="transparent"
                strokeDasharray={circumference}
                strokeDashoffset={overflowStrokeDashoffset as unknown as number}
                strokeLinecap="butt"
                opacity={overflowOpacity as unknown as number}
              />
            </G>
          </Svg>
        </View>
      )}

      {/* Layer 3.5: same-color sleeve that blends the raised cap into the flat overflow arc. */}
      {isOverflow && detailLevel === 'full' && capBridgePath && (
        <AnimatedView pointerEvents="none" style={[StyleSheet.absoluteFillObject, { opacity: overflowOpacity }]}>
          <Svg width={size} height={size}>
            <AnimatedPath
              testID="progress-ring-cap-bridge"
              d={capBridgePath as unknown as string}
              stroke={color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              fill="none"
            />
          </Svg>
        </AnimatedView>
      )}

      {/* Layer 4: short crescent shadow trailing the raised cap. Omitted on tiny rings to avoid artifacts. */}
      {isOverflow && shouldRenderShadow && (
        <AnimatedView
          testID="progress-ring-overflow-shadow"
          pointerEvents="none"
          style={[StyleSheet.absoluteFillObject, { opacity: overflowOpacity }]}
        >
          <Svg width={size} height={size}>
            <Defs>
              <Filter id="progressRingShadowBlur">
                <FeGaussianBlur stdDeviation={0.85} />
              </Filter>
            </Defs>
            {shadowPaths.map(({ segment, d }) => (
              <AnimatedPath
                key={`${segment.start}-${segment.end}`}
                d={d as unknown as string}
                stroke="#000000"
                strokeWidth={strokeWidth * 0.88}
                strokeLinecap="round"
                strokeOpacity={segment.opacity}
                fill="none"
                filter="url(#progressRingShadowBlur)"
              />
            ))}
          </Svg>
        </AnimatedView>
      )}

      {/* Layer 5: raised rounded cap. */}
      {isOverflow && (
        <AnimatedView pointerEvents="none" style={[StyleSheet.absoluteFillObject, { opacity: overflowOpacity }]}>
          <Svg width={size} height={size}>
            <AnimatedCircle
              testID="progress-ring-raised-cap"
              cx={capX as unknown as number}
              cy={capY as unknown as number}
              r={strokeWidth / 2}
              fill={color}
            />
          </Svg>
        </AnimatedView>
      )}

      {/* Layer 6: fixed arrow at 12 o'clock. */}
      {showArrow && (
        <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
          {!hasProgress && (
            <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
              <Circle
                cx={size / 2}
                cy={strokeWidth / 2}
                r={strokeWidth / 2}
                fill={color}
                testID="progress-ring-arrow-badge"
              />
            </Svg>
          )}
          <AnimatedView
            style={[StyleSheet.absoluteFillObject, { transform: [{ translateX: arrowBounceTranslateX }] }]}
            pointerEvents="none"
          >
            <Svg width={size} height={size}>
              <G transform={`translate(${size / 2}, ${strokeWidth / 2}) scale(${arrowScale})`}>
                {[arrowShaftPath, arrowHeadPath].map((d, index) => (
                  <AnimatedPath
                    key={`arrow-${index}`}
                    d={d as unknown as string}
                    stroke="#000000"
                    strokeWidth={arrowStrokeWidth / arrowScale}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                ))}
              </G>
            </Svg>
          </AnimatedView>
        </View>
      )}

      {!hasProgress && showZeroStartCap && (
        <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
          <Svg width={size} height={size}>
            <Defs>
              <Filter id="progressRingStartCapShadow">
                <FeGaussianBlur stdDeviation={0.85} />
              </Filter>
            </Defs>
            <Circle
              cx={size / 2 + strokeWidth * 0.18}
              cy={strokeWidth / 2 + strokeWidth * 0.18}
              r={strokeWidth / 2}
              fill="#000000"
              fillOpacity={0.28}
              filter="url(#progressRingStartCapShadow)"
            />
            <Circle
              cx={size / 2}
              cy={strokeWidth / 2}
              r={strokeWidth / 2}
              fill={color}
              testID="progress-ring-zero-start-cap"
            />
          </Svg>
        </View>
      )}

      {children ? (
        <View style={[StyleSheet.absoluteFillObject, styles.center]}>
          {children}
        </View>
      ) : null}
    </View>
  );
}

export const ProgressRing = React.memo(ProgressRingComponent);

const styles = StyleSheet.create({
  center: {
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
});
