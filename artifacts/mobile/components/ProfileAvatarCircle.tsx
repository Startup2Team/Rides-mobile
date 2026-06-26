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
import { loadStoredProfileImage } from '@/persistence/profilePersistence';

export type ProfileAvatarCircleProps = {
  size?: number;
  initial: string;
  /** When set (including null), skips loading the signed-in user's profile photo from storage. */
  imageUri?: string | null;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

export function ProfileAvatarCircle({
  size = 44,
  initial,
  imageUri,
  onPress,
  style,
  accessibilityLabel = 'Profile',
}: ProfileAvatarCircleProps) {
  const isDark = useColorScheme() === 'dark';
  const [storedProfileImage, setStoredProfileImage] = useState<string | null>(null);
  const radius = size / 2;
  const useStoredProfile = imageUri === undefined;
  const displayUri = useStoredProfile ? storedProfileImage : imageUri;

  useFocusEffect(
    useCallback(() => {
      if (!useStoredProfile) return undefined;
      let active = true;
      void loadStoredProfileImage().then(stored => {
        if (active) setStoredProfileImage(stored.data);
      });
      return () => {
        active = false;
      };
    }, [useStoredProfile]),
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
        <LinearGradient
          colors={['#9DBBE0', '#7984C3']}
          style={[styles.fallback, { width: size, height: size, borderRadius: radius }]}
        >
          <Text style={[styles.initial, { fontSize: size * 0.4 }]}>{initial}</Text>
        </LinearGradient>
        {displayUri ? (
          <Image
            key={displayUri}
            source={{ uri: displayUri }}
            style={[StyleSheet.absoluteFill, { width: size, height: size }]}
          />
        ) : null}
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
