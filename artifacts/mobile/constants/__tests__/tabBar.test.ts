jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

import {
  FLOATING_ACTION_BOTTOM_OFFSET,
  FORM_BOTTOM_PADDING,
  TAB_BAR_BOTTOM_GAP,
  TAB_BAR_HEIGHT,
  TAB_BAR_SAFE_BOTTOM,
  TAB_SCREEN_BOTTOM_PADDING,
  getTabBarAttachOffset,
} from '@/constants/tabBar';

describe('tab bar spacing constants', () => {
  test('keeps tab screen padding tied to the shared tab bar height', () => {
    expect(TAB_SCREEN_BOTTOM_PADDING).toBe(TAB_BAR_HEIGHT + TAB_BAR_BOTTOM_GAP);
  });

  test('keeps form spacing compact and distinct from tab screen spacing', () => {
    expect(FORM_BOTTOM_PADDING).toBeLessThan(TAB_SCREEN_BOTTOM_PADDING);
    expect(FLOATING_ACTION_BOTTOM_OFFSET).toBeGreaterThan(0);
  });

  test('anchors attached sheets to the tab bar height plus safe bottom', () => {
    expect(getTabBarAttachOffset(0)).toBe(TAB_BAR_HEIGHT + TAB_BAR_SAFE_BOTTOM);
    expect(getTabBarAttachOffset(24)).toBe(TAB_BAR_HEIGHT + 24);
  });
});
