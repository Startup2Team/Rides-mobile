import React from 'react';
import {
  Animated,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  ScrollViewProps,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { headerScrollStore } from '@/components/GlassHeader';

interface GlassScrollViewProps extends ScrollViewProps {
  indicatorTop?: number;
  indicatorBottom?: number;
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

    React.useEffect(() => {
      return () => {
        if (hideIndicatorTimeout.current) clearTimeout(hideIndicatorTimeout.current);
      };
    }, []);

    return (
      <View style={styles.wrap}>
        <ScrollView
          {...props}
          ref={ref}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={scrollEventThrottle}
          onScroll={handleScroll}
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
});
