import React from "react";
import { Image, ImageStyle } from "react-native";
import { useColors } from "@/hooks/useColors";

interface AlertsIconProps {
  size?: number;
  color?: any;
  style?: ImageStyle;
}

export function AlertsIcon({ size = 22, color, style }: AlertsIconProps) {
  const colors = useColors();
  return (
    <Image
      source={require("@/assets/icons/alerts.png")}
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
