import React from "react";
import { Image, ImageStyle } from "react-native";
import { useColors } from "@/hooks/useColors";

interface EditProfileIconProps {
  size?: number;
  color?: any;
  style?: ImageStyle;
}

export function EditProfileIcon({
  size = 22,
  color,
  style,
}: EditProfileIconProps) {
  const colors = useColors();
  return (
    <Image
      source={require("@/assets/icons/edit-profile.png")}
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
