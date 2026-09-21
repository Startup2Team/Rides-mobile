import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { ConflictError } from '@/data/remote/contracts/backendErrors';
import type { IntercityBooking, IntercityTrip } from '@/domains/intercity';
import IntercityBookScreen from '../intercity-book';

const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockTripRefetch = jest.fn();

type MutateOptions = {
  onSuccess?: (data: unknown) => void;
  onError?: (error: unknown) => void;
  onSettled?: () => void;
};

let mockTripResult: {
  data: IntercityTrip | undefined;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
} = { data: undefined, isLoading: false, isError: false, error: null };

let mockHoldOutcome: { kind: 'success'; booking: IntercityBooking } | { kind: 'error'; error: unknown } = {
  kind: 'error',
  error: new Error('not configured'),
};
const mockHoldMutate = jest.fn((variables: unknown, options?: MutateOptions) => {
  if (mockHoldOutcome.kind === 'success') options?.onSuccess?.(mockHoldOutcome.booking);
  else options?.onError?.(mockHoldOutcome.error);
  options?.onSettled?.();
});
const mockConfirmMutate = jest.fn();
const mockReleaseMutate = jest.fn();

jest.mock('react-native', () => {
  const React = require('react');
  const host = (name: string) =>
    React.forwardRef((props: object, ref: unknown) => React.createElement(name, { ...props, ref }));
  return {
    AppState: { addEventListener: () => ({ remove: () => undefined }) },
    Platform: { OS: 'android', select: (options: Record<string, unknown>) => options.android ?? options.default },
    StyleSheet: { create: (styles: object) => styles, flatten: (style: object) => style, hairlineWidth: 1 },
    Text: host('Text'),
    TouchableOpacity: host('TouchableOpacity'),
    useColorScheme: () => 'light',
    View: host('View'),
  };
});

jest.mock('expo-router', () => ({
  router: { replace: (...args: unknown[]) => mockReplace(...args), back: () => mockBack() },
  useLocalSearchParams: () => ({ tripId: 'trip-1', seats: '2' }),
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

jest.mock('@/components/GlassScrollView', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    GlassScrollView: ({ children }: { children?: React.ReactNode }) =>
      React.createElement(View, null, children),
  };
});

jest.mock('@/hooks/useIsOffline', () => ({ useIsOffline: () => false }));

jest.mock('@/domains/intercity', () => ({
  ...jest.requireActual('@/domains/intercity/seats'),
  ...jest.requireActual('@/domains/intercity/errors'),
  useIntercityTripQuery: () => ({ ...mockTripResult, refetch: mockTripRefetch }),
  useHoldSeatsMutation: () => ({ mutate: mockHoldMutate, isPending: false }),
  useConfirmBookingMutation: () => ({ mutate: mockConfirmMutate, isPending: false }),
  useCancelIntercityBookingMutation: () => ({ mutate: mockReleaseMutate, isPending: false }),
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
    pricePerSeatRwf: 4500,
    status: 'OPEN',
    driverName: null,
    driverPhone: null,
    cancelReason: null,
    ...overrides,
  };
}

function heldBooking(expiresInMs = 5 * 60 * 1000): IntercityBooking {
  return {
    id: 'booking-1',
    tripId: 'trip-1',
    seats: 2,
    status: 'HELD',
    pricePerSeatRwf: 4500,
    holdExpiresAt: new Date(Date.now() + expiresInMs).toISOString(),
    boardedAt: null,
    cancelledAt: null,
    createdAt: new Date().toISOString(),
    trip: null,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockTripResult = { data: trip(), isLoading: false, isError: false, error: null };
  mockHoldOutcome = { kind: 'success', booking: heldBooking() };
});

describe('IntercityBookScreen', () => {
  test('shows the trip, the seat selection and the integer RWF total', () => {
    render(<IntercityBookScreen />);
    expect(screen.getByText('06:30')).toBeTruthy();
    expect(screen.getByText('Volcano Express')).toBeTruthy();
    // 2 seats x 4,500 RWF.
    expect(screen.getByText('9,000 RWF')).toBeTruthy();
    expect(screen.getByText('Cash on board')).toBeTruthy();
  });

  test('holding seats sends a stable idempotency key and then asks for confirmation', () => {
    render(<IntercityBookScreen />);
    fireEvent.press(screen.getByLabelText(/^Hold 2 seats for five minutes$/i));

    expect(mockHoldMutate).toHaveBeenCalledTimes(1);
    const [variables] = mockHoldMutate.mock.calls[0] as [{ tripId: string; seats: number; idempotencyKey: string }];
    expect(variables).toMatchObject({ tripId: 'trip-1', seats: 2 });
    expect(typeof variables.idempotencyKey).toBe('string');
    expect(screen.getByText(/^Seats held · /)).toBeTruthy();
    expect(screen.getByLabelText(/^Confirm booking for 2 seats$/i)).toBeTruthy();
  });

  test('409 SEATS_UNAVAILABLE is a recoverable message, not a crash, and refreshes the trip', () => {
    mockHoldOutcome = {
      kind: 'error',
      error: new ConflictError({ status: 409, cause: { error: { code: 'SEATS_UNAVAILABLE' } } }),
    };
    render(<IntercityBookScreen />);
    mockTripRefetch.mockClear();

    fireEvent.press(screen.getByLabelText(/^Hold 2 seats for five minutes$/i));

    expect(screen.getByText(/those seats were just taken/i)).toBeTruthy();
    expect(mockTripRefetch).toHaveBeenCalled();
    // The passenger is NOT left holding a phantom booking.
    expect(screen.queryByLabelText(/^Confirm booking/i)).toBeNull();
  });

  test('an already-expired hold renders the expired state rather than a live timer', () => {
    mockHoldOutcome = { kind: 'success', booking: heldBooking(-1000) };
    render(<IntercityBookScreen />);
    fireEvent.press(screen.getByLabelText(/^Hold 2 seats for five minutes$/i));

    expect(screen.getByText('Hold expired')).toBeTruthy();
    expect(screen.queryByLabelText(/^Confirm booking/i)).toBeNull();
  });

  test('releasing a hold tells the SERVER, it does not just forget it locally', () => {
    render(<IntercityBookScreen />);
    fireEvent.press(screen.getByLabelText(/^Hold 2 seats for five minutes$/i));
    fireEvent.press(screen.getByLabelText(/release the held seats/i));

    expect(mockReleaseMutate).toHaveBeenCalledWith(
      { bookingId: 'booking-1', tripId: 'trip-1' },
      expect.anything(),
    );
  });

  test('a sold-out trip offers a way back instead of a dead hold button', () => {
    mockTripResult = { ...mockTripResult, data: trip({ remainingSeats: 0 }) };
    render(<IntercityBookScreen />);
    // Both the seat badge and the state card say it — the point is that the
    // screen stops offering a hold and offers a way out instead.
    expect(screen.getAllByText('Sold out').length).toBeGreaterThan(0);
    expect(screen.getByText('Back to trips')).toBeTruthy();
    expect(screen.queryByLabelText(/^Hold .* for five minutes$/i)).toBeNull();
  });

  test('a 4-seat cab caps the stepper at half the vehicle', () => {
    mockTripResult = { ...mockTripResult, data: trip({ totalSeats: 4, remainingSeats: 4 }) };
    render(<IntercityBookScreen />);
    const stepper = screen.getByLabelText('Seats');
    expect(stepper.props.accessibilityValue).toMatchObject({ max: 2 });
  });
});
