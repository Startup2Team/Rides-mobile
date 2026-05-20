import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Image, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KandaButton } from '@/components/KandaButton';

const { width, height } = Dimensions.get('window');

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 700, delay: 200, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0A0A0A', '#0D2010', '#0A0A0A']}
        style={StyleSheet.absoluteFill}
      />

      {/* Background glow */}
      <View style={styles.glowCircle} />

      <Animated.View
        style={[
          styles.content,
          { opacity: fadeAnim, paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 0) },
        ]}
      >
        {/* Logo */}
        <View style={styles.logoArea}>
          <View style={styles.logoRing}>
            <View style={styles.logoDot} />
            <Text style={styles.logoK}>K</Text>
          </View>
          <Text style={styles.appName}>KandaRide</Text>
          <Text style={styles.tagline}>Rwanda's fastest ride</Text>
        </View>

        {/* Features */}
        <Animated.View style={{ transform: [{ translateY: slideAnim }] }}>
          <View style={styles.features}>
            {FEATURES.map((f, i) => (
              <View key={i} style={styles.featureRow}>
                <View style={styles.featureDot} />
                <Text style={styles.featureText}>{f}</Text>
              </View>
            ))}
          </View>
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
        <KandaButton
          title="Get Started"
          onPress={() => router.push('/(auth)/register')}
          fullWidth
          size="lg"
        />
        <KandaButton
          title="I already have an account"
          onPress={() => router.push('/(auth)/login')}
          variant="ghost"
          fullWidth
          size="md"
        />
      </Animated.View>
    </View>
  );
}

const FEATURES = [
  'Book motos, cabs, and trucks',
  'Negotiate fares in real-time',
  'Live GPS tracking',
  'Safe & verified drivers',
];

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0A' },
  glowCircle: {
    position: 'absolute',
    width: width * 1.2,
    height: width * 1.2,
    borderRadius: width * 0.6,
    backgroundColor: '#00C853',
    opacity: 0.05,
    top: -width * 0.3,
    left: -width * 0.1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 48,
  },
  logoArea: { alignItems: 'center', gap: 16 },
  logoRing: {
    width: 100,
    height: 100,
    borderRadius: 30,
    backgroundColor: '#00C853',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00C853',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 16,
  },
  logoDot: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#000',
    top: 12,
    right: 14,
  },
  logoK: {
    fontSize: 52,
    fontFamily: 'Inter_700Bold',
    color: '#000',
    lineHeight: 60,
  },
  appName: {
    fontSize: 36,
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    color: '#9E9E9E',
  },
  features: { gap: 14, width: '100%' },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00C853',
  },
  featureText: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: '#CCCCCC',
  },
  bottom: {
    paddingHorizontal: 24,
    gap: 8,
  },
});
