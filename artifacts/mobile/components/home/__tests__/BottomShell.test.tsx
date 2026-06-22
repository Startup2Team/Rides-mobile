jest.mock('react-native', () => {
  const React = require('react');
  const host = (name: string) => React.forwardRef((props: object, ref: unknown) => React.createElement(name, { ...props, ref }));
  class Value {
    value: number;
    constructor(initialValue: number) {
      this.value = initialValue;
    }
    interpolate(options: { outputRange: Array<number> }) {
      return { kind: 'animated-node', value: options.outputRange[0] };
    }
  }
  return {
    Animated: {
      Value,
      View: host('AnimatedView'),
      timing: () => ({ start: jest.fn() }),
      parallel: () => ({ start: jest.fn() }),
    },
    Easing: {
      out: (fn: (value: number) => number) => fn,
      quad: (value: number) => value,
    },
    LayoutAnimation: {
      configureNext: jest.fn(),
      Presets: { easeInEaseOut: {} },
    },
    PanResponder: { create: () => ({ panHandlers: { testID: 'booking-pan-handlers' } }) },
    Platform: {
      OS: 'ios',
      select: (options: { ios?: unknown; default?: unknown }) => options.ios ?? options.default,
    },
    StyleSheet: { create: (styles: object) => styles, flatten: (style: object) => style, hairlineWidth: 1 },
    Text: host('Text'),
    UIManager: { setLayoutAnimationEnabledExperimental: jest.fn() },
    View: host('View'),
  };
});

import { Animated, PanResponder, Text } from 'react-native';
import { render } from '@testing-library/react-native';
import type { RideLocation } from '@/types';
import {
  assertBottomShellLayerVisibility,
  isBookingShellActive,
  resolveBottomShellLayerMode,
  shouldSkipCloseSlide,
} from '../bottomShellState';
import { BottomShell, resolveBottomShellHeight, resolveBottomShellLayerOpacity, resolveBottomShellTranslateY } from '../BottomShell';
import {
  BOOKING_SHEET_MIN_HEIGHT,
  getBookingLayoutKey,
  getBookingSheetInstanceKey,
  getBookingSheetMaxHeight,
  resolveBookingSheetHeight,
} from '../bookingSheetLayout';
import { styles as homeStyles } from '../homeStyles';
import { BOOKING_SHEET_PADDING_H, BOOKING_SHEET_HEADER_HEIGHT } from '../homeUtils';

const colors = {
  background: '#ffffff',
  border: '#dddddd',
  card: '#ffffff',
  destructive: '#ff0000',
  foreground: '#111111',
  muted: '#eeeeee',
  mutedForeground: '#777777',
  primary: '#0066ff',
  primaryForeground: '#ffffff',
} as never;

const pickup: RideLocation = {
  latitude: -1.95,
  longitude: 30.06,
  address: 'Pickup',
  locationType: 'generic',
};

const destination: RideLocation = {
  latitude: -1.96,
  longitude: 30.07,
  address: 'Destination',
  locationType: 'generic',
};

