import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router, Stack, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useColorScheme, Text, TextInput } from 'react-native';
import * as SystemUI from 'expo-system-ui';

// Configure global default font family for standard Text and TextInput components
const patchComponentFont = (Component: any, defaultFamily: string) => {
  if (!Component) return;

  if (Component.render) {
    const originalRender = Component.render;
    Component.render = function render(props: any, ref: any) {
      const newProps = {
        ...props,
        style: [{ fontFamily: defaultFamily }, props.style],
      };
      return originalRender.call(this, newProps, ref);
    };
  }

  try {
    if (!Component.defaultProps) {
      Component.defaultProps = {};
    }
    Component.defaultProps.style = {
      fontFamily: defaultFamily,
      ...Component.defaultProps.style,
    };
  } catch (e) {
    // Ignore
  }
};

patchComponentFont(Text, 'Inter_400Regular');
patchComponentFont(TextInput, 'Inter_400Regular');

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AuthProvider } from '@/context/AuthContext';
import { DriverEntitlementProvider } from '@/context/DriverEntitlementContext';
import { PackageSyncProvider } from '@/context/PackageSyncContext';
import { MapPickerProvider } from '@/context/MapPickerContext';
import { RideProvider } from '@/context/RideContext';
import { SavedLocationsProvider } from '@/context/SavedLocationsContext';
import { ToastProvider } from '@/context/ToastContext';
import { useRideFlowNavigation } from '@/navigation/useRideFlowNavigation';
import { useDriverFlowNavigation } from '@/navigation/useDriverFlowNavigation';
import { initializeMonitoring, reportRuntimeError } from '@/observability/monitoring';
import { useAuth } from '@/context/AuthContext';
import { canAccessDriverMode, isProtectedDriverPath } from '@/utils/driverVerification';

SplashScreen.preventAutoHideAsync();
initializeMonitoring();

const queryClient = new QueryClient();

function RootLayoutNav() {
  const pathname = usePathname();
  const { driverProfile } = useAuth();
  useRideFlowNavigation();
  useDriverFlowNavigation();

  useEffect(() => {
    if (isProtectedDriverPath(pathname) && !canAccessDriverMode(driverProfile)) {
      router.replace('/driver-submission-confirmation');
    }
  }, [driverProfile, pathname]);

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="(driver)" />
      <Stack.Screen name="booking" options={{ presentation: 'modal' }} />
      <Stack.Screen name="searching" />
      <Stack.Screen name="negotiation" />
      <Stack.Screen name="ride" options={{ animation: 'none' }} />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="driver-onboarding" />
      <Stack.Screen name="driver-submission-confirmation" />
      <Stack.Screen name="driver-packages" />
      <Stack.Screen name="driver-package-payment" />
      <Stack.Screen name="driver-policy" />
      <Stack.Screen name="driver-documents" />
      <Stack.Screen name="driver-vehicles" />
      <Stack.Screen name="driver-vehicle-details" />
      <Stack.Screen name="driver-add-vehicle" />
      <Stack.Screen name="driver-navigate" />
      <Stack.Screen name="driver-ride-complete" options={{ presentation: 'fullScreenModal', animation: 'fade', gestureEnabled: false }} />
      <Stack.Screen
        name="rating"
        options={{
          presentation: 'transparentModal',
          animation: 'fade',
          headerShown: false,
          gestureEnabled: false,
          contentStyle: { backgroundColor: 'transparent' },
        }}
      />
      <Stack.Screen name="payment-methods" />
      <Stack.Screen name="edit-profile" />
      <Stack.Screen name="change-phone-number" />
      <Stack.Screen name="help-support" />
      <Stack.Screen name="report-ride-issue" />
      <Stack.Screen name="privacy-security" />
      <Stack.Screen name="about" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="location-search" />
      <Stack.Screen name="map-picker" />
      <Stack.Screen name="saved-place-selector" />
      <Stack.Screen name="ride-detail" />
    </Stack>
  );
}

export default function RootLayout() {
  const scheme = useColorScheme();

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(scheme === 'dark' ? '#0A0A0A' : '#F5F5F5');
  }, [scheme]);

  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary
        onError={(error, componentStack) => {
          reportRuntimeError(error, 'react.error-boundary', {
            hasComponentStack: componentStack.length > 0,
          });
        }}
      >
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <PackageSyncProvider>
              <DriverEntitlementProvider>
                <RideProvider>
                  <ToastProvider>
                    <SavedLocationsProvider>
                      <MapPickerProvider>
                        <GestureHandlerRootView style={{ flex: 1 }}>
                          <KeyboardProvider>
                            <RootLayoutNav />
                          </KeyboardProvider>
                        </GestureHandlerRootView>
                      </MapPickerProvider>
                    </SavedLocationsProvider>
                  </ToastProvider>
                </RideProvider>
              </DriverEntitlementProvider>
            </PackageSyncProvider>
          </AuthProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
