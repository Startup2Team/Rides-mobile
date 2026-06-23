import { render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import DriverSubmissionConfirmation from '../driver-submission-confirmation';

const mockSaveDriverProfile = jest.fn(() => Promise.resolve());
const mockSwitchMode = jest.fn(() => Promise.resolve());
const mockVerificationStore = {
  driverApplications: [
    {
      id: 'driver-submission:rejected',
      clientSubmissionId: 'driver-submission:rejected',
      kind: 'driver_application',
      status: 'rejected',
      reviewStatus: 'rejected',
      submittedAt: '2026-06-20T08:00:00.000Z',
      updatedAt: '2026-06-20T09:00:00.000Z',
      reviewDecision: {
        status: 'rejected',
        reviewedAt: '2026-06-20T09:00:00.000Z',
        reviewedBy: 'agent-7',
        reason: 'Vehicle outside photo is missing.',
        rejectedFields: ['brand'],
        rejectedDocuments: ['vehicleOutsidePhoto'],
      },
      history: [
        {
          id: 'driver-submission:rejected:rejected',
          type: 'rejected',
          at: '2026-06-20T09:00:00.000Z',
          reason: 'Vehicle outside photo is missing.',
          rejectedFields: ['brand'],
          rejectedDocuments: ['vehicleOutsidePhoto'],
          reviewedBy: 'agent-7',
        },
      ],
      userId: 'user-1',
    },
  ],
  vehicleApplications: [],
  vehicleDocumentUpdates: [],
};

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
  },
}));

jest.mock('react-native', () => {
  const React = require('react');
  const host = (name: string) => React.forwardRef((props: object, ref: unknown) => React.createElement(name, { ...props, ref }));
  return {
    Animated: {
      Value: class Value {
        constructor(_value: number) {}
      },
      View: host('AnimatedView'),
      parallel: () => ({ start: jest.fn() }),
      sequence: () => ({ start: jest.fn() }),
      spring: () => ({ start: jest.fn() }),
      timing: () => ({ start: jest.fn() }),
    },
    Platform: { OS: 'android', select: (options: Record<string, unknown>) => options.android ?? options.default },
    StyleSheet: {
      create: (styles: object) => styles,
      flatten: (style: unknown) => style,
    },
    Text: host('Text'),
    TouchableOpacity: host('TouchableOpacity'),
    useColorScheme: () => 'light',
    View: host('View'),
  };
});

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    driverProfile: {
      verificationStatus: 'rejected',
      rejectionReason: 'Vehicle outside photo is missing.',
    },
    saveDriverProfile: mockSaveDriverProfile,
    switchMode: mockSwitchMode,
    user: { id: 'user-1' },
  }),
}));

jest.mock('@/hooks/useColors', () => ({
  useColors: () => ({
    background: '#fff',
    foreground: '#111',
    mutedForeground: '#666',
    border: '#ddd',
    primary: '#2563eb',
    primaryHex: '#2563eb',
    primaryForeground: '#fff',
    destructive: '#dc2626',
    destructiveHex: '#dc2626',
    destructiveForeground: '#fff',
    muted: '#f4f4f5',
    card: '#fff',
    successHex: '#16a34a',
    warningHex: '#d97706',
    call: '#16a34a',
  }),
}));

jest.mock('@expo/vector-icons', () => ({
  Feather: () => null,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: { Light: 'light' },
  impactAsync: jest.fn(),
}));

jest.mock('@/components/AppButton', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    AppButton: ({ title }: { title: string }) => <Text>{title}</Text>,
  };
});

jest.mock('@/persistence/verificationSubmissionPersistence', () => ({
  EMPTY_VERIFICATION_SUBMISSION_STORE: {
    driverApplications: [],
    vehicleApplications: [],
    vehicleDocumentUpdates: [],
  },
  loadStoredVerificationSubmissions: jest.fn(async () => ({ data: mockVerificationStore, source: 'current' })),
  saveStoredVerificationSubmissions: jest.fn(async () => undefined),
}));

describe('DriverSubmissionConfirmation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('shows rejected application details and update action', async () => {
    render(<DriverSubmissionConfirmation />);

    await waitFor(() => expect(screen.getByText('Reviewer requested changes')).toBeTruthy());
    expect(screen.getByText('Vehicle outside photo is missing.')).toBeTruthy();
    expect(screen.getByText('Update Application')).toBeTruthy();
  });
});
