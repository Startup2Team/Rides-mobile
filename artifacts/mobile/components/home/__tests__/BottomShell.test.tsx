jest.mock('react-native', () => {
  const React = require('react');
  const host = (name: string) => React.forwardRef((props: object, ref: unknown) => React.createElement(name, { ...props, ref }));
  class Value {
    value: number;
    constructor(initialValue: number) {
      this.value = initialValue;
    }
    interpolate(options: { outputRange: Array<number> }) {
      return options.outputRange[0];
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
    PanResponder: { create: () => ({ panHandlers: {} }) },
    StyleSheet: { create: (styles: object) => styles, flatten: (style: object) => style, hairlineWidth: 1 },
    Text: host('Text'),
    View: host('View'),
  };
});

import { Animated, PanResponder, Text } from 'react-native';
import { render } from '@testing-library/react-native';
import type { RideLocation } from '@/types';
import { BottomShell, resolveBottomShellHeight, resolveBottomShellTranslateY } from '../BottomShell';
import {
  BOOKING_SHEET_MIN_HEIGHT,
  getBookingLayoutKey,
  getBookingSheetInstanceKey,
  getBookingSheetMaxHeight,
  resolveBookingSheetHeight,
} from '../bookingSheetLayout';

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

  test('renders the booking handle from the shell only while booking is active', () => {
    const { rerender, queryByTestId } = render(
      <BottomShell
        state="home"
        homeHeight={240}
        bookingHeight={320}
        colors={colors}
        homeContent={<Text>Home content</Text>}
        bookingContent={<Text>Booking content</Text>}
      />,
    );

    expect(queryByTestId('booking-shell-handle')).toBeNull();

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

    expect(queryByTestId('booking-shell-handle')).toBeTruthy();
  });

  test('booking sheet height stays content-driven and capped', () => {
    const maxHeight = getBookingSheetMaxHeight(1_000);

    expect(resolveBookingSheetHeight(180, undefined, maxHeight)).toBe(BOOKING_SHEET_MIN_HEIGHT);
    expect(resolveBookingSheetHeight(320, undefined, maxHeight)).toBe(320);
    expect(resolveBookingSheetHeight(2_000, undefined, maxHeight)).toBe(maxHeight);
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
});
