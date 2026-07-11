import React from "react";
import { Image, ImageStyle } from "react-native";
import { useColors } from "@/hooks/useColors";

interface SwitchModeIconProps {
  size?: number;
  color?: any;
  style?: ImageStyle;
}

export function SwitchModeIcon({
  size = 22,
  color,
  style,
}: SwitchModeIconProps) {
  const colors = useColors();
  return (
    <Image
      source={require("@/assets/icons/switch-mode.png")}
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
