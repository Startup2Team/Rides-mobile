import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { DriverCreditDashboardCard } from '../DriverCreditDashboardCard';
import { DriverPackageRequiredModal } from '../DriverPackageRequiredModal';
import { activatePackage, EMPTY_DRIVER_ENTITLEMENT } from '@/domain/driverRidePackages';

jest.mock('react-native', () => {
  const React = require('react');
  const host = (name: string) => React.forwardRef((props: object, ref: unknown) => React.createElement(name, { ...props, ref }));
  return {
    ActivityIndicator: host('ActivityIndicator'),
    Modal: host('Modal'),
    StyleSheet: { absoluteFillObject: {}, create: (styles: object) => styles, flatten: (style: object) => style },
    Text: host('Text'),
    TouchableOpacity: host('TouchableOpacity'),
    View: host('View'),
    useColorScheme: () => 'light',
  };
});

jest.mock('@expo/vector-icons', () => ({
  Feather: () => null,
}));

jest.mock('@/hooks/useColors', () => ({
  useColors: () => ({
    border: '#ddd',
    destructive: '#d00',
    destructiveHex: '#dd0000',
    foreground: '#111',
    mutedForeground: '#666',
    primary: '#06f',
    primaryForeground: '#fff',
    primaryHex: '#0066ff',
    success: '#00c853',
    successForeground: '#000',
    successHex: '#00c853',
  }),
}));

describe('driver dashboard ride-credit UX', () => {
  test('shows a visible zero-credit warning card', () => {
    const onViewPackages = jest.fn();
    render(<DriverCreditDashboardCard entitlement={EMPTY_DRIVER_ENTITLEMENT} isLoading={false} onViewPackages={onViewPackages} />);

    expect(screen.getByText('No ride credits')).toBeTruthy();
    expect(screen.getByText('Choose a package to start receiving ride requests.')).toBeTruthy();
    fireEvent.press(screen.getByText('View Packages'));
    expect(onViewPackages).toHaveBeenCalledTimes(1);
  });

  test('shows entitlement loading state instead of zero credits', () => {
    render(<DriverCreditDashboardCard entitlement={EMPTY_DRIVER_ENTITLEMENT} isLoading onViewPackages={jest.fn()} />);

    expect(screen.getByText('Checking ride balance...')).toBeTruthy();
    expect(screen.queryByText('No ride credits')).toBeNull();
  });

  test('shows active package progress and low-balance guidance', () => {
    const entitlement = {
      ...activatePackage(EMPTY_DRIVER_ENTITLEMENT, 'launch_starter').entitlement,
      remainingRideCredits: 5,
    };
    render(<DriverCreditDashboardCard entitlement={entitlement} isLoading={false} onViewPackages={jest.fn()} />);

    expect(screen.getByText('Launch Starter Package')).toBeTruthy();
    expect(screen.getByText('5 of 35 ride credits remaining')).toBeTruthy();
    expect(screen.getByText('Only 5 ride credits left. Add a package soon to keep receiving requests.')).toBeTruthy();
  });

  test('blocked online modal explains credit rules and actions', () => {
    const onClose = jest.fn();
    const onViewPackages = jest.fn();
    render(<DriverPackageRequiredModal visible bottomInset={0} onClose={onClose} onViewPackages={onViewPackages} />);

    expect(screen.getByText('You need an active ride package to receive ride requests.')).toBeTruthy();
    expect(screen.getByText('1 completed ride uses 1 ride credit. Cancellations and declined requests do not use credits.')).toBeTruthy();
    fireEvent.press(screen.getByText('View Packages'));
    fireEvent.press(screen.getByText('Not Now'));
    expect(onViewPackages).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
