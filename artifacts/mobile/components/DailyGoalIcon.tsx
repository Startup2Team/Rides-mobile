import React from "react";
import { Image, ImageStyle } from "react-native";
import { useColors } from "@/hooks/useColors";

interface DailyGoalIconProps {
  size?: number;
  color?: any;
  style?: ImageStyle;
}

export function DailyGoalIcon({ size = 22, color, style }: DailyGoalIconProps) {
  const colors = useColors();
  return (
    <Image
      source={require("@/assets/icons/daily-goal.png")}
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
