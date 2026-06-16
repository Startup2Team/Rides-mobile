import { useCallback } from 'react';
import { Alert, Linking } from 'react-native';
import { router } from 'expo-router';
import type { Ride } from '@/types';
import { showCancelArrivedRideAlert, showCancelArrivingRideAlert } from '@/utils/cancelArrivingRideAlert';

export function useRideActions({
  cancelRide,
  currentRide,
  showToast,
}: {
  cancelRide: () => void;
  currentRide: Ride | null;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}) {
  const doCancelRide = useCallback(() => {
    cancelRide();
    showToast('Ride cancelled', 'info');
    router.replace('/(tabs)');
  }, [cancelRide, showToast]);

  const handleCallDriver = useCallback(() => {
    const phone = currentRide?.driver?.phone;
    if (!phone) {
      Alert.alert('Cannot call', 'No driver phone number is available.');
      return;
    }
    Linking.openURL(`tel:${phone}`).catch(() => {
      Alert.alert('Cannot call', 'Unable to open the phone dialler.');
    });
  }, [currentRide?.driver?.phone]);

  const handleSOS = useCallback(() => {
    Alert.alert(
      '🆘 Emergency',
      `Driver: ${currentRide?.driver?.name ?? 'Unknown'}\nPlate: ${currentRide?.driver?.plateNumber ?? 'Unknown'}\n\nWhat do you need?`,
      [
        { text: 'Dismiss', style: 'cancel' },
        { text: 'Call Police (112)', onPress: () => Linking.openURL('tel:112') },
      ],
    );
  }, [currentRide?.driver?.name, currentRide?.driver?.plateNumber]);

  return {
    handleCallDriver,
    handleCancelArrived: () => showCancelArrivedRideAlert(doCancelRide),
    handleCancelArriving: () => showCancelArrivingRideAlert(doCancelRide),
    handleEmergency: () => {
      Alert.alert('Emergency help', 'Trip progress is controlled by your driver. What do you need?', [
        { text: 'Call Police (112)', onPress: () => Linking.openURL('tel:112') },
        { text: 'Cancel', style: 'cancel' },
      ]);
    },
    handleSOS,
  };
}
