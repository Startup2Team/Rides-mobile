import { useCallback } from 'react';
import { Alert, Linking } from 'react-native';
import { router } from 'expo-router';
import type { Ride } from '@/types';
import { validateFareAmount } from '@/context/ride/rideConstants';
import { navigateToDriverHomeAfterCompletion } from '@/navigation/navigationPolicy';

export function useDriverNegotiationActions({
  canSendOffer,
  sendDriverOffer,
  cancelRide,
  currentRide,
  offerText,
  setFareError,
  setOfferText,
}: {
  canSendOffer: boolean;
  sendDriverOffer: (amount: number) => void;
  cancelRide: () => void;
  currentRide: Ride | null;
  offerText: string;
  setFareError: (message: string | null) => void;
  setOfferText: (text: string) => void;
}) {
  const handleSendOffer = useCallback(() => {
    const amount = parseInt(offerText.replace(/\D/g, ''), 10);
    if (!amount || amount <= 0 || !canSendOffer) return;
    // Mirror the backend's per-vehicle fare bounds — block + surface inline
    // before the offer round-trips to the 400 VALIDATION response.
    const boundsError = validateFareAmount(currentRide?.vehicleType, amount);
    if (boundsError) {
      setFareError(boundsError);
      return;
    }
    setFareError(null);
    setOfferText('');
    sendDriverOffer(amount);
  }, [canSendOffer, currentRide?.vehicleType, offerText, sendDriverOffer, setFareError, setOfferText]);

  const handleCall = useCallback(() => {
    const phone = currentRide?.customerPhone;
    if (!phone) return;
    Linking.openURL(`tel:${phone}`).catch(() => {
      Alert.alert('Cannot call', 'Unable to open the phone dialler.');
    });
  }, [currentRide?.customerPhone]);

  const handleDecline = useCallback(() => {
    Alert.alert(
      'Decline ride',
      'Why do you want to decline this negotiation?',
      [
        { text: 'Price is too low', onPress: () => { cancelRide(); navigateToDriverHomeAfterCompletion(router); } },
        { text: 'Too far from pickup', onPress: () => { cancelRide(); navigateToDriverHomeAfterCompletion(router); } },
        { text: 'Busy right now', onPress: () => { cancelRide(); navigateToDriverHomeAfterCompletion(router); } },
        { text: 'Other reason', onPress: () => { cancelRide(); navigateToDriverHomeAfterCompletion(router); } },
        { text: 'Keep negotiating', style: 'cancel' },
      ],
      { cancelable: true },
    );
  }, [cancelRide]);

  return { handleCall, handleDecline, handleSendOffer };
}
