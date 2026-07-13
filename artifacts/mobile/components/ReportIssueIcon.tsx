import React from "react";
import { Image, ImageStyle } from "react-native";
import { useColors } from "@/hooks/useColors";

interface ReportIssueIconProps {
  size?: number;
  color?: any;
  style?: ImageStyle;
}

export function ReportIssueIcon({
  size = 22,
  color,
  style,
}: ReportIssueIconProps) {
  const colors = useColors();
  return (
    <Image
      source={require("@/assets/icons/report-issue.png")}
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
