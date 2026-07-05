import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  useColorScheme,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { BlurView } from 'expo-blur';
import { icons } from '@/constants/icons';
import { duration, easing } from '@/constants/motion';
import { spacing } from '@/constants/spacing';
import { TAB_BAR_CONTENT_HEIGHT, TAB_BAR_SAFE_BOTTOM, computeTabBarHeight } from '@/constants/tabBar';
import { typography } from '@/constants/typography';
import { useColors } from '@/hooks/useColors';
import { useTabBarGlass } from '@/components/navigation/TabBarGlassContext';

const ACTIVE_LIGHT = '#007AFF';
const ACTIVE_DARK = '#0A84FF';
const INACTIVE_LIGHT = '#000000';
const INACTIVE_DARK = '#FFFFFF';
const LIGHT_BACKGROUND = '#FFFFFF';
const DARK_BACKGROUND = '#1C1C1E';
const LIGHT_BORDER = '#E5E5EA';
const DARK_BORDER = '#38383A';

function TabBarItem({
  focused,
  label,
  icon,
  onPress,
  onLongPress,
  testID,
  accessibilityLabel,
  accessibilityState,
  activeColor,
  inactiveColor,
}: {
  focused: boolean;
  label: string;
  icon?: (props: { color: string; size: number; focused: boolean }) => React.ReactNode;
  onPress: () => void;
  onLongPress: () => void;
  testID?: string;
  accessibilityLabel?: string;
  accessibilityState?: { selected?: boolean };
  activeColor: string;
  inactiveColor: string;
}) {
  const progress = useRef(new Animated.Value(focused ? 1 : 0)).current;
  const tapScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: focused ? 1 : 0,
      duration: duration.normal,
      easing: easing.easeOutQuad,
      useNativeDriver: true,
    }).start();
  }, [focused, progress]);

  const focusScale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.94, 1.08],
  });
  const iconScale = Animated.multiply(focusScale, tapScale);
  const iconOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.62, 1],
  });
  const labelOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 1],
  });

  const animateTap = () => {
    tapScale.stopAnimation();
    tapScale.setValue(1);
    Animated.sequence([
      Animated.timing(tapScale, {
        toValue: 0.92,
        duration: 55,
        easing: easing.easeOutQuad,
        useNativeDriver: true,
      }),
      Animated.timing(tapScale, {
        toValue: 1.04,
        duration: 70,
        easing: easing.easeOutQuad,
        useNativeDriver: true,
      }),
      Animated.timing(tapScale, {
        toValue: 1,
        duration: 60,
        easing: easing.easeOutQuad,
        useNativeDriver: true,
      }),
    ]).start();
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityState}
      testID={testID}
      onPressIn={animateTap}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
    >
      <Animated.View style={[styles.iconWrap, { opacity: iconOpacity, transform: [{ scale: iconScale }] }]}>
        {icon?.({
          color: focused ? activeColor : inactiveColor,
          size: icons.semantic.tab,
          focused,
        })}
      </Animated.View>
      <Animated.Text
        numberOfLines={1}
        style={[
          styles.label,
          {
            color: focused ? activeColor : inactiveColor,
            opacity: labelOpacity,
            fontFamily: focused ? typography.badge.fontFamily : typography.tab.fontFamily,
          },
        ]}
      >
        {label}
      </Animated.Text>
    </Pressable>
  );
}

export function BottomTabBar({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { hasGlassContent } = useTabBarGlass();
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const backgroundColor = colors.background;
  const borderColor = colors.border;
  const activeColor = isDark ? ACTIVE_DARK : ACTIVE_LIGHT;
  const inactiveColor = isDark ? INACTIVE_DARK : INACTIVE_LIGHT;

  const focusedRoute = state.routes[state.index];
  const focusedOptions = descriptors[focusedRoute.key].options;
  const isHidden = focusedOptions.tabBarStyle?.display === 'none';

  const paddingBottomVal = Math.max(insets.bottom, TAB_BAR_SAFE_BOTTOM);
  const totalHeight = computeTabBarHeight(insets.bottom);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isHidden ? 'transparent' : backgroundColor,
          borderTopColor: borderColor,
          borderTopWidth: isHidden ? 0 : StyleSheet.hairlineWidth,
          height: isHidden ? 0 : totalHeight,
          minHeight: 0,
          paddingTop: isHidden ? spacing[0] : spacing[4],
          paddingBottom: isHidden ? 0 : paddingBottomVal,
          opacity: isHidden ? 0 : 1,
          overflow: 'hidden',
        },
      ]}
    >
      {!isHidden && hasGlassContent && (
        <BlurView
          intensity={90}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
      )}
      {state.routes.map((route: any, index: number) => {
        const { options } = descriptors[route.key];
        if (route.name === 'share' || options.href === null) {
          return null;
        }
        const isFocused = state.index === index;
        const label =
          typeof options.title === 'string'
            ? options.title
            : typeof options.tabBarLabel === 'string'
              ? options.tabBarLabel
              : route.name;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        const onLongPress = () => {
          navigation.emit({
            type: 'tabLongPress',
            target: route.key,
          });
        };

        return (
          <TabBarItem
            key={route.key}
            focused={isFocused}
            label={label}
            icon={options.tabBarIcon as
              | ((props: { color: string; size: number; focused: boolean }) => React.ReactNode)
              | undefined}
            activeColor={activeColor}
            inactiveColor={inactiveColor}
            onPress={onPress}
            onLongPress={onLongPress}
            testID={options.tabBarTestID}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            accessibilityState={isFocused ? { selected: true } : {}}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: spacing[0],
    left: spacing[0],
    right: spacing[0],
    flexDirection: 'row',
    minHeight: TAB_BAR_CONTENT_HEIGHT,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 4,
  },
  item: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    paddingVertical: 3,
  },
  itemPressed: {
    opacity: 0.78,
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...typography.tab,
    letterSpacing: 0,
  },
});

export const customerTabBarIcons = {
  index: ({ color }: { color: string; focused: boolean }) => (
    <MaterialCommunityIcons name="map" size={icons.semantic.tab} color={color} />
  ),
  history: ({ color }: { color: string; focused: boolean }) => (
    <MaterialCommunityIcons name="receipt-text" size={icons.semantic.tab} color={color} />
  ),
  share: ({ color }: { color: string; focused: boolean }) => (
    Platform.OS === 'ios' ? (
      <SymbolView
        name="square.and.arrow.up.fill"
        size={icons.semantic.tab}
        tintColor={color}
      />
    ) : (
      <Ionicons name="share-social" size={icons.semantic.tab} color={color} />
    )
  ),
  profile: ({ color }: { color: string; focused: boolean }) => (
    <MaterialCommunityIcons name="account" size={icons.semantic.tab} color={color} />
  ),
};

export const driverTabBarIcons = {
  index: ({ color }: { color: string; focused: boolean }) => (
    <MaterialCommunityIcons name="car" size={icons.semantic.tab} color={color} />
  ),
  stats: ({ color }: { color: string; focused: boolean }) => (
    <MaterialCommunityIcons name="chart-box" size={icons.semantic.tab} color={color} />
  ),
  share: ({ color }: { color: string; focused: boolean }) => (
    Platform.OS === 'ios' ? (
      <SymbolView
        name="square.and.arrow.up.fill"
        size={icons.semantic.tab}
        tintColor={color}
      />
    ) : (
      <Ionicons name="share-social" size={icons.semantic.tab} color={color} />
    )
  ),
  profile: ({ color }: { color: string; focused: boolean }) => (
    <MaterialCommunityIcons name="account" size={icons.semantic.tab} color={color} />
  ),
};
