import { useCallback } from 'react';
import { Alert, Linking } from 'react-native';
import type { Ride } from '@/types';

export function useNegotiationActions({
  canCounter,
  counterOffer,
  currentRide,
  declineDriverOffer,
  minFare,
  offerText,
  setCounterLoading,
  setOfferText,
  setPendingOfferAmount,
  setShowDriverTyping,
}: {
  canCounter: boolean;
  counterOffer: (amount: number) => void;
  currentRide: Ride | null;
  declineDriverOffer: () => void;
  minFare: number;
  offerText: string;
  setCounterLoading: (loading: boolean) => void;
  setOfferText: (text: string) => void;
  setPendingOfferAmount: (amount: number | null) => void;
  setShowDriverTyping: (show: boolean) => void;
}) {
  const sendCounter = useCallback((amount: number) => {
    if (!amount || amount < 100 || !canCounter) return;
    // Block offers below the vehicle's minimum fare — otherwise the backend
    // accepts the proposal but the driver can never accept it (BELOW_MIN_FARE).
    if (minFare > 0 && amount < minFare) {
      Alert.alert('Fare too low', `The minimum fare for this ride is ${minFare.toLocaleString()} RWF.`);
      return;
    }
    setShowDriverTyping(false);
    setPendingOfferAmount(amount);
    setOfferText('');
    setCounterLoading(true);
    counterOffer(amount);
  }, [
    canCounter,
    counterOffer,
    minFare,
    setCounterLoading,
    setOfferText,
    setPendingOfferAmount,
    setShowDriverTyping,
  ]);

  const handleSendCounter = useCallback(() => {
    sendCounter(parseInt(offerText.replace(/\D/g, ''), 10));
  }, [offerText, sendCounter]);

  const handleCall = useCallback(() => {
    const phone = currentRide?.driver?.phone;
    if (!phone) return;
    Linking.openURL(`tel:${phone}`).catch(() => {
      Alert.alert('Cannot call', 'Unable to open the phone dialler.');
    });
  }, [currentRide?.driver?.phone]);

  const handleDecline = useCallback(() => {
    Alert.alert(
      'Why are you declining?',
      'Your feedback helps improve the experience.',
      [
        { text: 'Price is too high', onPress: declineDriverOffer },
        { text: 'Driver is too far', onPress: declineDriverOffer },
        { text: 'Driver asked me to cancel', onPress: declineDriverOffer },
        { text: 'Changed my plans', onPress: declineDriverOffer },
        { text: 'Keep negotiating', style: 'cancel' },
      ],
    );
  }, [declineDriverOffer]);

  return { handleCall, handleDecline, handleSendCounter };
}
