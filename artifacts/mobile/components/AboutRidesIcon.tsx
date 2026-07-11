import React from "react";
import { Image, ImageStyle } from "react-native";
import { useColors } from "@/hooks/useColors";

interface AboutRidesIconProps {
  size?: number;
  color?: any;
  style?: ImageStyle;
}

export function AboutRidesIcon({
  size = 22,
  color,
  style,
}: AboutRidesIconProps) {
  const colors = useColors();
  return (
    <Image
      source={require("@/assets/icons/about-rides.png")}
      style={[
        {
          width: size,
          height: size,
          resizeMode: "contain",
          tintColor: color ?? colors.primary,
        },
        style,
      ]}
    />
  );
}
