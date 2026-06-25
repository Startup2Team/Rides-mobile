import { BlurView } from 'expo-blur';
import React from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  useColorScheme,
  View,
} from 'react-native';

interface SheetBackdropProps {
  onPress: () => void;
  /** Fades with sheet drag — pass formSheetDragAnim interpolated 1→0 */
  animatedOpacity?: Animated.AnimatedInterpolation<number>;
  blurIntensity?: number;
  lightScrimOpacity?: number;
  darkScrimOpacity?: number;
}

/**
 * Modal scrim shared by bottom sheets — matches Book a Ride dimming
 * with theme-aware frosted glass (same language as GlassHeader).
 */
export function SheetBackdrop({
  onPress,
  animatedOpacity,
  blurIntensity = 40,
  lightScrimOpacity = 0.42,
  darkScrimOpacity = 0.78,
}: SheetBackdropProps) {
  const scheme = useColorScheme();
  const glassTint = scheme === 'dark' ? 'dark' : 'light';
  const scrimOpacity = scheme === 'dark' ? darkScrimOpacity : lightScrimOpacity;
  const scrimColor = `rgba(0,0,0,${scrimOpacity})`;


  const content = (
    <>
      {blurIntensity > 0 && (
        <BlurView intensity={blurIntensity} tint={glassTint} style={StyleSheet.absoluteFill} />
      )}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: scrimColor }]} />
    </>
  );

  if (animatedOpacity) {
    return (
      <Animated.View style={[styles.root, { opacity: animatedOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onPress}>
          {content}
        </Pressable>
      </Animated.View>
    );
  }

  return (
    <Pressable style={styles.root} onPress={onPress}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 85,
  },
});
