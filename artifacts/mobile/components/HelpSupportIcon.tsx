import React from "react";
import { Image, ImageStyle } from "react-native";
import { useColors } from "@/hooks/useColors";

interface HelpSupportIconProps {
  size?: number;
  color?: any;
  style?: ImageStyle;
}

export function HelpSupportIcon({
  size = 22,
  color,
  style,
}: HelpSupportIconProps) {
  const colors = useColors();
  return (
    <Image
      source={require("@/assets/icons/help-support.png")}
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
