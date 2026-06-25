import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  useColorScheme,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { BlurView } from 'expo-blur';
import { TAB_BAR_CONTENT_HEIGHT, TAB_BAR_SAFE_BOTTOM, computeTabBarHeight } from '@/constants/tabBar';

const ACTIVE_LIGHT = '#007AFF';
const ACTIVE_DARK = '#0A84FF';
const INACTIVE = '#000000';
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
      duration: 180,
      easing: Easing.out(Easing.quad),
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
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(tapScale, {
        toValue: 1.04,
        duration: 70,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(tapScale, {
        toValue: 1,
        duration: 60,
        easing: Easing.out(Easing.quad),
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
          size: 24,
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
            fontWeight: focused ? '700' : '500',
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
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const backgroundColor = isDark ? 'rgba(28, 28, 30, 0.45)' : 'rgba(255, 255, 255, 0.45)';
  const borderColor = isDark ? DARK_BORDER : LIGHT_BORDER;
  const activeColor = isDark ? ACTIVE_DARK : ACTIVE_LIGHT;
  const inactiveColor = isDark ? '#FFFFFF' : INACTIVE;

  const focusedRoute = state.routes[state.index];
  const focusedOptions = descriptors[focusedRoute.key].options;
  const isHidden = focusedOptions.tabBarStyle?.display === 'none';

  const paddingBottomVal = Math.max(insets.bottom, TAB_BAR_SAFE_BOTTOM);
  const totalHeight = computeTabBarHeight(insets.bottom);

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
          paddingTop: isHidden ? 0 : 4,
          paddingBottom: isHidden ? 0 : paddingBottomVal,
          opacity: isHidden ? 0 : 1,
          overflow: 'hidden',
        },
      ]}
    >
      {!isHidden && (
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
    bottom: 0,
    left: 0,
    right: 0,
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
    gap: 2,
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
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 0,
  },
});

export const customerTabBarIcons = {
  index: ({ color }: { color: string; focused: boolean }) => (
    <MaterialCommunityIcons name="map" size={24} color={color} />
  ),
  history: ({ color }: { color: string; focused: boolean }) => (
    <MaterialCommunityIcons name="receipt-text" size={24} color={color} />
  ),
  share: ({ color }: { color: string; focused: boolean }) => (
    Platform.OS === 'ios' ? (
      <SymbolView
        name="square.and.arrow.up.fill"
        size={24}
        tintColor={color}
      />
    ) : (
      <Ionicons name="share-social" size={24} color={color} />
    )
  ),
  profile: ({ color }: { color: string; focused: boolean }) => (
    <MaterialCommunityIcons name="account" size={24} color={color} />
  ),
};

export const driverTabBarIcons = {
  index: ({ color }: { color: string; focused: boolean }) => (
    <MaterialCommunityIcons name="car" size={24} color={color} />
  ),
  stats: ({ color }: { color: string; focused: boolean }) => (
    <MaterialCommunityIcons name="chart-box" size={24} color={color} />
  ),
  share: ({ color }: { color: string; focused: boolean }) => (
    Platform.OS === 'ios' ? (
      <SymbolView
        name="square.and.arrow.up.fill"
        size={24}
        tintColor={color}
      />
    ) : (
      <Ionicons name="share-social" size={24} color={color} />
    )
  ),
  profile: ({ color }: { color: string; focused: boolean }) => (
    <MaterialCommunityIcons name="account" size={24} color={color} />
  ),
};
