import { useCallback, useState } from 'react';
import { Alert, Linking } from 'react-native';
import { router } from 'expo-router';
import type { Ride } from '@/types';
import { resolveDriverProfileImage } from '@/utils/driverProfileImage';
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
  const [completeModalVisible, setCompleteModalVisible] = useState(false);

  const navigateToRating = useCallback(() => {
    if (!currentRide) return;
    const driverPhoto = resolveDriverProfileImage(currentRide.driver);
    router.push({
      pathname: '/rating',
      params: {
        rideId: currentRide.id,
        driverName: currentRide.driver?.name ?? '',
        ...(driverPhoto ? { driverPhoto } : {}),
        fare: String(currentRide.agreedFare ?? 0),
        vehicleType: currentRide.vehicleType,
      },
    });
  }, [currentRide]);

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
    completeModalVisible,
    confirmCompleteRide: () => {
      setCompleteModalVisible(false);
      navigateToRating();
    },
    handleCallDriver,
    handleCancelArrived: () => showCancelArrivedRideAlert(doCancelRide),
    handleCancelArriving: () => showCancelArrivingRideAlert(doCancelRide),
    handleComplete: () => setCompleteModalVisible(true),
    handleEmergencyEnd: () => {
      Alert.alert('End Journey', 'End this journey early?', [
        { text: 'End Journey', onPress: navigateToRating },
        { text: 'Cancel', style: 'cancel' },
      ]);
    },
    handleSOS,
    hideCompleteModal: () => setCompleteModalVisible(false),
  };
}
