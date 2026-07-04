import React from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
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
    const headerResetTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const [scrollMetrics, setScrollMetrics] = React.useState({
      contentHeight: 1,
      viewportHeight: 1,
      indicatorTrackHeight: 1,
    });

    const snapAnim = React.useRef(new Animated.Value(0)).current;
    const hapticTriggered = React.useRef(false);
    const pullProgress = React.useRef(new Animated.Value(0)).current;
    const isDragging = React.useRef(false);

    React.useEffect(() => {
      Animated.timing(snapAnim, {
        toValue: refreshing ? 48 : 0,
        duration: 220,
        easing: Easing.out(Easing.quad),
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

    const updateHeaderScrollState = React.useCallback((offsetY: number) => {
      const isScrolled = offsetY > restingY + 2;

      if (headerResetTimeout.current) {
        clearTimeout(headerResetTimeout.current);
        headerResetTimeout.current = null;
      }

      if (isScrolled) {
        headerScrollStore?.set(pathname, true);
        return;
      }

      if (!headerScrollStore.get(pathname)) {
        headerScrollStore?.set(pathname, false);
        return;
      }

      headerResetTimeout.current = setTimeout(() => {
        headerScrollStore?.set(pathname, false);
        headerResetTimeout.current = null;
      }, 140);
    }, [pathname, restingY]);

    const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetY = event.nativeEvent.contentOffset.y;
      scrollY.setValue(offsetY);
      indicatorOpacity.setValue(1);

      if (onRefresh && !refreshing && isDragging.current) {
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
      updateHeaderScrollState(offsetY);

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



    const handleScrollBeginDrag = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      isDragging.current = true;
      props.onScrollBeginDrag?.(event);
    };

    const handleScrollEndDrag = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      isDragging.current = false;
      const offsetY = event.nativeEvent.contentOffset.y;
      if (onRefresh && !refreshing) {
        if (offsetY < pullThreshold) {
          onRefresh();
        } else {
          Animated.timing(pullProgress, {
            toValue: 0,
            duration: 250,
            useNativeDriver: true,
          }).start();
        }
      }
      props.onScrollEndDrag?.(event);
    };

    React.useEffect(() => {
      return () => {
        if (hideIndicatorTimeout.current) clearTimeout(hideIndicatorTimeout.current);
        if (headerResetTimeout.current) clearTimeout(headerResetTimeout.current);
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
          onScrollBeginDrag={handleScrollBeginDrag}
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
