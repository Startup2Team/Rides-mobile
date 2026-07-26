import React from 'react';
import { Animated, Pressable, StyleSheet, View, useColorScheme } from 'react-native';
import { AppText } from '@/components/AppText';
import { duration, easing } from '@/constants/motion';
import { useColors } from '@/hooks/useColors';

export interface SegmentOption<T extends string> {
  id: T;
  label: string;
  /** Shown beside the label so the filter tells you what it will do. */
  count?: number;
}

interface Props<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (next: T) => void;
  accessibilityLabel?: string;
}

/**
 * iOS-style segmented control: one recessed track with a single raised selection
 * that slides. Deliberately not a row of filled pills — the app's chip idiom is
 * subtle tinted surfaces, and a row of solid-blue pills fights the cards.
 */
export function SegmentedFilter<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: Props<T>) {
  const colors = useColors();
  const isDark = useColorScheme() === 'dark';
  const [trackWidth, setTrackWidth] = React.useState(0);

  const selectedIndex = Math.max(0, options.findIndex(o => o.id === value));
  const translateX = React.useRef(new Animated.Value(0)).current;

  const segmentWidth = trackWidth > 0 ? (trackWidth - TRACK_PADDING * 2) / options.length : 0;

  React.useEffect(() => {
    if (segmentWidth <= 0) return;
    Animated.timing(translateX, {
      toValue: selectedIndex * segmentWidth,
      duration: duration.normal,
      easing: easing.easeOutCubic,
      useNativeDriver: true,
    }).start();
  }, [segmentWidth, selectedIndex, translateX]);

  return (
    <View
      style={[styles.track, { backgroundColor: isDark ? '#1C1C1E' : 'rgba(120,120,128,0.12)' }]}
      onLayout={e => setTrackWidth(e.nativeEvent.layout.width)}
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
    >
      {segmentWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.indicator,
            {
              width: segmentWidth,
              backgroundColor: isDark ? '#3A3A3C' : '#FFFFFF',
              transform: [{ translateX }],
            },
          ]}
        />
      ) : null}

      {options.map(option => {
        const active = option.id === value;
        return (
          <Pressable
            key={option.id}
            onPress={() => onChange(option.id)}
            style={styles.segment}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={
              option.count == null ? option.label : `${option.label}, ${option.count}`
            }
          >
            <AppText
              numberOfLines={1}
              style={[
                styles.label,
                { color: active ? colors.foreground : colors.mutedForeground },
                active ? styles.labelActive : null,
              ]}
            >
              {option.label}
              {option.count != null ? (
                <AppText
                  style={[
                    styles.count,
                    { color: active ? colors.mutedForeground : colors.mutedForeground },
                  ]}
                >
                  {`  ${option.count}`}
                </AppText>
              ) : null}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const TRACK_PADDING = 3;

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: TRACK_PADDING,
    position: 'relative',
  },
  indicator: {
    position: 'absolute',
    top: TRACK_PADDING,
    bottom: TRACK_PADDING,
    left: TRACK_PADDING,
    borderRadius: 9,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    minHeight: 32,
  },
  label: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  labelActive: { fontFamily: 'Inter_700Bold' },
  count: { fontSize: 11, fontFamily: 'Inter_500Medium' },
});
