import React from "react";
import { Image, StyleSheet, View } from "react-native";
import { getCustomerRideBadge } from "@/domain/customerRideBadge";
import { useCustomerLevelQuery } from "@/query/hooks/useCustomerLevelQuery";

const BADGE_IMAGES = {
  BRONZE: require("../../assets/images/bronze-badge.png"),
  PINK: require("../../assets/images/pink-badge.png"),
  GREEN: require("../../assets/images/green-badge.png"),
  GOLD: require("../../assets/images/gold-badge.png"),
} as const;

export function CustomerRideBadge() {
  const { data } = useCustomerLevelQuery();
  const completedRides = data?.completedRides ?? 0;
  const badge = getCustomerRideBadge(completedRides);

  if (!badge) return null;

  return (
    <View
      style={styles.container}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${badge.label} customer badge, earned with ${completedRides} completed rides`}
      testID={`customer-${badge.tier.toLowerCase()}-badge`}
    >
      <Image
        source={BADGE_IMAGES[badge.tier]}
        style={styles.image}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  image: {
    width: 24,
    height: 24,
    transform: [{ scale: 1.35 }],
  },
});
