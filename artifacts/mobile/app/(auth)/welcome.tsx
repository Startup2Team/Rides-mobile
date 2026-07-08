import { router } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Image, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppButton } from '@/components/AppButton';
import { AppText } from '@/components/AppText';
import { useColors } from '@/hooks/useColors';

const { width } = Dimensions.get('window');
const ONBOARDING_IMAGE = require('../../assets/images/onboarding12.png');

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 700, delay: 200, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Animated.View
        style={[
          styles.content,
          { opacity: fadeAnim, paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 0) },
        ]}
      >
        <Image source={ONBOARDING_IMAGE} style={styles.illustration} resizeMode="contain" />

        <Animated.View style={[styles.copy, { transform: [{ translateY: slideAnim }] }]}>
          <AppText variant="h1" style={[styles.title, { color: colors.foreground }]}>Book Your Ride Easily</AppText>
          <AppText variant="title" style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Book motos, cabs, and trucks, negotiate your fare, and track every
            trip from your phone.
          </AppText>
        </Animated.View>

      </Animated.View>

      <Animated.View
        style={[
          styles.bottom,
          {
            opacity: fadeAnim,
            paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 20),
          },
        ]}
      >
        <AppButton
          title="Register"
          onPress={() => router.push('/(auth)/register')}
          fullWidth
          size="lg"
        />
        <View style={styles.row}>
          <AppText variant="bodySmall" style={[styles.hint, { color: colors.mutedForeground }]}>Already have an account? </AppText>
          <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
            <AppText variant="bodySmall" style={[styles.hint, { color: colors.primary }]}>Log in</AppText>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 26,
    paddingBottom: 58,
    gap: 28,
  },
  illustration: {
    width: Math.min(width * 0.82, 360),
    height: Math.min(width * 0.82, 360),
  },
  copy: {
    alignItems: 'center',
    gap: 14,
  },
  title: {
    textAlign: 'center',
    letterSpacing: 0,
  },
  subtitle: {
    lineHeight: 25,
    textAlign: 'center',
    maxWidth: 330,
  },
  bottom: {
    paddingHorizontal: 25,
    gap: 14,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  hint: {},
});
