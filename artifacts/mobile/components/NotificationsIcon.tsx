import React from "react";
import { Image, ImageStyle } from "react-native";
import { useColors } from "@/hooks/useColors";

interface NotificationsIconProps {
  size?: number;
  color?: any;
  style?: ImageStyle;
}

export function NotificationsIcon({
  size = 22,
  color,
  style,
}: NotificationsIconProps) {
  const colors = useColors();
  return (
    <Image
      source={require("@/assets/icons/notifications.png")}
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