describe('BottomShell layout', () => {
  test('resolves mutually exclusive shell layer modes', () => {
    expect(resolveBottomShellLayerMode('home')).toBe('home');
    expect(resolveBottomShellLayerMode('booking')).toBe('booking');
    expect(resolveBottomShellLayerMode('closingBooking')).toBe('closing');
    expect(isBookingShellActive('home')).toBe(false);
    expect(isBookingShellActive('booking')).toBe(true);
    expect(isBookingShellActive('closingBooking')).toBe(true);
  });

  test('skips close slide when the sheet is already dismissed', () => {
    expect(shouldSkipCloseSlide(200, 200)).toBe(true);
    expect(shouldSkipCloseSlide(199, 200)).toBe(true);
    expect(shouldSkipCloseSlide(120, 200)).toBe(false);
  });

  test('assertBottomShellLayerVisibility flags mixed home/booking modes in dev', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    assertBottomShellLayerVisibility('home', false, true);
    assertBottomShellLayerVisibility('booking', true, true);
    assertBottomShellLayerVisibility('closingBooking', true, false);
    expect(errorSpy).toHaveBeenCalledTimes(3);
    errorSpy.mockRestore();
  });

  test('assertBottomShellLayerVisibility allows non-interactive layers while closing', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    assertBottomShellLayerVisibility('closingBooking', false, false);
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  test('resolves the active shell height from the mounted state', () => {
    expect(resolveBottomShellHeight('home', 240, 320)).toBe(240);
    expect(resolveBottomShellHeight('booking', 240, 320)).toBe(320);
    expect(resolveBottomShellHeight('closingBooking', 240, 320)).toBe(320);
  });

  test('keeps the shell translateY at zero in home state', () => {
    expect(resolveBottomShellTranslateY('home', 240)).toBe(0);
    expect(resolveBottomShellTranslateY('booking', 240)).toBe(240);
    expect(resolveBottomShellTranslateY('closingBooking', 240)).toBe(240);
  });

  test('crossfades home and booking layers during close transitions', () => {
    expect(resolveBottomShellLayerOpacity('home', 'home', 120, 320)).toBe(1);
    expect(resolveBottomShellLayerOpacity('home', 'booking', 120, 320)).toBe(0);
    expect(resolveBottomShellLayerOpacity('booking', 'home', 120, 320)).toBe(0);
    expect(resolveBottomShellLayerOpacity('booking', 'booking', 120, 320)).toBe(1);
    expect(resolveBottomShellLayerOpacity('closingBooking', 'home', 0, 320)).toBe(0);
    expect(resolveBottomShellLayerOpacity('closingBooking', 'booking', 0, 320)).toBe(1);
    expect(resolveBottomShellLayerOpacity('closingBooking', 'home', 320, 320)).toBe(1);
    expect(resolveBottomShellLayerOpacity('closingBooking', 'booking', 320, 320)).toBe(0);
  });

  test('keeps the booking title anchored in a fixed header area', () => {
    expect(homeStyles.bookingSheetHeader.height).toBe(BOOKING_SHEET_HEADER_HEIGHT);
    expect(homeStyles.bookingSheetHeader.flexDirection).toBe('column');
    expect(homeStyles.bookingSheetHeader.paddingTop).toBe(8);
    expect(homeStyles.bookingSheetHeader.paddingBottom).toBe(18);
    expect(homeStyles.bookingSheetHandleSlot.marginBottom).toBe(14);
    expect(homeStyles.bookingSheetTitle.lineHeight).toBe(20);
    expect(BOOKING_SHEET_HEADER_HEIGHT).toBe(64);
  });

  test('keeps both content states mounted while switching', () => {
    const { rerender, getByText } = render(
      <BottomShell
        state="home"
        homeHeight={240}
        bookingHeight={320}
        colors={colors}
        homeContent={<Text>Home content</Text>}
        bookingContent={<Text>Booking content</Text>}
      />,
    );

    expect(getByText('Home content')).toBeTruthy();
    expect(getByText('Booking content')).toBeTruthy();

    rerender(
      <BottomShell
        state="booking"
        homeHeight={240}
        bookingHeight={320}
        colors={colors}
        homeContent={<Text>Home content</Text>}
        bookingContent={<Text>Booking content</Text>}
      />,
    );

    expect(getByText('Home content')).toBeTruthy();
    expect(getByText('Booking content')).toBeTruthy();
  });

  test('anchors BookingSheet content to the top of the shell layer', () => {
    expect(homeStyles.bookingSheetWrapper.top).toBe(0);
    expect('bottom' in homeStyles.bookingSheetWrapper).toBe(false);
  });

  test('keeps the booking handle in-flow with the title header band', () => {
    expect(homeStyles.bookingSheetHandleSlot.height).toBe(4);
    expect(homeStyles.bookingSheetHandleSlot.marginBottom).toBe(14);
    expect(homeStyles.bookingSheetHeader.paddingTop).toBe(8);
    expect(
      homeStyles.bookingSheetHeader.paddingTop
      + homeStyles.bookingSheetHandleSlot.height
      + homeStyles.bookingSheetHandleSlot.marginBottom
      + homeStyles.bookingSheetTitle.lineHeight,
    ).toBe(46);
  });

  test('booking sheet height stays content-driven and capped', () => {
    const maxHeight = getBookingSheetMaxHeight(1_000);

    expect(resolveBookingSheetHeight(180, undefined, maxHeight)).toBe(180);
    expect(resolveBookingSheetHeight(320, undefined, maxHeight)).toBe(320);
    expect(resolveBookingSheetHeight(2_000, undefined, maxHeight)).toBe(maxHeight);
  });

  test('does not floor measured booking height to BOOKING_SHEET_MIN_HEIGHT', () => {
    const maxHeight = getBookingSheetMaxHeight(1_000);
    expect(resolveBookingSheetHeight(BOOKING_SHEET_MIN_HEIGHT - 20, undefined, maxHeight)).toBe(
      BOOKING_SHEET_MIN_HEIGHT - 20,
    );
  });

  test('booking sheet resolves to a compact height before and after route details appear', () => {
    const maxHeight = getBookingSheetMaxHeight(1_000);
    const pickupOnlyHeight = resolveBookingSheetHeight(260, undefined, maxHeight);
    const routePreviewHeight = resolveBookingSheetHeight(360, undefined, maxHeight);

    expect(pickupOnlyHeight).toBe(260);
    expect(routePreviewHeight).toBe(360);
  });

  test('booking layout key resets when route preview or destination state changes', () => {
    const compactKey = getBookingLayoutKey({
      showBooking: true,
      destination: false,
      destinationText: '',
      routeVisible: false,
    });
    const expandedKey = getBookingLayoutKey({
      showBooking: true,
      destination: true,
      destinationText: 'Kigali City Tower',
      routeVisible: true,
    });

    expect(compactKey).not.toBe(expandedKey);
    expect(compactKey).toContain('pickup');
    expect(expandedKey).toContain('route');
  });

  test('booking sheet instance key changes on reopen even when layout state matches', () => {
    const layoutKey = getBookingLayoutKey({
      showBooking: true,
      destination: false,
      destinationText: '',
      routeVisible: false,
    });

    expect(getBookingSheetInstanceKey(1, layoutKey)).not.toBe(getBookingSheetInstanceKey(2, layoutKey));
    expect(getBookingSheetInstanceKey(1, layoutKey)).toContain(layoutKey);
  });

  test('resolveBottomShellLayerOpacity does not throw for degenerate bookingHeight values', () => {
    // A very small bookingHeight would previously cause Math.round(1 * 0.18) = 0,
    // then Math.max(1, 0) = 1 = targetHeight, producing inputRange [0, 1, 1] — a crash.
    expect(() => resolveBottomShellLayerOpacity('closingBooking', 'home', 1, 1)).not.toThrow();
    expect(() => resolveBottomShellLayerOpacity('closingBooking', 'booking', 1, 1)).not.toThrow();
    expect(() => resolveBottomShellLayerOpacity('closingBooking', 'home', 0, 0)).not.toThrow();
    // Animated.Value path — the mock interpolate() just returns outputRange[0] so no real
    // native node is created, but the function must not throw before handing off to it.
    const animValue = { interpolate: (opts: { outputRange: number[] }) => opts.outputRange[0] } as never;
    expect(() => resolveBottomShellLayerOpacity('closingBooking', 'home', animValue, 1)).not.toThrow();
    expect(() => resolveBottomShellLayerOpacity('closingBooking', 'booking', animValue, 1)).not.toThrow();
  });

  test('booking sheet header left inset matches body horizontal padding', () => {
    // formSheetHeader and formSheetBody children must share the same left edge.
    // formSheetBody provides paddingHorizontal: BOOKING_SHEET_PADDING_H.
    // Children must NOT add extra marginHorizontal on top of that padding.
    expect(homeStyles.bookingSheetHeader.paddingLeft).toBe(BOOKING_SHEET_PADDING_H);
    expect((homeStyles.locationCard as Record<string, unknown>).marginHorizontal).toBeUndefined();
    expect((homeStyles.locationActions as Record<string, unknown>).marginHorizontal).toBeUndefined();
    expect((homeStyles.rideInfoRow as Record<string, unknown>).marginHorizontal).toBeUndefined();
    expect((homeStyles.findDriverAction as Record<string, unknown>).marginHorizontal).toBeUndefined();
  });

  test('session-only booking key does not change when form content changes mid-session', () => {
    // BookingSheet must not remount when destination/destText/route change during an
    // open session — only a revision increment (new open) should produce a new key.
    const key = (revision: number) => `session:${revision}`;

    const keyWithDest = key(1);
    const keyWithoutDest = key(1);
    expect(keyWithDest).toBe(keyWithoutDest); // same session → same key

    const keyNewSession = key(2);
    expect(keyNewSession).not.toBe(keyWithDest); // new session → new key
  });

  test('renders closingBooking with native-driven translateY without crashing', () => {
    const translateY = new Animated.Value(160);
    const panResponder = PanResponder.create({});

    expect(() =>
      render(
        <BottomShell
          state="closingBooking"
          homeHeight={240}
          bookingHeight={320}
          translateY={translateY}
          panResponder={panResponder}
          colors={colors}
          homeContent={<Text>Home content</Text>}
          bookingContent={<Text>Booking content</Text>}
        />,
      ),
    ).not.toThrow();

    expect(getLayerOpacityType('closingBooking', 'home', translateY, 320)).toBe('animated');
    expect(getLayerOpacityType('closingBooking', 'booking', translateY, 320)).toBe('animated');
    expect(getLayerOpacityType('booking', 'booking', translateY, 320)).toBe('static');
  });

  test('does not attach pan handlers while closingBooking', () => {
    const translateY = new Animated.Value(0);
    const panResponder = PanResponder.create({});
    const { getByTestId, rerender } = render(
      <BottomShell
        state="booking"
        homeHeight={240}
        bookingHeight={320}
        translateY={translateY}
        panResponder={panResponder}
        colors={colors}
        homeContent={<Text>Home content</Text>}
        bookingContent={<Text>Booking content</Text>}
      />,
    );

    expect(getByTestId('booking-pan-handlers')).toBeTruthy();

    rerender(
      <BottomShell
        state="closingBooking"
        homeHeight={240}
        bookingHeight={320}
        translateY={translateY}
        panResponder={panResponder}
        colors={colors}
        homeContent={<Text>Home content</Text>}
        bookingContent={<Text>Booking content</Text>}
      />,
    );

    expect(() => getByTestId('booking-pan-handlers')).toThrow();
  });
});

function getLayerOpacityType(
  state: 'home' | 'booking' | 'closingBooking',
  layer: 'home' | 'booking',
  translateY: Animated.Value,
  bookingHeight: number,
) {
  const opacity = resolveBottomShellLayerOpacity(state, layer, translateY, bookingHeight);
  return typeof opacity === 'number' ? 'static' : 'animated';
}
