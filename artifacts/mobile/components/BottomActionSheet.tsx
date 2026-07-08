/**
 * BottomActionSheet — shared chrome for app-level action sheets.
 *
 * Provides a consistent layout contract:
 *   - Centered handle pill (full-width slot, outside content padding)
 *   - Title row — symmetric 22px padding left and right (no close X)
 *   - Optional subtitle + hint subheader
 *   - Content area with standard horizontal padding
 *
 * Animation, surface style, and gesture handlers stay with the caller's
 * Animated.View so each sheet keeps its own animation system unchanged.
 *
 * Dismiss: swipe-down gesture + backdrop tap. No close button.
 *
 * Usage:
 *   <Animated.View style={[surfaceStyle, { transform: [{translateY}] }]} {...panHandlers}>
 *     <BottomActionSheet title="..." colors={colors}>
 *       {children}
 *     </BottomActionSheet>
 *   </Animated.View>
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { radius } from '@/constants/radius';
import { sizes } from '@/constants/sizes';
import { spacing, semanticSpacing } from '@/constants/spacing';
import { typography } from '@/constants/typography';
import type { useColors } from '@/hooks/useColors';

export const SHEET_PADDING_H = 22;
export const SHEET_HANDLE_HEIGHT = sizes.sheet.handleHeight;
export const SHEET_HANDLE_WIDTH = sizes.sheet.handleWidth;
export const SHEET_HANDLE_AREA_PADDING_TOP = spacing[8];

type Props = {
  colors: ReturnType<typeof useColors>;
  title: string;
  subtitle?: string;
  hint?: string;
  /**
   * Spread on the header View when the sheet's gesture lives only on the
   * header zone (EditSavedLocationSheet pattern). Omit when the gesture
   * is on the outer Animated.View (SaveLocationSheet pattern).
   */
  headerPanHandlers?: object;
  children: React.ReactNode;
  /** Override horizontal padding on the content slot (default SHEET_PADDING_H). */
  contentPaddingH?: number;
  /**
   * When true the root View and content slot both use flex: 1 so the
   * keyboard-expanded search mode can fill the constrained sheet height.
   * Only set when the parent Animated.View has an explicit height.
   */
  flex?: boolean;
};

export function BottomActionSheet({
  colors,
  title,
  subtitle,
  hint,
  headerPanHandlers,
  children,
  contentPaddingH = SHEET_PADDING_H,
  flex = false,
}: Props) {
  return (
    <View style={flex ? sheetStyles.rootFlex : undefined}>
      {/* Header chrome — optionally owns a pan zone for keyboard handling */}
      <View {...headerPanHandlers}>
        {/* Handle pill — full-width container ensures true centering
            regardless of content padding. */}
        <View style={sheetStyles.handleArea}>
          <View style={sheetStyles.handle} />
        </View>

        {/* Title row — symmetric horizontal padding (no close button slot). */}
        <View style={sheetStyles.titleRow}>
          <AppText
            variant="title"
            style={[sheetStyles.title, { color: colors.foreground }]}
            numberOfLines={1}
          >
            {title}
          </AppText>
        </View>

        {/* Optional subheader */}
        {(subtitle !== undefined || hint !== undefined) ? (
          <View style={sheetStyles.subheader}>
            {subtitle !== undefined ? (
              <AppText
                variant="label"
                style={[sheetStyles.subtitle, { color: colors.mutedForeground }]}
                numberOfLines={2}
              >
                {subtitle}
              </AppText>
            ) : null}
            {hint !== undefined ? (
              <AppText variant="label" style={[sheetStyles.hint, { color: colors.mutedForeground }]}>
                {hint}
              </AppText>
            ) : null}
          </View>
        ) : null}
      </View>

      {/* Content slot */}
      <View
        style={[
          { paddingHorizontal: contentPaddingH },
          flex ? sheetStyles.contentFlex : undefined,
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const sheetStyles = StyleSheet.create({
  rootFlex: {
    flex: 1,
  },
  contentFlex: {
    flex: 1,
    minHeight: 0,
  },
  handleArea: {
    alignItems: 'center',
    paddingTop: SHEET_HANDLE_AREA_PADDING_TOP,
    paddingBottom: spacing[0],
  },
  handle: {
    width: SHEET_HANDLE_WIDTH,
    height: SHEET_HANDLE_HEIGHT,
    borderRadius: radius.xxs,
    backgroundColor: '#3A3A3A',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    // Symmetric padding — no right-side close button to offset for.
    paddingLeft: SHEET_PADDING_H,
    paddingRight: SHEET_PADDING_H,
    paddingTop: spacing[10],
    paddingBottom: semanticSpacing.compactGap,
    minHeight: sizes.iconButton.md,
  },
  title: {
    flex: 1,
    ...typography.title,
  },
  subheader: {
    paddingLeft: SHEET_PADDING_H,
    paddingRight: SHEET_PADDING_H,
    paddingBottom: spacing[10],
    gap: spacing[4],
  },
  subtitle: {
    ...typography.label,
    fontFamily: typography.bodySmall.fontFamily,
  },
  hint: {
    ...typography.label,
  },
});
