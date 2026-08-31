import { useEffect, useMemo, useRef, useState } from 'react';
import type { ScrollView } from 'react-native';
import type { NegotiationMessage, Ride } from '@/types';
import { formatFare, MAX_OFFERS, DRIVER_TYPING_DELAY_MS } from '@/components/negotiation/negotiationUtils';

export function useDriverNegotiationState(currentRide: Ride | null) {
  const scrollRef = useRef<ScrollView>(null);
  const [offerText, setOfferText] = useState('');
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [actionPanelHeight, setActionPanelHeight] = useState(0);
  const [showCustomerTyping, setShowCustomerTyping] = useState(false);
  const [fareError, setFareError] = useState<string | null>(null);
  const [messageText, setMessageText] = useState('');
  const [messageSending, setMessageSending] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);
  // The id of the in-flight/failed outgoing text message, so a retry reuses
  // the same optimistic bubble instead of appending a duplicate. Cleared once
  // the message is confirmed delivered. Mirrors useNegotiationState (customer).
  const [pendingMessageId, setPendingMessageId] = useState<string | null>(null);

  const negotiation = currentRide?.negotiation ?? [];
  const driverOffers = negotiation.filter(m => m.sender === 'driver' && m.type === 'offer');
  const customerOffers = negotiation.filter(m => m.sender === 'customer' && m.type === 'offer');
  const lastCustomerOffer = [...customerOffers].pop();
  const lastDriverOffer = [...driverOffers].pop();
  const lastMessage = negotiation[negotiation.length - 1];
  const driverLimitReached = driverOffers.length >= MAX_OFFERS;
  const canSendOffer = !driverLimitReached;
  // Free-text chat has no offer-count limit on the backend — only the ride
  // status gates it, so it stays usable even after the fare-offer cap is hit.
  // Mirrors useNegotiationState (customer).
  const canSendMessage = currentRide?.status === 'negotiating';
  // Symmetric to the customer gate: the driver may only accept the customer's
  // LATEST offer. After the driver sends a counter, their own offer is the
  // latest message, so Accept is gated off until the customer responds.
  const canAccept = Boolean(lastCustomerOffer) && lastMessage?.sender === 'customer';
  const messagesUsed = Math.min(driverOffers.length, MAX_OFFERS);
  const offersRemaining = Math.max(0, MAX_OFFERS - messagesUsed);
  const actionPanelOffset = actionPanelHeight > 0 ? actionPanelHeight : 108;

  const isAwaitingCustomerReply =
    currentRide?.status === 'negotiating' &&
    lastMessage?.sender === 'driver' &&
    !driverLimitReached;

  const offerPlaceholder = driverOffers.length === 0
    ? 'Your fare offer'
    : driverOffers.length === MAX_OFFERS - 1
      ? 'Final offer'
      : 'Adjust offer';

  const chatStatus = useMemo(() => {
    if (driverLimitReached) {
      return {
        tone: 'limit' as const,
        title: 'Offer limit reached',
        hint: 'Call the customer to agree on a final fare',
      };
    }
    if (showCustomerTyping) {
      return {
        tone: 'waiting' as const,
        title: 'Customer is replying',
        hint: 'Hang tight - they usually respond quickly',
      };
    }
    if (lastCustomerOffer?.amount && lastMessage?.sender === 'customer') {
      return {
        tone: 'active' as const,
        title: 'Customer counter offer',
        hint: `${formatFare(lastCustomerOffer.amount)} — accept or send a new offer`,
      };
    }
    if (driverOffers.length > 0 && lastMessage?.sender === 'driver') {
      return {
        tone: 'waiting' as const,
        title: 'Waiting for customer',
        hint: 'Your offer was sent — customer will respond shortly',
      };
    }
    return {
      tone: 'neutral' as const,
      title: 'Fare negotiation',
      hint: 'Send your fare offer to begin the negotiation',
    };
  }, [driverLimitReached, driverOffers.length, lastCustomerOffer?.amount, lastMessage?.sender, showCustomerTyping]);

  // Show typing indicator after driver sends, hide when customer reply lands
  useEffect(() => {
    if (!isAwaitingCustomerReply) {
      setShowCustomerTyping(false);
      return undefined;
    }
    const timer = setTimeout(() => setShowCustomerTyping(true), DRIVER_TYPING_DELAY_MS);
    return () => clearTimeout(timer);
  }, [isAwaitingCustomerReply, lastMessage?.id]);

  useEffect(() => {
    if (lastMessage?.sender === 'customer') setShowCustomerTyping(false);
  }, [lastMessage?.id, lastMessage?.sender]);

  useEffect(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    });
  }, [negotiation.length, showCustomerTyping]);

  return {
    actionPanelOffset,
    canAccept,
    canSendMessage,
    canSendOffer,
    chatStatus,
    driverLimitReached,
    fareError,
    lastCustomerOffer,
    lastDriverOffer,
    messageError,
    messageSending,
    messageText,
    messagesUsed,
    negotiation,
    offerPlaceholder,
    offerText,
    offersRemaining,
    pendingMessageId,
    scrollRef,
    setActionPanelHeight,
    setFareError,
    setMessageError,
    setMessageSending,
    setMessageText,
    setOfferText,
    setPendingMessageId,
    setShowAcceptModal,
    showAcceptModal,
    showCustomerTyping,
  };
}
