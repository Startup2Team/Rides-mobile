import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import PaymentMethodsScreen from '../payment-methods';

const mockListPaymentMethods = jest.fn();
const mockGetDefaultPaymentMethod = jest.fn();
const mockGetBillingProfile = jest.fn();
const mockAddPaymentMethod = jest.fn();
const mockDeletePaymentMethod = jest.fn();
const mockSetDefaultPaymentMethod = jest.fn();

jest.mock('react-native', () => {
  const React = require('react');
  const host = (name: string) => React.forwardRef((props: object, ref: unknown) => React.createElement(name, { ...props, ref }));
  return {
    Alert: { alert: jest.fn() },
    KeyboardAvoidingView: host('KeyboardAvoidingView'),
    Platform: { OS: 'android', select: (options: Record<string, unknown>) => options.android ?? options.default },
    ScrollView: host('ScrollView'),
    StyleSheet: {
      create: (styles: object) => styles,
      flatten: (style: object) => style,
      hairlineWidth: 1,
    },
    Text: host('Text'),
    TextInput: host('TextInput'),
    TouchableOpacity: host('TouchableOpacity'),
    View: host('View'),
  };
});

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(),
}));

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  const Icon = ({ name }: { name: string }) => <Text>{name}</Text>;
  return { Feather: Icon };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('@/components/GlassHeader', () => ({
  GlassHeader: ({ title, subtitle }: { title: string; subtitle?: string }) => {
    const React = require('react');
    const { Text, View } = require('react-native');
    return <View><Text>{title}</Text>{subtitle ? <Text>{subtitle}</Text> : null}</View>;
  },
  useGlassHeaderMetrics: () => ({ contentTop: 0, indicatorTop: 0 }),
}));

jest.mock('@/components/GlassScrollView', () => ({
  GlassScrollView: require('react').forwardRef(({ children }: { children?: React.ReactNode }, ref: React.Ref<unknown>) => {
    const React = require('react');
    const { View } = require('react-native');
    React.useImperativeHandle(ref, () => ({ scrollToEnd: jest.fn() }));
    return <View>{children}</View>;
  }),
}));

jest.mock('@/components/AppButton', () => ({
  AppButton: ({ title }: { title: string }) => {
    const React = require('react');
    const { Text } = require('react-native');
    return <Text>{title}</Text>;
  },
}));

jest.mock('@/context/ToastContext', () => ({
  useToast: () => ({ showToast: jest.fn() }),
}));

jest.mock('@/hooks/useColors', () => ({
  useColors: () => ({
    background: '#fff',
    border: '#ddd',
    card: '#fff',
    destructive: '#dc2626',
    foreground: '#111',
    muted: '#f3f4f6',
    mutedForeground: '#666',
    primary: '#2563eb',
  }),
}));

jest.mock('@/domains/payments', () => ({
  paymentsRepository: {
    listPaymentMethods: (...args: unknown[]) => mockListPaymentMethods(...args),
    getDefaultPaymentMethod: (...args: unknown[]) => mockGetDefaultPaymentMethod(...args),
    getBillingProfile: (...args: unknown[]) => mockGetBillingProfile(...args),
    addPaymentMethod: (...args: unknown[]) => mockAddPaymentMethod(...args),
    updatePaymentMethod: jest.fn(),
    deletePaymentMethod: (...args: unknown[]) => mockDeletePaymentMethod(...args),
    setDefaultPaymentMethod: (...args: unknown[]) => mockSetDefaultPaymentMethod(...args),
  },
}));

function renderWithQueryClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={client}>
      {ui}
    </QueryClientProvider>,
  );
}

describe('PaymentMethodsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListPaymentMethods.mockResolvedValue([
      { id: 'cash_default', provider: 'cash', label: 'Pay with Cash', isDefault: true },
      { id: 'mtn_1', provider: 'mtn', label: 'MTN Mobile Money', phoneNumber: '788000000', isDefault: false },
    ]);
  });

  test('renders existing payment methods from the query-backed repository path', async () => {
    renderWithQueryClient(<PaymentMethodsScreen />);

    expect(screen.getByText('Payment Methods')).toBeTruthy();
    await waitFor(() => expect(screen.getByText('Pay with Cash')).toBeTruthy());
    expect(screen.getByText('MTN Mobile Money')).toBeTruthy();
    await waitFor(() => expect(screen.getByText('+250788000000')).toBeTruthy());
    expect(mockListPaymentMethods).toHaveBeenCalledTimes(1);
  });
});
