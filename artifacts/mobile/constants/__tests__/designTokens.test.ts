jest.mock('react-native', () => ({
  Easing: {
    cubic: (value: number) => value,
    in: (fn: (value: number) => number) => fn,
    out: (fn: (value: number) => number) => fn,
    quad: (value: number) => value,
  },
  Platform: {
    OS: 'ios',
    select: (values: { ios?: object; default?: object }) => values.ios ?? values.default,
  },
  StyleSheet: {
    hairlineWidth: 1,
  },
}));

import { elevation } from '@/constants/elevation';
import { icons, iconSize, semanticIconSize } from '@/constants/icons';
import { duration, easing, motion, spring } from '@/constants/motion';
import { radius } from '@/constants/radius';
import { sizes } from '@/constants/sizes';
import { spacing, semanticSpacing } from '@/constants/spacing';
import {
  CONTENT_CARD_RADIUS,
  FLOATING_PANEL_TOP_RADIUS,
  floatingPanelSurface,
} from '@/constants/surfaces';
import {
  BUTTON_HEIGHT,
  BUTTON_RADIUS,
} from '@/constants/buttons';
import { zIndex } from '@/constants/zIndex';

describe('design tokens', () => {
  test('defines the spacing scale and semantic aliases', () => {
    expect(spacing[0]).toBe(0);
    expect(spacing[16]).toBe(16);
    expect(spacing[64]).toBe(64);
    expect(semanticSpacing.screenPadding).toBe(spacing[20]);
    expect(semanticSpacing.cardPadding).toBe(spacing[16]);
    expect(semanticSpacing.compactGap).toBe(spacing[6]);
  });

  test('defines common radius tokens', () => {
    expect(radius.none).toBe(0);
    expect(radius.xxs).toBe(2);
    expect(radius.xl).toBe(14);
    expect(radius.sheet).toBe(24);
    expect(radius.pill).toBe(999);
    expect(radius.full).toBe(999);
    expect(radius.card).toBe(14);
    expect(radius.input).toBe(12);
  });

  test('defines elevation presets', () => {
    expect(elevation.none.elevation).toBe(0);
    expect(elevation.sheet).toMatchObject({
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.14,
      shadowRadius: 24,
      elevation: 14,
    });
    expect(elevation.toast.elevation).toBe(10);
    expect(elevation.mapControl.shadowRadius).toBe(6);
    expect(elevation.card.elevation).toBe(3);
  });

  test('defines motion tokens', () => {
    expect(duration.fast).toBe(120);
    expect(duration.normal).toBe(180);
    expect(duration.sheet).toBe(250);
    expect(duration.long).toBe(700);
    expect(easing.easeOutQuad).toEqual(expect.any(Function));
    expect(spring.gallery).toMatchObject({ damping: 20, stiffness: 220, useNativeDriver: true });
    expect(motion.duration.fast).toBe(duration.fast);
    expect(motion.easing.easeOutQuad).toBe(easing.easeOutQuad);
    expect(motion.spring.sheet).toBe(spring.sheet);
  });

  test('defines icon tokens', () => {
    expect(iconSize.xxs).toBe(12);
    expect(iconSize.md).toBe(18);
    expect(iconSize.hero).toBe(48);
    expect(semanticIconSize.tab).toBe(iconSize.xl);
    expect(semanticIconSize.row).toBe(iconSize.md);
    expect(icons.size.md).toBe(iconSize.md);
    expect(icons.semantic.button).toBe(semanticIconSize.button);
  });

  test('defines component size tokens and preserves existing constants', () => {
    expect(sizes.button).toMatchObject({ sm: 44, md: 50, lg: 50 });
    expect(sizes.input.lg).toBe(52);
    expect(sizes.sheetHandle).toMatchObject({ width: 40, height: 4 });
    expect(sizes.sheet).toMatchObject({ handleWidth: 40, handleHeight: 4 });
    expect(sizes.tabBar).toMatchObject({
      iosHeight: 62,
      androidHeight: 56,
      safeBottom: 6,
      itemHeight: 44,
    });
    expect(BUTTON_HEIGHT).toMatchObject({ sm: 44, md: 50, lg: 50 });
    expect(BUTTON_RADIUS).toBe(22);
  });

  test('defines z-index layers', () => {
    expect(zIndex.base).toBe(0);
    expect(zIndex.raised).toBe(1);
    expect(zIndex.header).toBe(10);
    expect(zIndex.sheet).toBe(30);
    expect(zIndex.searchOverlay).toBe(80);
    expect(zIndex.backdrop).toBe(85);
    expect(zIndex.modal).toBe(90);
    expect(zIndex.tooltip).toBe(100);
    expect(zIndex.mapPicker).toBe(120);
    expect(zIndex.toast).toBe(200);
  });

  test('preserves existing surface constants', () => {
    expect(FLOATING_PANEL_TOP_RADIUS).toBe(24);
    expect(CONTENT_CARD_RADIUS).toBe(14);
    expect(floatingPanelSurface).toMatchObject({
      borderRadius: 24,
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.14,
      shadowRadius: 24,
      elevation: 14,
    });
  });
});
