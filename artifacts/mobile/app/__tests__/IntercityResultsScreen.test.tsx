import { render, screen } from '@testing-library/react-native';
import React from 'react';
import type { IntercityTrip } from '@/domains/intercity';
import IntercityResultsScreen from '../intercity-results';

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockRefetch = jest.fn();

let mockTripsResult: {
  data: IntercityTrip[] | undefined;
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
  error: unknown;
} = { data: [], isLoading: false, isError: false, isFetching: false, error: null };
let mockOffline = false;

jest.mock('react-native', () => {
  const React = require('react');
  const host = (name: string) =>
    React.forwardRef((props: object, ref: unknown) => React.createElement(name, { ...props, ref }));
  const View = host('View');
  return {
    Platform: { OS: 'android', select: (options: Record<string, unknown>) => options.android ?? options.default },
    StyleSheet: { create: (styles: object) => styles, flatten: (style: object) => style, hairlineWidth: 1 },
    Text: host('Text'),
    TouchableOpacity: host('TouchableOpacity'),
    useColorScheme: () => 'light',
    View,
    // Minimal FlatList: enough to assert rows, the header and the empty state.
    FlatList: ({ data, keyExtractor, renderItem, ListEmptyComponent, ListHeaderComponent }: any) =>
      React.createElement(
        View,
        null,
        ListHeaderComponent ?? null,
        (data ?? []).length === 0
          ? ListEmptyComponent ?? null
          : (data ?? []).map((item: unknown, index: number) =>
              React.createElement(
                View,
                { key: keyExtractor ? keyExtractor(item, index) : index },
                renderItem({ item, index }),
              ),
            ),
      ),
  };
});

jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args), back: () => mockBack() },
  useLocalSearchParams: () => ({ corridor: 'KGL_MUS', date: '2026-09-22', seats: '2' }),
  useFocusEffect: (callback: () => void) => {
    const React = require('react');
    React.useEffect(() => {
      callback();
    }, [callback]);
  },
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const Icon = ({ name }: { name: string }) => React.createElement('Text', null, name);
  return { Feather: Icon };
});

jest.mock('@/components/GlassHeader', () => {
  const React = require('react');
  return {
    GlassHeader: ({ title }: { title: string }) => React.createElement('Text', null, title),
    useGlassHeaderMetrics: () => ({ contentTop: 0, indicatorTop: 0, headerInset: 0 }),
  };
});

jest.mock('@/hooks/useIsOffline', () => ({ useIsOffline: () => mockOffline }));

jest.mock('@/domains/intercity', () => ({
  ...jest.requireActual('@/domains/intercity/seats'),
  ...jest.requireActual('@/domains/intercity/errors'),
  useIntercityTripSearchQuery: () => ({ ...mockTripsResult, refetch: mockRefetch }),
}));

function trip(overrides: Partial<IntercityTrip> = {}): IntercityTrip {
  return {
    id: 'trip-1',
    corridor: 'KGL_MUS',
    originName: 'Kigali',
    destinationName: 'Musanze',
    operatorName: 'Volcano Express',
    vehicleLabel: 'Coaster',
    plateNumber: 'RAC 123 A',
    stagingAddress: 'Nyabugogo gate 3',
    stagingPoint: null,
    departAt: '2026-09-22T04:30:00.000Z',
    totalSeats: 18,
    remainingSeats: 5,
    // The SERVER's cap, verbatim — the stepper ceiling is not re-derived.
    maxSeatsPerBooking: 4,
    pricePerSeatRwf: 4500,
    status: 'OPEN',
    driverName: null,
    driverPhone: null,
    cancelReason: null,
    ...overrides,
  };
}

beforeEach(() => {
  mockPush.mockClear();
  mockBack.mockClear();
  mockRefetch.mockClear();
  mockOffline = false;
  mockTripsResult = { data: [], isLoading: false, isError: false, isFetching: false, error: null };
});

describe('IntercityResultsScreen', () => {
  test('remaining seats are the headline of every row', () => {
    mockTripsResult = { ...mockTripsResult, data: [trip()] };
    render(<IntercityResultsScreen />);

    expect(screen.getByText('5')).toBeTruthy();
    expect(screen.getByText('seats left')).toBeTruthy();
    expect(screen.getByText('Volcano Express')).toBeTruthy();
    // Kigali time, not the container UTC.
    expect(screen.getByText('06:30')).toBeTruthy();
    expect(screen.getByText('Nyabugogo gate 3')).toBeTruthy();
  });

  test('an 18-seat Coaster and a 4-seat cab render through the same row', () => {
    mockTripsResult = {
      ...mockTripsResult,
      data: [
        trip({ id: 'coaster', totalSeats: 18, remainingSeats: 11 }),
        trip({ id: 'cab', totalSeats: 4, remainingSeats: 1, operatorName: 'Jean Bosco' }),
      ],
    };
    render(<IntercityResultsScreen />);

    expect(screen.getByText('11')).toBeTruthy();
    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByText('seat left')).toBeTruthy();
  });

  test('a sold-out trip says so and is not tappable', () => {
    mockTripsResult = { ...mockTripsResult, data: [trip({ remainingSeats: 0 })] };
    render(<IntercityResultsScreen />);

    expect(screen.getByText('Sold out')).toBeTruthy();
    const row = screen.getByLabelText(/^Departs .*sold out$/i);
    expect(row.props.accessibilityState.disabled).toBe(true);
  });

  test('prices render as integer RWF per seat', () => {
    mockTripsResult = { ...mockTripsResult, data: [trip({ pricePerSeatRwf: 4500 })] };
    render(<IntercityResultsScreen />);
    expect(screen.getByText('4,500 RWF', { exact: false })).toBeTruthy();
  });

  test('an empty corridor/day is a designed state, not a blank list', () => {
    render(<IntercityResultsScreen />);
    expect(screen.getByText('No trips on this day')).toBeTruthy();
  });

  test('offline is a designed state that refuses to show stale seat counts', () => {
    mockOffline = true;
    mockTripsResult = { ...mockTripsResult, data: undefined, isError: true, error: new Error('offline') };
    render(<IntercityResultsScreen />);
    expect(screen.getByText('You are offline')).toBeTruthy();
  });

  test('a load failure offers a retry instead of an empty screen', () => {
    mockTripsResult = { ...mockTripsResult, data: undefined, isError: true, error: new Error('boom') };
    render(<IntercityResultsScreen />);
    expect(screen.getByText('Could not load trips')).toBeTruthy();
    expect(screen.getByText('Try again')).toBeTruthy();
  });

  test('the list refetches when the screen regains focus', () => {
    mockTripsResult = { ...mockTripsResult, data: [trip()] };
    render(<IntercityResultsScreen />);
    expect(mockRefetch).toHaveBeenCalled();
  });
});
