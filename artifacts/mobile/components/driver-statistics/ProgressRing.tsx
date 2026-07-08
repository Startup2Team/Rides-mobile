import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import Svg, { Circle, G, Path, Defs, Mask } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent
  ? Animated.createAnimatedComponent(Circle)
  : Circle;

const AnimatedG = Animated.createAnimatedComponent
  ? Animated.createAnimatedComponent(G)
  : G;

const SafeDefs = Defs || G;
const SafeMask = Mask || G;

const SafeEasing = Easing || {
  out: (f: any) => f,
  back: (s?: number) => (t: number) => t,
  quad: (t: number) => t,
};

const SPARK_COUNT = 8;
const SPARKS = Array.from({ length: SPARK_COUNT }, (_, i) => {
  const angle = (i * 2 * Math.PI) / SPARK_COUNT;
  return {
    dx: Math.cos(angle),
    dy: Math.sin(angle),
  };
});

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

export function ProgressRing({
  size,
  strokeWidth,
  progress,
  color,
  trackColor,
  trackOpacity = 0.12,
  children,
  showArrow = false,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Animated values for progress and sparkles
  const animatedProgress = useRef(new Animated.Value(0)).current;
  const sparkleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // If progress is 0, use a tiny minimum progress (0.005) to render a round cap dot around the arrow
    const targetProgress = progress <= 0 ? 0.005 : progress;

    animatedProgress.setValue(0);
    sparkleAnim.setValue(0);

    const startAnimation = Animated.spring || Animated.timing;
    startAnimation(animatedProgress, {
      toValue: targetProgress,
      friction: 7, // Spring friction for elastic bounce
      tension: 40, // Spring tension
      duration: 1000, // Fallback timing duration
      easing: SafeEasing.out(SafeEasing.back(1.0)), // Fallback timing easing
      useNativeDriver: false, // Must be false for custom SVG attributes
    } as any).start(({ finished }) => {
      if (finished && targetProgress >= 1.0) {
        Animated.timing(sparkleAnim, {
          toValue: 1,
          duration: 600,
          easing: SafeEasing.out(SafeEasing.quad),
          useNativeDriver: false,
        }).start();
      }
    });
  }, [progress, animatedProgress, sparkleAnim]);

  // Interpolate progress to strokeDashoffset for base ring (0 to 100%)
  const baseStrokeDashoffset = animatedProgress.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [circumference, 0, 0],
    extrapolate: 'clamp',
  });

  // Dynamically generate the sawtooth input and output ranges for overflow laps
  const maxLaps = Math.max(10, Math.ceil(progress) + 2);
  const overflowInputRange: number[] = [0, 1];
  const overflowOutputRange: number[] = [circumference, circumference];

  for (let i = 1; i < maxLaps; i++) {
    // At the boundary i (e.g. 1.0001, 2.0001), it starts at circumference (0% progress)
    overflowInputRange.push(i + 0.0001);
    overflowOutputRange.push(circumference);

    // At the boundary i + 1 (e.g. 2, 3), it ends at 0 (100% progress)
    overflowInputRange.push(i + 1);
    overflowOutputRange.push(0);
  }

  const overflowStrokeDashoffset = animatedProgress.interpolate({
    inputRange: overflowInputRange,
    outputRange: overflowOutputRange,
    extrapolate: 'clamp',
  });

  // Interpolate progress to rotation angle for the arrow and moving progress head (in degrees)
  const arrowRotation = animatedProgress.interpolate({
    inputRange: [0, maxLaps],
    outputRange: [0, maxLaps * 360],
    extrapolate: 'clamp',
  });

  // Sparkle particle burst interpolations
  const sparkRadius = sparkleAnim.interpolate({
    inputRange: [0, 0.15, 1],
    outputRange: [0, 4, 0],
    extrapolate: 'clamp',
  });

  const sparkOpacity = sparkleAnim.interpolate({
    inputRange: [0, 0.1, 0.8, 1],
    outputRange: [0, 1, 1, 0],
    extrapolate: 'clamp',
  });

  const isOverflow = progress > 1;

  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <Svg width={size} height={size}>
        <SafeDefs>
          {/* Mask to ensure the drop shadow is constrained only within the ring path */}
          <SafeMask id={`ringMask-${size}`}>
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="white"
              strokeWidth={strokeWidth}
              fill="transparent"
            />
          </SafeMask>
        </SafeDefs>

        {/* Rotated group for the progress circles - natively rotated via react-native-svg */}
        <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
          {/* Background Circle */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={trackColor || color}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeOpacity={trackOpacity}
          />
          {/* Base Progress Circle (Animated up to 100%) */}
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
          {/* Overflow Progress Circle (Animated above 100% on top of the base circle) */}
          {isOverflow && (
            <AnimatedCircle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={color}
              strokeWidth={strokeWidth}
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={overflowStrokeDashoffset as unknown as number}
              strokeLinecap="round"
            />
          )}
        </G>

        {/* Stationary start-cap shadow at 12 o'clock under the start of the overflow lap */}
        {isOverflow && (
          <G mask={`url(#ringMask-${size})`}>
            {/* Softer, larger outer shadow */}
            <AnimatedCircle
              cx={size / 2 - 4}
              cy={strokeWidth / 2 + 1.5}
              r={strokeWidth / 2 + 3}
              fill="black"
              opacity={animatedProgress.interpolate({
                inputRange: [1, 1.05, 2],
                outputRange: [0, 0.15, 0.15],
                extrapolate: 'clamp',
              }) as unknown as number}
            />
            {/* Sharper, darker inner shadow */}
            <AnimatedCircle
              cx={size / 2 - 4}
              cy={strokeWidth / 2 + 0.5}
              r={strokeWidth / 2}
              fill="black"
              opacity={animatedProgress.interpolate({
                inputRange: [1, 1.05, 2],
                outputRange: [0, 0.35, 0.35],
                extrapolate: 'clamp',
              }) as unknown as number}
            />
          </G>
        )}

        {/* Animated group that rotates the moving head (shadow, cap, arrow) clockwise */}
        <AnimatedG
          rotation={arrowRotation as unknown as number}
          origin={`${size / 2}, ${size / 2}`}
        >
          {/* Soft Drop Shadows under the overflow end cap - Masked to the ring path */}
          {isOverflow && (
            <G mask={`url(#ringMask-${size})`}>
              {/* Softer, larger outer shadow */}
              <AnimatedCircle
                cx={size / 2 - 4}
                cy={strokeWidth / 2 + 1.5}
                r={strokeWidth / 2 + 3}
                fill="black"
                opacity={animatedProgress.interpolate({
                  inputRange: [1, 1.05, 2],
                  outputRange: [0, 0.15, 0.15],
                  extrapolate: 'clamp',
                }) as unknown as number}
              />
              {/* Sharper, darker inner shadow */}
              <AnimatedCircle
                cx={size / 2 - 4}
                cy={strokeWidth / 2 + 0.5}
                r={strokeWidth / 2}
                fill="black"
                opacity={animatedProgress.interpolate({
                  inputRange: [1, 1.05, 2],
                  outputRange: [0, 0.35, 0.35],
                  extrapolate: 'clamp',
                }) as unknown as number}
              />
            </G>
          )}

          {/* Masking cap circle to keep the overlay cap colored solid on top of shadow */}
          {isOverflow && (
            <AnimatedCircle
              cx={size / 2}
              cy={strokeWidth / 2}
              r={strokeWidth / 2}
              fill={color}
              opacity={animatedProgress.interpolate({
                inputRange: [1, 1.05, 2],
                outputRange: [0, 1, 1],
                extrapolate: 'clamp',
              }) as unknown as number}
            />
          )}
        </AnimatedG>

        {/* Stationary Arrow at the 12 o'clock position (always static) */}
        {showArrow && (
          <G transform={`translate(${size / 2}, ${strokeWidth / 2})`}>
            <Path
              d="M -5,0 H 5 M 1,-4 L 5,0 L 1,4"
              stroke="black"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </G>
        )}

        {/* Sparkle Particle Burst at 12 o'clock */}
        {progress >= 1.0 && (
          <G transform={`translate(${size / 2}, ${strokeWidth / 2})`}>
            {SPARKS.map((spark, idx) => {
              const cx = sparkleAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, spark.dx * 28],
              });
              const cy = sparkleAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, spark.dy * 28],
              });

              return (
                <AnimatedCircle
                  key={idx}
                  cx={cx as unknown as number}
                  cy={cy as unknown as number}
                  r={sparkRadius as unknown as number}
                  fill={color}
                  opacity={sparkOpacity as unknown as number}
                />
              );
            })}
          </G>
        )}
      </Svg>

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
