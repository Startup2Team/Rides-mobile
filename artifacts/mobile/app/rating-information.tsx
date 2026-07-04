import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo } from 'react';
import {
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { fonts } from '@/constants/fonts';
import { radius } from '@/constants/radius';
import { spacing } from '@/constants/spacing';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';
import type { AppMode } from '@/types';

type RatingEducationMode = AppMode;

const RATING_IMAGES = {
  rating: require('../assets/images/rating.png'),
  onTheRoute: require('../assets/images/on the route.png'),
  readyToMove: require('../assets/images/ready to move.png'),
  traffic: require('../assets/images/traffic.png'),
} as const;

type RatingEducationSection = {
  image?: number;
  heading: string;
  body: string;
  extraBody?: string;
};

type RatingEducationCopy = {
  modeLabel: string;
  intro: string;
  sections: RatingEducationSection[];
};

const RATING_COPY: Record<RatingEducationMode, RatingEducationCopy> = {
  customer: {
    modeLabel: 'Customer mode',
    intro: 'Ratings allow us to ensure a great experience with Rides for both riders and drivers. Just like you rate drivers, drivers can rate riders on a scale of 1-5 stars after each trip.',
    sections: [
      {
        image: RATING_IMAGES.rating,
        heading: 'How your rating is calculated',
        body: 'Your rating is an average of the ratings you’ve received from drivers, and is measured out of 5 stars. Ratings are anonymous, so neither you nor your driver will ever see an individual rating you’ve received.',
        extraBody: 'Very few people have a perfect rating, so don’t despair if your average isn’t 5.0. Small things matter to your driver - like buckling your seatbelt in a cab, Hilux, or Fuso truck, or wearing your helmet properly and holding on safely on a moto or Rifani ride. Knowing what affects driver satisfaction helps you stay a 5-star rider.',
      },
      {
        image: RATING_IMAGES.readyToMove,
        heading: 'Short wait times.',
        body: 'Drivers love when riders are ready to go when they arrive. That includes confirming your pickup spot, especially for quick moto boardings where delays block traffic.',
      },
      {
        image: RATING_IMAGES.onTheRoute,
        heading: 'Courtesy.',
        body: 'It is important to treat drivers and their vehicles (whether a moto, cab, Hilux, or Fuso truck) with respect. A positive attitude and mindful use of the vehicle go a long way. That slice of pizza can wait.',
      },
      {
        image: RATING_IMAGES.traffic,
        heading: 'Safety.',
        body: 'Drivers want to make sure everyone is safe and no laws are broken. For cab, Hilux, or Fuso trips, every rider must use a seatbelt. For moto or Rifani trips, always wear your helmet securely. Never ask drivers to speed or overload.',
      },
      {
        heading: 'Why your rating matters',
        body: 'Ratings foster mutual respect between riders and drivers across all ride types, whether you\'re on a moto or in a cab. This strengthens our community and helps everyone get the most from Rides. Just as you expect drivers to treat you with respect, drivers hope to feel the same acknowledgement from riders. A high rating is a sign that people enjoyed their time with you.',
      },
    ],
  },
  driver: {
    modeLabel: 'Driver mode',
    intro: 'Ratings allow us to ensure a great experience with Rides for both riders and drivers. Just like you rate riders, riders can rate drivers on a scale of 1-5 stars after each trip.',
    sections: [
      {
        image: RATING_IMAGES.rating,
        heading: 'How your rating is calculated',
        body: 'Your rating is an average of the ratings you’ve received from riders, and is measured out of 5 stars. Ratings are anonymous, so neither you nor your rider will ever see an individual rating you’ve received.',
        extraBody: 'Very few people have a perfect rating, so don’t despair if your average isn’t 5.0. Things that seem small make a big difference - like driving smoothly, keeping your vehicle clean (and providing clean helmets for moto trips), and communicating politely. Knowing what riders value helps you maintain a 5-star rating.',
      },
      {
        image: RATING_IMAGES.readyToMove,
        heading: 'Navigation and wait times.',
        body: 'Riders appreciate when you arrive at the correct pickup location promptly and follow the navigation route accurately, especially for fast moto maneuvers. If you\'re delayed, letting them know via message goes a long way.',
      },
      {
        image: RATING_IMAGES.onTheRoute,
        heading: 'Courtesy.',
        body: 'Treating riders with respect, greeting them politely, and keeping your vehicle (whether a cab, moto, Hilux, or truck) clean and comfortable ensures a positive experience. A friendly attitude makes every trip more pleasant.',
      },
      {
        image: RATING_IMAGES.traffic,
        heading: 'Safety.',
        body: 'Always follow traffic rules, wear your seatbelt (or helmet on a moto), and ensure your riders are safely buckled up or wearing their helmets. Avoid distracted driving or speeding. Safety is our number one priority on every trip.',
      },
      {
        heading: 'Why your rating matters',
        body: 'Ratings foster mutual respect between riders and drivers. This strengthens our community and helps everyone get the most from Rides. High-rated drivers build trust and gain access to more opportunities. Keep up the good work!',
      },
    ],
  },
};

function normalizeMode(mode: string | string[] | undefined, fallback: RatingEducationMode): RatingEducationMode {
  const value = Array.isArray(mode) ? mode[0] : mode;
  return value === 'driver' ? 'driver' : fallback;
}

export default function RatingInformationScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ mode?: string | string[] }>();

  const mode = useMemo(
    () => normalizeMode(params.mode, user?.mode ?? 'customer'),
    [params.mode, user?.mode],
  );
  const copy = RATING_COPY[mode];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Floating Close Button */}
      <TouchableOpacity
        style={[
          styles.closeButton,
          {
            top: insets.top + spacing[12],
            backgroundColor: colors.card,
          },
        ]}
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Feather name="x" size={24} color={colors.foreground} />
      </TouchableOpacity>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: insets.top + spacing[64],
            paddingBottom: insets.bottom + spacing[32],
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <AppText
          style={[styles.title, { color: colors.foreground }]}
          adjustsFontSizeToFit
          numberOfLines={1}
        >
          Understanding your rating
        </AppText>

        <AppText style={[styles.introText, { color: colors.mutedForeground }]}>
          {copy.intro}
        </AppText>

        {copy.sections.map((section, idx) => (
          <View key={idx} style={styles.sectionContainer}>
            {section.image && (
              <Image
                source={section.image}
                style={styles.illustration}
                resizeMode="contain"
              />
            )}
            <AppText style={[styles.sectionHeading, { color: colors.foreground }]}>
              {section.heading}
            </AppText>
            <AppText style={[styles.bodyText, { color: colors.mutedForeground }]}>
              {section.body}
            </AppText>
            {section.extraBody && (
              <AppText style={[styles.bodyText, { color: colors.mutedForeground }]}>
                {section.extraBody}
              </AppText>
            )}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  closeButton: {
    position: 'absolute',
    left: spacing[16],
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  scroll: {
    paddingHorizontal: spacing[20],
  },

  title: {
    fontFamily: fonts.bold,
    fontSize: 28,
    lineHeight: 34,
    marginBottom: spacing[16],
  },
  introText: {
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 24,
    marginBottom: spacing[24],
  },
  sectionContainer: {
    marginBottom: spacing[24],
  },
  illustration: {
    width: '100%',
    height: 165,
    alignSelf: 'center',
    marginBottom: spacing[16],
  },
  sectionHeading: {
    fontFamily: fonts.semibold,
    fontSize: 18,
    lineHeight: 24,
    marginBottom: spacing[8],
  },
  bodyText: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: spacing[12],
  },
});

