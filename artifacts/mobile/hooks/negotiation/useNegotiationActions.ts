import { useCallback } from 'react';
import { Alert, Linking } from 'react-native';
import type { NegotiationMessage, Ride } from '@/types';
import { validateFareAmount } from '@/context/ride/rideConstants';
import { generateNegotiationMessageId, MAX_NEGOTIATION_MESSAGE_LENGTH } from '@/components/negotiation/negotiationUtils';

export function useNegotiationActions({
  canCounter,
  canSendMessage,
  counterOffer,
  currentRide,
  declineDriverOffer,
  messageSending,
  messageText,
  offerText,
  pendingMessageId,
  sendNegotiationMessage,
  setCounterLoading,
  setFareError,
  setMessageError,
  setMessageSending,
  setMessageText,
  setOfferText,
  setPendingMessageId,
  setPendingOfferAmount,
  setShowDriverTyping,
}: {
  canCounter: boolean;
  canSendMessage: boolean;
  counterOffer: (amount: number) => void;
  currentRide: Ride | null;
  declineDriverOffer: () => void;
  messageSending: boolean;
  messageText: string;
  offerText: string;
  pendingMessageId: string | null;
  sendNegotiationMessage: (text: string, messageId?: string) => Promise<string>;
  setCounterLoading: (loading: boolean) => void;
  setFareError: (message: string | null) => void;
  setMessageError: (message: string | null) => void;
  setMessageSending: (sending: boolean) => void;
  setMessageText: (text: string) => void;
  setOfferText: (text: string) => void;
  setPendingMessageId: (id: string | null) => void;
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

  // Shared by a fresh send and a bubble-tap retry: both must reuse the SAME
  // message id so the provider replaces the pending/failed bubble in place
  // (see rideNegotiation.ts) instead of appending a second, duplicate one.
  const dispatchMessage = useCallback((text: string, id: string, onFailure?: () => void) => {
    setMessageError(null);
    setMessageSending(true);
    void sendNegotiationMessage(text, id)
      .then(() => setPendingMessageId(null))
      .catch(() => {
        // The bubble itself is tagged 'failed' by the provider — this only
        // drives the inline dock error copy. Real state (did the driver
        // actually receive it) is settled by history replay on resume.
        // TODO(i18n)
        setMessageError('Message failed to send. Tap send to retry.');
        onFailure?.();
      })
      .finally(() => setMessageSending(false));
  }, [sendNegotiationMessage, setMessageError, setMessageSending, setPendingMessageId]);

  const handleSendMessage = useCallback(() => {
    const trimmed = messageText.trim().slice(0, MAX_NEGOTIATION_MESSAGE_LENGTH);
    if (!trimmed || !canSendMessage || messageSending) return;
    // Reuse the previous id if the last send is still pending/failed (retry
    // via the input box after editing/resending), otherwise start a new one.
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

  return { handleCall, handleDecline, handleRetryMessage, handleSendCounter, handleSendMessage };
}
