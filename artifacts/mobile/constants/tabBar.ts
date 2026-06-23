import { Platform } from 'react-native';

export const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 62 : 56;
export const TAB_BAR_CONTENT_HEIGHT = TAB_BAR_HEIGHT;
export const TAB_BAR_BOTTOM_GAP = 12;
export const TAB_BAR_SAFE_BOTTOM = 6;
export const TAB_SCREEN_BOTTOM_PADDING = TAB_BAR_HEIGHT + TAB_BAR_BOTTOM_GAP;
export const FORM_BOTTOM_PADDING = 20;
export const FLOATING_ACTION_BOTTOM_OFFSET = 16;

export const TAB_BAR_SCREEN_BOTTOM_PADDING = TAB_SCREEN_BOTTOM_PADDING;

export function getTabBarAttachOffset(bottomInset: number) {
  return TAB_BAR_HEIGHT + Math.max(bottomInset, TAB_BAR_SAFE_BOTTOM);
}

export function getTabBarScreenBottomPadding() {
  return TAB_BAR_SCREEN_BOTTOM_PADDING;
}

export function getTabScreenBottomPadding() {
  return TAB_SCREEN_BOTTOM_PADDING;
}
