import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { STORAGE_KEYS } from '@/constants/storage';

export type ProfileAvatarCircleProps = {
  size?: number;
  initial: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

export function ProfileAvatarCircle({
  size = 44,
  initial,
  onPress,
  style,
  accessibilityLabel = 'Profile',
}: ProfileAvatarCircleProps) {
  const isDark = useColorScheme() === 'dark';
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const radius = size / 2;

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void AsyncStorage.getItem(STORAGE_KEYS.profileImage).then(uri => {
        if (active) setProfileImage(uri);
      });
      return () => {
        active = false;
      };
    }, []),
  );

  const content = (
    <View
      style={[
        styles.shadowWrap,
        {
          width: size,
          height: size,
          borderRadius: radius,
          shadowOpacity: isDark ? 0.28 : 0.16,
        },
        style,
      ]}
    >
      <View style={[styles.circle, { width: size, height: size, borderRadius: radius }]}>
        {profileImage ? (
          <Image
            key={profileImage}
            source={{ uri: profileImage }}
            style={{ width: size, height: size }}
          />
        ) : (
          <LinearGradient
            colors={['#9DBBE0', '#7984C3']}
            style={[styles.fallback, { width: size, height: size, borderRadius: radius }]}
          >
            <Text style={[styles.initial, { fontSize: size * 0.4 }]}>{initial}</Text>
          </LinearGradient>
        )}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => pressed && styles.pressed}
      >
        {content}
      </Pressable>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  shadowWrap: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 4,
    ...Platform.select({
      ios: { borderCurve: 'continuous' },
      default: {},
    }),
  },
  circle: {
    overflow: 'hidden',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    fontFamily: 'Inter_600SemiBold',
    color: '#FFFFFF',
  },
  pressed: {
    opacity: 0.88,
  },
});
