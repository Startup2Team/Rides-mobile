import { Platform } from 'react-native';

export const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 62 : 56;
export const TAB_BAR_CONTENT_HEIGHT = TAB_BAR_HEIGHT;
export const TAB_BAR_BOTTOM_GAP = 12;
export const TAB_BAR_SAFE_BOTTOM = 6;
export const TAB_SCREEN_BOTTOM_PADDING = TAB_BAR_HEIGHT + TAB_BAR_BOTTOM_GAP;
export const FORM_BOTTOM_PADDING = 20;
export const FLOATING_ACTION_BOTTOM_OFFSET = 16;

export const TAB_BAR_SCREEN_BOTTOM_PADDING = TAB_SCREEN_BOTTOM_PADDING;

// Internal BottomTabBar layout constants — must stay in sync with
// BottomTabBar.tsx's StyleSheet.create({ container, item }).
const TAB_BAR_CONTAINER_PADDING_TOP = 4;
// icon(24) + gap(2) + label(lineHeight 12) + paddingVertical(3+3) = 44
const TAB_BAR_ITEM_HEIGHT = 44;

/**
 * The actual rendered height of the bottom tab bar including the home-indicator
 * safe-area padding. Use this as the `bottom` offset for overlay sheets so
 * their bottom edge aligns with the tab-bar top exactly.
 *
 * The formula mirrors BottomTabBar's StyleSheet:
 *   max(paddingTop + itemHeight + max(insetBottom, TAB_BAR_SAFE_BOTTOM), TAB_BAR_CONTENT_HEIGHT)
 *
 * Verified values:
 *   - Old iPhone (insets.bottom = 0): max(4 + 44 + 6,  62) = 62
 *   - iPhone X+  (insets.bottom = 34): max(4 + 44 + 34, 62) = 82
 *   - Android    (insets.bottom = 0):  max(4 + 44 + 6,  56) = 56
 *
 * The previous formula (TAB_BAR_CONTENT_HEIGHT + max(insets.bottom, TAB_BAR_SAFE_BOTTOM))
 * overcounted by up to 14 px on notched iPhones, producing a visible grey gap.
 */
export function computeTabBarHeight(insetBottom: number): number {
  return Math.max(
    TAB_BAR_CONTAINER_PADDING_TOP + TAB_BAR_ITEM_HEIGHT + Math.max(insetBottom, TAB_BAR_SAFE_BOTTOM),
    TAB_BAR_CONTENT_HEIGHT,
  );
}

export function getTabBarAttachOffset(bottomInset: number) {
  return TAB_BAR_HEIGHT + Math.max(bottomInset, TAB_BAR_SAFE_BOTTOM);
}

export function getTabBarScreenBottomPadding() {
  return TAB_BAR_SCREEN_BOTTOM_PADDING;
}

export function getTabScreenBottomPadding() {
  return TAB_SCREEN_BOTTOM_PADDING;
}
