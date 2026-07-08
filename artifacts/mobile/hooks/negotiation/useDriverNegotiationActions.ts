import { useCallback } from 'react';
import { Alert, Linking } from 'react-native';
import { router } from 'expo-router';
import type { Ride } from '@/types';
import { navigateToDriverHomeAfterCompletion } from '@/navigation/navigationPolicy';

export function useDriverNegotiationActions({
  canSendOffer,
  sendDriverOffer,
  cancelRide,
  currentRide,
  offerText,
  setOfferText,
}: {
  canSendOffer: boolean;
  sendDriverOffer: (amount: number) => void;
  cancelRide: () => void;
  currentRide: Ride | null;
  offerText: string;
  setOfferText: (text: string) => void;
}) {
  const handleSendOffer = useCallback(() => {
    const amount = parseInt(offerText.replace(/\D/g, ''), 10);
    if (!amount || amount <= 0 || !canSendOffer) return;
    setOfferText('');
    sendDriverOffer(amount);
  }, [canSendOffer, offerText, sendDriverOffer, setOfferText]);

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
