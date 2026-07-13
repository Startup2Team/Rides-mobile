import React from "react";
import { Image, ImageStyle } from "react-native";
import { useColors } from "@/hooks/useColors";

interface PrivacySecurityIconProps {
  size?: number;
  color?: any;
  style?: ImageStyle;
}

export function PrivacySecurityIcon({
  size = 22,
  color,
  style,
}: PrivacySecurityIconProps) {
  const colors = useColors();
  return (
    <Image
      source={require("@/assets/icons/privacy-security.png")}
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
