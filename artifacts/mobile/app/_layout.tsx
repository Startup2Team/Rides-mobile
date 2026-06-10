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

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AuthProvider } from '@/context/AuthContext';
import { DriverEntitlementProvider } from '@/context/DriverEntitlementContext';
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
      <Stack.Screen name="driver-policy" />
      <Stack.Screen name="driver-navigate" />
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
      <Stack.Screen name="help-support" />
      <Stack.Screen name="privacy-security" />
      <Stack.Screen name="about" />
      <Stack.Screen name="ride-detail" />
    </Stack>
  );
}

export default function RootLayout() {
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
            <DriverEntitlementProvider>
              <RideProvider>
                <ToastProvider>
                  <SavedLocationsProvider>
                    <GestureHandlerRootView style={{ flex: 1 }}>
                      <KeyboardProvider>
                        <RootLayoutNav />
                      </KeyboardProvider>
                    </GestureHandlerRootView>
                  </SavedLocationsProvider>
                </ToastProvider>
              </RideProvider>
            </DriverEntitlementProvider>
          </AuthProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
