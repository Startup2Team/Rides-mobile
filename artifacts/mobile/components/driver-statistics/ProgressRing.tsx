import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, InteractionManager, View, StyleSheet, Animated, Easing } from 'react-native';
import Svg, { Circle, Defs, FeGaussianBlur, Filter, G, Path } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent
  ? Animated.createAnimatedComponent(Circle)
  : Circle;

const AnimatedPath = Animated.createAnimatedComponent
  ? Animated.createAnimatedComponent(Path)
  : Path;

const AnimatedView = Animated.createAnimatedComponent
  ? Animated.createAnimatedComponent(View)
  : View;

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
const CAP_BRIDGE_ARC_DEGREES = 6;
const CAP_POSITION_STEPS_PER_LAP = 72;
const SHADOW_PATH_STEPS = 8;
const PROGRESS_ANIMATION_DURATION_MS = 850;
const ARROW_ANIMATION_DURATION_MS = 560;
const ARROW_CONTACT_DURATION_MS = 200;
const ARROW_FORM_DURATION_MS = 190;
const ARROW_FORWARD_BOUNCE_DURATION_MS = 70;
const ARROW_REBOUND_DURATION_MS = 60;
const ARROW_SETTLE_DURATION_MS =
  ARROW_ANIMATION_DURATION_MS -
  ARROW_CONTACT_DURATION_MS -
  ARROW_FORM_DURATION_MS -
  ARROW_FORWARD_BOUNCE_DURATION_MS -
  ARROW_REBOUND_DURATION_MS;
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
const ARROW_BOUNCE_TRANSLATE_X = [0, 0, 0, 0, 0, 1.5, -0.35, 0];
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
  const capBridgePathRange = [
    describeArc(cx, cy, r, -CAP_BRIDGE_ARC_DEGREES, 0),
    describeArc(cx, cy, r, -CAP_BRIDGE_ARC_DEGREES, 0),
  ];

  for (let lap = 1; lap < maxLaps; lap++) {
    inputRange.push(lap + LAP_RESET_EPSILON);
    capXRange.push(cx);
    capYRange.push(cy - r);
    capBridgePathRange.push(describeArc(cx, cy, r, -CAP_BRIDGE_ARC_DEGREES, 0));
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
      capBridgePathRange.push(describeArc(cx, cy, r, leadingAngleDeg - CAP_BRIDGE_ARC_DEGREES, leadingAngleDeg));
      shadowPathRanges.forEach(({ segment, outputRange }) => {
        outputRange.push(describeArc(cx, cy, r, leadingAngleDeg + segment.start, leadingAngleDeg + segment.end));
      });
    }
  }

  return { inputRange, capXRange, capYRange, capBridgePathRange, shadowPathRanges };
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
  const animatedArrow = useRef(new Animated.Value(0)).current;
  const previousProgressRef = useRef(clampedProgress);
  const isMountedRef = useRef(false);
  const [isReduceMotionEnabled, setIsReduceMotionEnabled] = useState(false);
  const [renderedHasProgress, setRenderedHasProgress] = useState(clampedProgress > 0);
  const [renderedIsOverflow, setRenderedIsOverflow] = useState(clampedProgress > 1);
  const maxLaps = Math.max(2, Math.ceil(Math.max(clampedProgress, previousProgressRef.current)) + 2);
  const capPositionInterpolation = buildLapPositionInterpolation(maxLaps, center, center, radius);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    Promise.resolve(AccessibilityInfo?.isReduceMotionEnabled?.() ?? false)
      .then(enabled => {
        if (isActive) {
          setIsReduceMotionEnabled(enabled);
        }
      })
      .catch(() => undefined);

    const subscription = AccessibilityInfo?.addEventListener?.('reduceMotionChanged', setIsReduceMotionEnabled);

    return () => {
      isActive = false;
      subscription?.remove?.();
    };
  }, []);

  useEffect(() => {
    if (clampedProgress > 0) {
      setRenderedHasProgress(true);
    }
    if (clampedProgress > 1 || previousProgressRef.current > 1) {
      setRenderedIsOverflow(true);
    }

    const animation = Animated.timing(animatedProgress, {
      toValue: clampedProgress,
      duration: PROGRESS_ANIMATION_DURATION_MS,
      useNativeDriver: false,
    });

    animation.start(({ finished }) => {
      if (!finished || !isMountedRef.current) return;

      previousProgressRef.current = clampedProgress;
      setRenderedHasProgress(clampedProgress > 0);
      setRenderedIsOverflow(clampedProgress > 1);
    });
  }, [animatedProgress, clampedProgress]);

  useEffect(() => {
    if (!showArrow) return;

    if (isReduceMotionEnabled) {
      animatedArrow.setValue(1);
      return;
    }

    let isCancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const startArrowAnimation = () => {
      if (isCancelled) return;

      animatedArrow.stopAnimation?.();
      animatedArrow.setValue(0);
      Animated.timing(animatedArrow, {
        toValue: 0.35,
        duration: ARROW_CONTACT_DURATION_MS,
        easing: Easing?.out?.(Easing.cubic),
        useNativeDriver: false,
      }).start(({ finished }) => {
        if (!finished || isCancelled) return;

        Animated.timing(animatedArrow, {
          toValue: 0.63,
          duration: ARROW_FORM_DURATION_MS,
          easing: Easing?.inOut?.(Easing.cubic),
          useNativeDriver: false,
        }).start(({ finished: didForm }) => {
          if (!didForm || isCancelled) return;

          Animated.timing(animatedArrow, {
            toValue: 0.8,
            duration: ARROW_FORWARD_BOUNCE_DURATION_MS,
            easing: Easing?.out?.(Easing.cubic),
            useNativeDriver: false,
          }).start(({ finished: didOvershoot }) => {
            if (!didOvershoot || isCancelled) return;

            Animated.timing(animatedArrow, {
              toValue: 0.92,
              duration: ARROW_REBOUND_DURATION_MS,
              easing: Easing?.out?.(Easing.cubic),
              useNativeDriver: false,
            }).start(({ finished: didRebound }) => {
              if (!didRebound || isCancelled) return;

              Animated.timing(animatedArrow, {
                toValue: 1,
                duration: ARROW_SETTLE_DURATION_MS,
                easing: Easing?.out?.(Easing.cubic),
                useNativeDriver: false,
              }).start();
            });
          });
        });
      });
    };
    const scheduleArrowAnimation = () => {
      timeoutId = setTimeout(() => {
        startArrowAnimation();
      }, 0);
    };
    const interactionHandle = InteractionManager?.runAfterInteractions?.(scheduleArrowAnimation);

    if (!interactionHandle) {
      scheduleArrowAnimation();
    }

    return () => {
      isCancelled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      interactionHandle?.cancel?.();
    };
  }, [animatedArrow, clampedProgress, isReduceMotionEnabled, showArrow]);

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
  const capBridgePath = animatedProgress.interpolate({
    inputRange: capPositionInterpolation.inputRange,
    outputRange: capPositionInterpolation.capBridgePathRange,
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

  const hasProgress = renderedHasProgress;
  const isOverflow = renderedIsOverflow;
  const ringTrackColor = trackColor ?? DEFAULT_TRACK_COLOR;
  const shouldRenderShadow = size >= MIN_SHADOW_SIZE && strokeWidth >= MIN_SHADOW_STROKE_WIDTH;
  const arrowScale = strokeWidth / ARROW_BASE_BADGE_DIAMETER;
  const arrowStrokeWidth = Math.max(1.1, strokeWidth * ARROW_STROKE_TO_BADGE_RATIO);

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
      {isOverflow && (
        <AnimatedView pointerEvents="none" style={[StyleSheet.absoluteFillObject, { opacity: overflowOpacity }]}>
          <Svg width={size} height={size}>
            <AnimatedPath
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
        <AnimatedView pointerEvents="none" style={[StyleSheet.absoluteFillObject, { opacity: overflowOpacity }]}>
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
