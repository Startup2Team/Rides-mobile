import * as Haptics from 'expo-haptics';
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
import { useColors } from '@/hooks/useColors';
import { useGlassHeaderMetrics } from '@/components/GlassHeader';
import { useTabBarGlass } from '@/components/navigation/TabBarGlassContext';

interface GlassScrollViewProps extends ScrollViewProps {
  indicatorTop?: number;
  indicatorBottom?: number;
  onRefresh?: () => void;
  refreshing?: boolean;
  refreshIndicatorTop?: number;
}

export function resolveGlassScrollViewLayout({
  defaultTop,
  defaultIndicatorTop,
  platformOS,
  contentInset,
  contentOffset,
  scrollIndicatorInsets,
  contentContainerStyle,
}: {
  defaultTop: number;
  defaultIndicatorTop: number;
  platformOS: typeof Platform.OS;
  contentInset?: ScrollViewProps['contentInset'];
  contentOffset?: ScrollViewProps['contentOffset'];
  scrollIndicatorInsets?: ScrollViewProps['scrollIndicatorInsets'];
  contentContainerStyle?: ScrollViewProps['contentContainerStyle'];
}) {
  const flattenedContentStyle = StyleSheet.flatten(contentContainerStyle);
  const hasContentTopPadding =
    typeof flattenedContentStyle?.paddingTop === 'number' && flattenedContentStyle.paddingTop > 0;
  const shouldApplyDefaultTopInset = !hasContentTopPadding;
  const resolvedDefaultTop = shouldApplyDefaultTopInset ? defaultTop : 0;

  const finalContentInset = platformOS === 'ios'
    ? { top: resolvedDefaultTop, ...contentInset }
    : contentInset;

  const finalContentOffset = platformOS === 'ios'
    ? { x: contentOffset?.x ?? 0, y: resolvedDefaultTop === 0 ? 0 : -resolvedDefaultTop, ...contentOffset }
    : contentOffset;

  const finalScrollIndicatorInsets = platformOS === 'ios'
    ? { top: defaultIndicatorTop, ...scrollIndicatorInsets }
    : scrollIndicatorInsets;

  const finalContentContainerStyle = [
    platformOS !== 'ios' && shouldApplyDefaultTopInset && { paddingTop: defaultTop },
    contentContainerStyle,
  ];

  const finalInsetTop = finalContentInset?.top ?? (platformOS === 'ios' ? resolvedDefaultTop : 0);
  const restingY = platformOS === 'ios' ? -finalInsetTop : 0;
  const initialDistance = Math.max(0, ((finalContentOffset?.y ?? restingY) - restingY));

  return {
    finalContentInset,
    finalContentOffset,
    finalScrollIndicatorInsets,
    finalContentContainerStyle,
    finalInsetTop,
    restingY,
    initialDistance,
  };
}

export const GlassScrollView = React.forwardRef<ScrollView, GlassScrollViewProps>(
  (
    {
      children,
      indicatorTop,
      indicatorBottom,
      onScroll,
      onContentSizeChange,
      onLayout,
      scrollEventThrottle = 16,
      onRefresh,
      refreshing = false,
      refreshIndicatorTop,
      showsVerticalScrollIndicator = false,
      ...props
    },
    ref,
  ) => {
    const colors = useColors();
    const insets = useSafeAreaInsets();
    const headerMetrics = useGlassHeaderMetrics();
    const { setHasGlassContent } = useTabBarGlass();
    const defaultTop = headerMetrics.contentTop;
    const defaultIndicatorTop = headerMetrics.indicatorTop;
    const actualIndicatorTop = indicatorTop ?? defaultIndicatorTop;
    const layout = resolveGlassScrollViewLayout({
      defaultTop,
      defaultIndicatorTop,
      platformOS: Platform.OS,
      contentInset: props.contentInset,
      contentOffset: props.contentOffset,
      scrollIndicatorInsets: props.scrollIndicatorInsets,
      contentContainerStyle: props.contentContainerStyle,
    });
    const {
      finalContentInset,
      finalContentOffset,
      finalScrollIndicatorInsets,
      finalContentContainerStyle,
      finalInsetTop,
      restingY,
      initialDistance,
    } = layout;

    const scrollDistance = React.useRef(new Animated.Value(initialDistance)).current;
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
    }, [pullProgress, refreshing, snapAnim]);

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

    const canScroll = scrollMetrics.contentHeight > scrollMetrics.viewportHeight + 12;
    const indicatorHeight = Math.max(
      24,
      Math.min(
        80,
        (scrollMetrics.viewportHeight / scrollMetrics.contentHeight) * scrollMetrics.indicatorTrackHeight,
      ),
    );
    const indicatorTravel = Math.max(0, scrollMetrics.indicatorTrackHeight - indicatorHeight);
    const indicatorTranslateY = scrollDistance.interpolate({
      inputRange: [0, Math.max(1, scrollMetrics.contentHeight - scrollMetrics.viewportHeight)],
      outputRange: [0, indicatorTravel],
      extrapolate: 'clamp',
    });

    const updateScrollDistance = (offsetY: number) => {
      scrollDistance.setValue(Math.max(0, offsetY - restingY));
    };

    React.useEffect(() => {
      setHasGlassContent(canScroll);
      return () => setHasGlassContent(false);
    }, [canScroll, setHasGlassContent]);

    const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetY = event.nativeEvent.contentOffset.y;
      updateScrollDistance(offsetY);
      indicatorOpacity.setValue(1);

      if (onRefresh && !refreshing && isDragging.current) {
        const dragDistance = restingY - offsetY;
        const progress = Math.min(1, Math.max(0, dragDistance / 55));
        pullProgress.setValue(progress);

        if (offsetY <= restingY - 55) {
          if (!hapticTriggered.current) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            hapticTriggered.current = true;
          }
        } else if (offsetY > restingY - 45) {
          hapticTriggered.current = false;
        }
      }

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
        if (offsetY < restingY - 55) {
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
      };
    }, []);

    return (
      <View style={styles.wrap}>
        {onRefresh && (
          <Animated.View
            style={[
              styles.refreshContainer,
              {
                top: refreshIndicatorTop ?? (actualIndicatorTop - 44),
                opacity: refreshOpacity,
                transform: [
                  { translateY: refreshTranslateY },
                  { scale: refreshScale },
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
          contentInset={finalContentInset}
          contentOffset={finalContentOffset}
          scrollIndicatorInsets={finalScrollIndicatorInsets}
          contentContainerStyle={finalContentContainerStyle}
          showsVerticalScrollIndicator={showsVerticalScrollIndicator}
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
                top: actualIndicatorTop,
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
