import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import DriverOnboarding from '@/app/driver-onboarding';

jest.mock('react-native', () => {
  const React = require('react');
  const host = (name: string) => React.forwardRef((props: object, ref: unknown) => React.createElement(name, { ...props, ref }));
  return {
    KeyboardAvoidingView: host('KeyboardAvoidingView'),
    Platform: { OS: 'android' },
    Pressable: host('Pressable'),
    ScrollView: host('ScrollView'),
    StyleSheet: { create: (styles: object) => styles, flatten: (style: object) => style },
    Text: host('Text'),
    View: host('View'),
  };
});

jest.mock('@/components/driver-onboarding/onboardingStyles', () => ({
  styles: { content: {} },
}));

jest.mock('expo-router', () => ({
  router: { replace: jest.fn() },
}));

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  launchCameraAsync: jest.fn(async () => ({ canceled: true, assets: [] })),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
}));

jest.mock('@/hooks/useColors', () => ({
  useColors: () => ({
    background: '#ffffff',
    foreground: '#111111',
    primary: '#0066ff',
  }),
}));

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    saveDriverProfile: jest.fn(),
    switchMode: jest.fn(),
    user: null,
  }),
}));

jest.mock('@/components/AppButton', () => ({
  AppButton: ({ disabled, onPress, title }: {
    disabled?: boolean;
    onPress: () => void;
    title: string;
  }) => {
    const React = require('react');
    const { Pressable, Text } = require('react-native');
    return (
      <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress}>
        <Text>{title}</Text>
      </Pressable>
    );
  },
}));

jest.mock('@/components/driver-onboarding/ProgressHeader', () => ({
  ProgressHeader: ({ step }: { step: number }) => {
    const React = require('react');
    const { Text } = require('react-native');
    return <Text testID="onboarding-step">{step}</Text>;
  },
}));

jest.mock('@/components/driver-onboarding/PersonalInformationSection', () => ({
  PersonalInformationSection: ({ errors }: { errors: Record<string, string> }) => {
    const React = require('react');
    const { Text, View } = require('react-native');
    return (
      <View>
        <Text>Personal Information</Text>
        {Object.entries(errors).map(([field, message]) => (
          message ? <Text key={field}>{`${field}: ${message}`}</Text> : null
        ))}
      </View>
    );
  },
}));

jest.mock('@/components/driver-onboarding/VehicleInformationSection', () => ({
  VehicleInformationSection: () => {
    const React = require('react');
    const { Text } = require('react-native');
    return <Text>Vehicle Information</Text>;
  },
}));

jest.mock('@/components/driver-onboarding/DocumentUploadSection', () => ({
  DocumentUploadSection: () => {
    const React = require('react');
    const { Text } = require('react-native');
    return <Text>Document Upload</Text>;
  },
}));

jest.mock('@/components/driver-onboarding/RequirementsSection', () => ({
  RequirementsSection: () => {
    const React = require('react');
    const { Text } = require('react-native');
    return <Text>Requirements</Text>;
  },
}));

jest.mock('@/components/driver-onboarding/ReviewSubmissionSection', () => ({
  ReviewSubmissionSection: () => {
    const React = require('react');
    const { Text } = require('react-native');
    return <Text>Review Application</Text>;
  },
}));

jest.mock('@/components/ImageGalleryPreview', () => ({
  ImageGalleryPreview: () => {
    const React = require('react');
    const { View } = require('react-native');
    return <View testID="image-gallery-preview" />;
  },
}));

jest.mock('@/hooks/driver-onboarding/useDriverDocumentUpload', () => {
  const { INITIAL_DRIVER_DOCUMENTS } = require('@/hooks/driver-onboarding/onboardingTypes');
  return {
    useDriverDocumentUpload: () => ({
      docs: INITIAL_DRIVER_DOCUMENTS,
      pickDocument: jest.fn(),
      selfieUri: null,
      takeDocumentPhoto: jest.fn(),
      takeSelfie: jest.fn(),
    }),
  };
});

describe('driver onboarding rendered validation workflow', () => {
  beforeEach(() => {
    const originalConsoleError = console.error;
    jest.spyOn(console, 'error').mockImplementation((...args) => {
      if (String(args[0]).includes('react-test-renderer is deprecated')) return;
      originalConsoleError(...args);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('blocks progression and renders required personal-information errors', async () => {
    render(<DriverOnboarding />);

    await waitFor(() => expect(screen.getByTestId('onboarding-step').props.children).toBe(0));
    expect(screen.getByTestId('onboarding-step').props.children).toBe(0);
    fireEvent.press(screen.getByText('Continue'));

    expect(screen.getByTestId('onboarding-step').props.children).toBe(0);
    expect(screen.getByText('selfie: Identity photo is required')).toBeTruthy();
    expect(screen.getByText('dob: Required')).toBeTruthy();
    expect(screen.getByText('province: Required')).toBeTruthy();
    expect(screen.getByText('village: Required')).toBeTruthy();
  });
});
