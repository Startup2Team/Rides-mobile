import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent
  ? Animated.createAnimatedComponent(Circle)
  : Circle;

const AnimatedPath = Animated.createAnimatedComponent
  ? Animated.createAnimatedComponent(Path)
  : Path;


interface ProgressRingProps {
  size: number;
  strokeWidth: number;
  progress: number; // 0 to 1, or > 1 for overflow
  color: string;
  trackColor?: string;
  trackOpacity?: number;
  children?: React.ReactNode;
  showArrow?: boolean;
}

const LAP_RESET_EPSILON = 0.0001;
const DEFAULT_TRACK_COLOR = '#111827';
const SHADOW_ARC_DEGREES = 14;
const CAP_POSITION_STEPS_PER_LAP = 72;
const SHADOW_PATH_STEPS = 8;
const SHADOW_SEGMENTS = [
  { start: 0, end: SHADOW_ARC_DEGREES, opacity: 0.018 },
  { start: 0, end: 11, opacity: 0.026 },
  { start: 0, end: 8, opacity: 0.034 },
  { start: 0, end: 5.5, opacity: 0.044 },
  { start: 0, end: 3, opacity: 0.052 },
  { start: 0, end: 1.4, opacity: 0.058 },
];
const MIN_SHADOW_SIZE = 64;
const MIN_SHADOW_STROKE_WIDTH = 8;
const DEBUG_PROGRESS_RING_GEOMETRY = false;

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

function buildLapPositionInterpolation(maxLaps: number, cx: number, cy: number, r: number) {
  const inputRange: number[] = [0, 1];
  const capXRange: number[] = [cx, cx];
  const capYRange: number[] = [cy - r, cy - r];
  const shadowPathRanges = SHADOW_SEGMENTS.map(segment => ({
    segment,
    outputRange: [
      describeArc(cx, cy, r, segment.start, segment.end),
      describeArc(cx, cy, r, segment.start, segment.end),
    ],
  }));

  for (let lap = 1; lap < maxLaps; lap++) {
    inputRange.push(lap + LAP_RESET_EPSILON);
    capXRange.push(cx);
    capYRange.push(cy - r);
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
      shadowPathRanges.forEach(({ segment, outputRange }) => {
        outputRange.push(describeArc(cx, cy, r, leadingAngleDeg + segment.start, leadingAngleDeg + segment.end));
      });
    }
  }

  return { inputRange, capXRange, capYRange, shadowPathRanges };
}

export function ProgressRing({
  size,
  strokeWidth,
  progress,
  color,
  trackColor,
  trackOpacity = 0.72,
  children,
  showArrow = false,
}: ProgressRingProps) {
  const clampedProgress = Number.isFinite(progress) ? Math.max(0, progress) : 0;
  const center = size / 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const animatedProgress = useRef(new Animated.Value(0)).current;
  const maxLaps = Math.max(2, Math.ceil(clampedProgress) + 2);
  const capPositionInterpolation = buildLapPositionInterpolation(maxLaps, center, center, radius);

  useEffect(() => {
    Animated.timing(animatedProgress, {
      toValue: clampedProgress,
      duration: 850,
      useNativeDriver: false,
    }).start();
  }, [animatedProgress, clampedProgress]);

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
  const shadowPaths = capPositionInterpolation.shadowPathRanges.map(({ segment, outputRange }) => ({
    segment,
    d: animatedProgress.interpolate({
      inputRange: capPositionInterpolation.inputRange,
      outputRange,
      extrapolate: 'clamp',
    }),
  }));

  const isOverflow = clampedProgress > 1;
  const ringTrackColor = trackColor ?? DEFAULT_TRACK_COLOR;
  const shouldRenderShadow = size >= MIN_SHADOW_SIZE && strokeWidth >= MIN_SHADOW_STROKE_WIDTH;

  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
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
          ) : (
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
          )}
        </G>
      </Svg>

      {/* Layer 3: overflow/current lap arc with flat ends. */}
      {isOverflow && (
        <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
          <Svg width={size} height={size}>
            <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
              <AnimatedCircle
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

      {/* Layer 4: short crescent shadow trailing the raised cap. Omitted on tiny rings to avoid artifacts. */}
      {isOverflow && shouldRenderShadow && (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { opacity: overflowOpacity }]}>
          <Svg width={size} height={size}>
            {shadowPaths.map(({ segment, d }) => (
              <AnimatedPath
                key={`${segment.start}-${segment.end}`}
                d={d as unknown as string}
                stroke="#000000"
                strokeWidth={strokeWidth * 0.88}
                strokeLinecap="round"
                strokeOpacity={segment.opacity}
                fill="none"
              />
            ))}
          </Svg>
        </Animated.View>
      )}

      {/* Layer 5: raised rounded cap. */}
      {isOverflow && (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { opacity: overflowOpacity }]}>
          <Svg width={size} height={size}>
            <AnimatedCircle
              cx={capX as unknown as number}
              cy={capY as unknown as number}
              r={strokeWidth / 2}
              fill={color}
            />
          </Svg>
        </Animated.View>
      )}

      {/* Layer 6: fixed arrow at 12 o'clock. */}
      {showArrow && (
        <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
          <Svg width={size} height={size}>
            <G transform={`translate(${size / 2}, ${strokeWidth / 2})`}>
              <Path
                d="M -7,0 H 7 M 2,-5 L 8,0 L 2,5"
                stroke="#000000"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </G>
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

const styles = StyleSheet.create({
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
