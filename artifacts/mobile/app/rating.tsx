import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import * as StoreReview from 'expo-store-review';
import React, { useMemo, useRef, useState } from 'react';
import {
  Image,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { KandaButton } from '@/components/KandaButton';
import { useColors } from '@/hooks/useColors';
import { useRide } from '@/context/RideContext';

const QUICK_TAGS = [
  { id: 'safe', label: 'Safe driver' },
  { id: 'clean', label: 'Clean vehicle' },
  { id: 'friendly', label: 'Friendly' },
  { id: 'ontime', label: 'On time' },
  { id: 'nav', label: 'Knew the way' },
  { id: 'quiet', label: 'Quiet ride' },
];

export default function RatingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { currentRide, rideHistory, completeRide } = useRide();
  const params = useLocalSearchParams<{ rideId?: string; driverName?: string; fare?: string; vehicleType?: string }>();

  const [step, setStep] = useState<'rating' | 'feedback'>('rating');
  const [stars, setStars] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [review, setReview] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const driverName = params.driverName ?? 'Your Driver';
  const finalizedRideRef = useRef(false);

  const ratedRide = useMemo(() => {
    if (currentRide && (!params.rideId || currentRide.id === params.rideId)) {
      return currentRide;
    }
    if (params.rideId) {
      return rideHistory.find(ride => ride.id === params.rideId) ?? currentRide;
    }
    return currentRide;
  }, [currentRide, params.rideId, rideHistory]);

  const driverPhotoUri = useMemo(() => {
    const driver = ratedRide?.driver;
    if (!driver) return undefined;
    return driver.profileImage ?? `https://i.pravatar.cc/160?u=${encodeURIComponent(driver.id)}`;
  }, [ratedRide?.driver]);

  const finalizeRide = () => {
    if (finalizedRideRef.current || !currentRide) return;
    finalizedRideRef.current = true;
    completeRide();
  };

  const toggleTag = (id: string) => {
    Haptics.selectionAsync();
    setSelectedTags(prev =>
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id],
    );
  };

  const handleStarPress = (n: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStars(n);
  };

  const handleContinue = () => {
    if (stars === 0) return;
    setStep('feedback');
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await new Promise(r => setTimeout(r, 600));

    // Trigger in-app review after 3+ completed rides
    if (rideHistory.length >= 3) {
      const isAvailable = await StoreReview.isAvailableAsync();
      if (isAvailable) StoreReview.requestReview();
    }

    finalizeRide();
    router.replace('/(tabs)');
  };

  const handleSkip = () => {
    finalizeRide();
    router.replace('/(tabs)');
  };

  const initials = driverName
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <TouchableOpacity
        style={[
          styles.skipBtn,
          { top: insets.top + (Platform.OS === 'web' ? 67 : 0) + 16 },
        ]}
        onPress={handleSkip}
        activeOpacity={0.7}
      >
        <Text style={[styles.skipText, { color: colors.mutedForeground }]}>Skip</Text>
      </TouchableOpacity>

      <View style={styles.centerContent}>
        <View style={[styles.completeBadge, { backgroundColor: colors.successHex + '18' }]}>
          <Feather name="check-circle" size={20} color={colors.success} />
          <Text style={[styles.completeBadgeText, { color: colors.success }]}>Ride Completed</Text>
        </View>

        {/* Driver avatar */}
        <View style={styles.avatarSection}>
          {driverPhotoUri ? (
            <Image
              source={{ uri: driverPhotoUri }}
              style={styles.driverAvatarImage}
              accessibilityLabel={`${driverName} profile photo`}
            />
          ) : (
            <View style={[styles.driverAvatar, { backgroundColor: colors.primary }]}>
              <Text style={[styles.driverInitials, { color: colors.primaryForeground }]}>{initials}</Text>
            </View>
          )}
          <Text style={[styles.driverName, { color: colors.foreground }]}>{driverName}</Text>
          <Text style={[styles.prompt, { color: colors.mutedForeground }]}>
            {step === 'rating' ? 'How was your ride?' : 'Add a few details'}
          </Text>
        </View>

        {/* Stars */}
        <View style={styles.starsRow}>
          {[1, 2, 3, 4, 5].map(n => (
            <TouchableOpacity
              key={n}
              onPress={() => handleStarPress(n)}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
            >
              <Text style={[styles.star, { color: n <= stars ? colors.star : colors.starMuted }]}>★</Text>
            </TouchableOpacity>
          ))}
        </View>

        {step === 'feedback' && stars >= 4 && (
          <>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>What went well?</Text>
            <View style={styles.tagsWrap}>
              {QUICK_TAGS.map(tag => {
                const active = selectedTags.includes(tag.id);
                return (
                  <TouchableOpacity
                    key={tag.id}
                    onPress={() => toggleTag(tag.id)}
                    activeOpacity={0.75}
                    style={[
                      styles.tag,
                      {
                        backgroundColor: active ? colors.primaryHex + '18' : colors.muted,
                        borderColor: active ? colors.primary : colors.border,
                        borderWidth: active ? 1.5 : 1,
                      },
                    ]}
                  >
                    <Text style={[styles.tagLabel, { color: active ? colors.primary : colors.foreground }]}>
                      {tag.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {step === 'feedback' && (
          <>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Write a review</Text>
            <TextInput
              value={review}
              onChangeText={setReview}
              placeholder="Tell us about your ride"
              placeholderTextColor={colors.mutedForeground}
              multiline
              maxLength={300}
              textAlignVertical="top"
              style={[
                styles.reviewInput,
                {
                  backgroundColor: colors.muted,
                  borderColor: colors.border,
                  color: colors.foreground,
                },
              ]}
            />
          </>
        )}

      </View>

      <View style={[styles.bottomActions, { paddingBottom: insets.bottom + 20 }]}>
        {step === 'rating' ? (
          <KandaButton
            title="Continue"
            onPress={handleContinue}
            disabled={stars === 0}
            fullWidth
            size="lg"
            style={styles.submitBtn}
          />
        ) : (
          <KandaButton
          title={submitting ? 'Submitting…' : 'Submit Rating'}
          onPress={handleSubmit}
          loading={submitting}
          fullWidth
          size="lg"
          style={styles.submitBtn}
        />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 92,
  },
  bottomActions: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
    paddingTop: 14,
  },
  skipBtn: {
    position: 'absolute',
    right: 24,
    zIndex: 2,
    paddingVertical: 4,
    paddingLeft: 12,
  },
  skipText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  completeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    marginBottom: 28,
  },
  completeBadgeText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  avatarSection: { alignItems: 'center', gap: 8, marginBottom: 28 },
  driverAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  driverAvatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 4,
  },
  driverInitials: { fontSize: 28, fontFamily: 'Inter_700Bold' },
  driverName: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  prompt: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  starsRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 32 },
  star: { fontSize: 42 },
  sectionLabel: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    marginBottom: 12,
    textAlign: 'left',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', gap: 8, marginBottom: 24 },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  tagLabel: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  reviewInput: {
    minHeight: 116,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    lineHeight: 20,
    marginBottom: 8,
  },
  submitBtn: { marginTop: 8 },
});
