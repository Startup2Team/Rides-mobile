import { router } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { BackButton } from '@/components/BackButton';
import { AppButton } from '@/components/AppButton';
import { useColors } from '@/hooks/useColors';

/**
 * Entry point from the Home header driver recruitment CTA.
 * Full onboarding lives in driver-onboarding.
 */
export default function JoinDriverScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 0) + 8 },
        ]}
      >
        <BackButton onPress={() => router.back()} />
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Drive with Rides</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.content}>
        <View style={[styles.heroIcon, { backgroundColor: colors.primary + '18' }]}>
          <Feather name="navigation" size={32} color={colors.primary} />
        </View>
        <Text style={[styles.title, { color: colors.foreground }]}>
          Earn on your schedule
        </Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Complete driver verification to accept ride requests in Kigali. You will need your
          vehicle details and ID documents.
        </Text>
        <AppButton
          title="Continue to driver signup"
          fullWidth
          size="lg"
          onPress={() => router.push('/driver-onboarding')}
          accessibilityLabel="Continue to driver signup"
        />
        <AppButton
          title="Not now"
          variant="plain"
          fullWidth
          size="md"
          onPress={() => router.back()}
          accessibilityLabel="Go back"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontFamily: 'Inter_600SemiBold',
  },
  headerSpacer: {
    width: 44,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    gap: 16,
    alignItems: 'stretch',
  },
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 8,
  },
});
