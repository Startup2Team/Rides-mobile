import { useCallback } from 'react';
import { Alert, Linking } from 'react-native';
import { router } from 'expo-router';
import type { NegotiationMessage, Ride } from '@/types';
import { validateFareAmount } from '@/context/ride/rideConstants';
import { navigateToDriverHomeAfterCompletion } from '@/navigation/navigationPolicy';
import { generateNegotiationMessageId, MAX_NEGOTIATION_MESSAGE_LENGTH } from '@/components/negotiation/negotiationUtils';

export function useDriverNegotiationActions({
  canSendMessage,
  canSendOffer,
  sendDriverOffer,
  cancelRide,
  currentRide,
  messageSending,
  messageText,
  offerText,
  pendingMessageId,
  sendDriverNegotiationMessage,
  setFareError,
  setMessageError,
  setMessageSending,
  setMessageText,
  setOfferText,
  setPendingMessageId,
}: {
  canSendMessage: boolean;
  canSendOffer: boolean;
  sendDriverOffer: (amount: number) => void;
  cancelRide: () => void;
  currentRide: Ride | null;
  messageSending: boolean;
  messageText: string;
  offerText: string;
  pendingMessageId: string | null;
  sendDriverNegotiationMessage: (text: string, messageId?: string) => Promise<string>;
  setFareError: (message: string | null) => void;
  setMessageError: (message: string | null) => void;
  setMessageSending: (sending: boolean) => void;
  setMessageText: (text: string) => void;
  setOfferText: (text: string) => void;
  setPendingMessageId: (id: string | null) => void;
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

  // Driver-side twin of useNegotiationActions (customer). Shared by a fresh
  // send and a bubble-tap retry: both must reuse the SAME message id so the
  // provider replaces the pending/failed bubble in place instead of
  // appending a second, duplicate one.
  const dispatchMessage = useCallback((text: string, id: string, onFailure?: () => void) => {
    setMessageError(null);
    setMessageSending(true);
    void sendDriverNegotiationMessage(text, id)
      .then(() => setPendingMessageId(null))
      .catch(() => {
        // TODO(i18n)
        setMessageError('Message failed to send. Tap send to retry.');
        onFailure?.();
      })
      .finally(() => setMessageSending(false));
  }, [sendDriverNegotiationMessage, setMessageError, setMessageSending, setPendingMessageId]);

  const handleSendMessage = useCallback(() => {
    const trimmed = messageText.trim().slice(0, MAX_NEGOTIATION_MESSAGE_LENGTH);
    if (!trimmed || !canSendMessage || messageSending) return;
    const id = pendingMessageId ?? generateNegotiationMessageId();
    setPendingMessageId(id);
    setMessageText('');
    dispatchMessage(trimmed, id, () => setMessageText(trimmed));
  }, [canSendMessage, dispatchMessage, messageSending, messageText, pendingMessageId, setMessageText, setPendingMessageId]);

  // Tap-to-retry on a failed bubble: resend that exact message under its
  // existing id, no need to touch the input box.
  const handleRetryMessage = useCallback((message: NegotiationMessage) => {
    if (!message.text || !canSendMessage || messageSending) return;
    setPendingMessageId(message.id);
    dispatchMessage(message.text, message.id);
  }, [canSendMessage, dispatchMessage, messageSending, setPendingMessageId]);

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

  return { handleCall, handleDecline, handleRetryMessage, handleSendMessage, handleSendOffer };
}
