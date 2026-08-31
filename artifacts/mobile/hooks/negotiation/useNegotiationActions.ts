import { useCallback } from 'react';
import { Alert, Linking } from 'react-native';
import type { Ride } from '@/types';
import { validateFareAmount } from '@/context/ride/rideConstants';
import { MAX_NEGOTIATION_MESSAGE_LENGTH } from '@/components/negotiation/negotiationUtils';

export function useNegotiationActions({
  canCounter,
  canSendMessage,
  counterOffer,
  currentRide,
  declineDriverOffer,
  messageText,
  offerText,
  sendNegotiationMessage,
  setCounterLoading,
  setFareError,
  setMessageError,
  setMessageSending,
  setMessageText,
  setOfferText,
  setPendingOfferAmount,
  setShowDriverTyping,
}: {
  canCounter: boolean;
  canSendMessage: boolean;
  counterOffer: (amount: number) => void;
  currentRide: Ride | null;
  declineDriverOffer: () => void;
  messageText: string;
  offerText: string;
  sendNegotiationMessage: (text: string) => Promise<void>;
  setCounterLoading: (loading: boolean) => void;
  setFareError: (message: string | null) => void;
  setMessageError: (message: string | null) => void;
  setMessageSending: (sending: boolean) => void;
  setMessageText: (text: string) => void;
  setOfferText: (text: string) => void;
  setPendingOfferAmount: (amount: number | null) => void;
  setShowDriverTyping: (show: boolean) => void;
}) {
  const sendCounter = useCallback((amount: number) => {
    if (!amount || !canCounter) return;
    // Mirror the backend's per-vehicle fare bounds so an exploitative amount is
    // blocked with an inline message before it round-trips to the 400.
    const boundsError = validateFareAmount(currentRide?.vehicleType, amount);
    if (boundsError) {
      setFareError(boundsError);
      return;
    }
    setFareError(null);
    setShowDriverTyping(false);
    setPendingOfferAmount(amount);
    setOfferText('');
    setCounterLoading(true);
    counterOffer(amount);
  }, [
    canCounter,
    counterOffer,
    currentRide?.vehicleType,
    setCounterLoading,
    setFareError,
    setOfferText,
    setPendingOfferAmount,
    setShowDriverTyping,
  ]);

  const handleSendCounter = useCallback(() => {
    sendCounter(parseInt(offerText.replace(/\D/g, ''), 10));
  }, [offerText, sendCounter]);

  const handleSendMessage = useCallback(() => {
    const trimmed = messageText.trim().slice(0, MAX_NEGOTIATION_MESSAGE_LENGTH);
    if (!trimmed || !canSendMessage) return;
    setMessageError(null);
    setMessageText('');
    setMessageSending(true);
    void sendNegotiationMessage(trimmed)
      .catch(() => {
        // The optimistic bubble already shows locally; restore the draft so
        // one tap on Send retries without retyping. Real state (did the
        // driver actually receive it) is settled by history replay on resume.
        setMessageText(trimmed);
        setMessageError('Message failed to send. Tap send to retry.');
      })
      .finally(() => setMessageSending(false));
  }, [
    canSendMessage,
    messageText,
    sendNegotiationMessage,
    setMessageError,
    setMessageSending,
    setMessageText,
  ]);

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

  return { handleCall, handleDecline, handleSendCounter, handleSendMessage };
}
