import React from 'react';
import {
  ActivityIndicator,
  Animated,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  ScrollView,
  ScrollViewProps,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { headerScrollStore } from '@/components/GlassHeader';
import * as Haptics from 'expo-haptics';


interface GlassScrollViewProps extends ScrollViewProps {
  indicatorTop?: number;
  indicatorBottom?: number;
  onRefresh?: () => void;
  refreshing?: boolean;
  refreshIndicatorTop?: number;
}

export const GlassScrollView = React.forwardRef<ScrollView, GlassScrollViewProps>(
  (
    {
      children,
      indicatorTop = 88,
      indicatorBottom,
      onScroll,
      onContentSizeChange,
      onLayout,
      scrollEventThrottle = 16,
      onRefresh,
      refreshing = false,
      refreshIndicatorTop,
      ...props
    },
    ref,
  ) => {
    const colors = useColors();
    const insets = useSafeAreaInsets();
    const pathname = typeof usePathname === 'function' ? usePathname() : '/mock-path';
    const scrollY = React.useRef(new Animated.Value(0)).current;
    const indicatorOpacity = React.useRef(new Animated.Value(0)).current;
    const hideIndicatorTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const [scrollMetrics, setScrollMetrics] = React.useState({
      contentHeight: 1,
      viewportHeight: 1,
      indicatorTrackHeight: 1,
    });

    const snapAnim = React.useRef(new Animated.Value(0)).current;
    const hapticTriggered = React.useRef(false);
    const pullProgress = React.useRef(new Animated.Value(0)).current;

    React.useEffect(() => {
      Animated.spring(snapAnim, {
        toValue: refreshing ? 48 : 0,
        tension: 50,
        friction: 8,
        useNativeDriver: false,
      }).start();

      if (refreshing) {
        Animated.timing(pullProgress, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }).start();
      } else {
        hapticTriggered.current = false;
        Animated.timing(pullProgress, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start();
      }
    }, [refreshing]);

    const insetTop = props.contentInset?.top ?? 0;
    const restingY = Platform.OS === 'ios' ? -insetTop : 0;
    const pullThreshold = restingY - 55;

    const refreshOpacity = pullProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1],
      extrapolate: 'clamp',
    });

    const refreshScale = pullProgress.interpolate({
      inputRange: [0, 0.8, 1],
      outputRange: [0.6, 1.2, 1.35],
      extrapolate: 'clamp',
    });

    const refreshTranslateY = pullProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 18],
      extrapolate: 'clamp',
    });

    const rotate = scrollY.interpolate({
      inputRange: [pullThreshold, restingY],
      outputRange: ['360deg', '0deg'],
      extrapolate: 'clamp',
    });





    const canScroll = scrollMetrics.contentHeight > scrollMetrics.viewportHeight + 12;
    const indicatorHeight = Math.max(
      24,
      Math.min(
        80,
        (scrollMetrics.viewportHeight / scrollMetrics.contentHeight) * scrollMetrics.indicatorTrackHeight,
      ),
    );
    const indicatorTravel = Math.max(0, scrollMetrics.indicatorTrackHeight - indicatorHeight);
    const indicatorTranslateY = scrollY.interpolate({
      inputRange: [0, Math.max(1, scrollMetrics.contentHeight - scrollMetrics.viewportHeight)],
      outputRange: [0, indicatorTravel],
      extrapolate: 'clamp',
    });

    const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetY = event.nativeEvent.contentOffset.y;
      scrollY.setValue(offsetY);
      indicatorOpacity.setValue(1);

      if (onRefresh && !refreshing) {
        const dragDistance = restingY - offsetY;
        const progress = Math.min(1, Math.max(0, dragDistance / 55));
        pullProgress.setValue(progress);

        // Trigger a light tactile haptic impact when pulling past the refresh threshold
        if (offsetY <= pullThreshold) {
          if (!hapticTriggered.current) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            hapticTriggered.current = true;
          }
        } else if (offsetY > pullThreshold + 10) {
          hapticTriggered.current = false;
        }
      }

      // Update header scroll store
      headerScrollStore?.set(pathname, offsetY > 2);

      if (hideIndicatorTimeout.current) clearTimeout(hideIndicatorTimeout.current);
      hideIndicatorTimeout.current = setTimeout(() => {
        Animated.timing(indicatorOpacity, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }).start();
      }, 700);
      onScroll?.(event);
    };



    const handleScrollEndDrag = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetY = event.nativeEvent.contentOffset.y;
      if (offsetY < pullThreshold && onRefresh && !refreshing) {
        onRefresh();
      }
      props.onScrollEndDrag?.(event);
    };

    React.useEffect(() => {
      return () => {
        if (hideIndicatorTimeout.current) clearTimeout(hideIndicatorTimeout.current);
      };
    }, []);

    return (
      <View style={styles.wrap}>
        {onRefresh && (
          <Animated.View
            style={[
              styles.refreshContainer,
              {
                top: refreshIndicatorTop ?? (indicatorTop - 44),
                opacity: refreshOpacity,
                transform: [
                  { translateY: refreshTranslateY },
                  { scale: refreshScale },
                  { rotate: refreshing ? '0deg' : rotate },
                ],
              },
            ]}
          >
            <ActivityIndicator
              size="small"
              color={colors.primary}
              animating={refreshing}
              hidesWhenStopped={false}
            />
          </Animated.View>
        )}
        <ScrollView
          {...props}
          ref={ref}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={scrollEventThrottle}
          onScroll={handleScroll}
          onScrollEndDrag={handleScrollEndDrag}
          onContentSizeChange={(contentWidth, contentHeight) => {
            setScrollMetrics(prev => ({ ...prev, contentHeight }));
            onContentSizeChange?.(contentWidth, contentHeight);
          }}
          onLayout={event => {
            const viewportHeight = event.nativeEvent.layout.height;
            setScrollMetrics(prev => ({ ...prev, viewportHeight }));
            onLayout?.(event);
          }}
        >
          {onRefresh && <Animated.View style={{ height: snapAnim }} />}
          {children}
        </ScrollView>
        {canScroll && (
          <View
            pointerEvents="none"
            style={[
              styles.scrollIndicatorTrack,
              {
                top: indicatorTop,
                bottom: indicatorBottom ?? insets.bottom + 24,
              },
            ]}
            onLayout={event => {
              const indicatorTrackHeight = event.nativeEvent.layout.height;
              setScrollMetrics(prev => ({ ...prev, indicatorTrackHeight }));
            }}
          >
            <Animated.View
              style={[
                styles.scrollIndicatorThumb,
                {
                  height: indicatorHeight,
                  backgroundColor: colors.foreground,
                  opacity: indicatorOpacity,
                  transform: [{ translateY: indicatorTranslateY }],
                },
              ]}
            />
          </View>
        )}
      </View>
    );
  },
);

GlassScrollView.displayName = 'GlassScrollView';

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  scrollIndicatorTrack: {
    position: 'absolute',
    right: 1,
    width: 2,
  },
  scrollIndicatorThumb: {
    width: 2,
    borderRadius: 2,
  },
  refreshContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
