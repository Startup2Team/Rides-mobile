import { useEffect, useMemo, useRef, useState } from 'react';
import type { ScrollView } from 'react-native';
import type { NegotiationMessage, Ride } from '@/types';
import {
  DRIVER_TYPING_DELAY_MS,
  formatFare,
  MAX_OFFERS,
} from '@/components/negotiation/negotiationUtils';

export function useNegotiationState(currentRide: Ride | null) {
  const scrollRef = useRef<ScrollView>(null);
  const [offerText, setOfferText] = useState('');
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [counterLoading, setCounterLoading] = useState(false);
  const [pendingOfferAmount, setPendingOfferAmount] = useState<number | null>(null);
  const [showDriverTyping, setShowDriverTyping] = useState(false);
  const [actionPanelHeight, setActionPanelHeight] = useState(0);
  const [fareError, setFareError] = useState<string | null>(null);

  const negotiation = currentRide?.negotiation ?? [];
  const customerOffers = negotiation.filter(message => message.sender === 'customer' && message.type === 'offer');
  const driverOffers = negotiation.filter(message => message.sender === 'driver' && message.type === 'offer');
  const lastDriverOffer = [...driverOffers].pop();
  const lastMessage = negotiation[negotiation.length - 1];
  const customerLimitReached = customerOffers.length >= MAX_OFFERS;
  const isAwaitingDriverReply =
    currentRide?.status === 'negotiating' &&
    lastMessage?.sender === 'customer' &&
    !customerLimitReached;
  const showPendingOffer =
    pendingOfferAmount != null &&
    !negotiation.some(
      message =>
        message.sender === 'customer' &&
        message.type === 'offer' &&
        message.amount === pendingOfferAmount,
    );
  const pendingOfferMessage: NegotiationMessage | null = showPendingOffer
    ? {
        id: 'pending-customer-offer',
        sender: 'customer',
        type: 'offer',
        amount: pendingOfferAmount,
        timestamp: new Date().toISOString(),
      }
    : null;
  const messagesUsed = Math.min(customerOffers.length, MAX_OFFERS);
  const offersRemaining = Math.max(0, MAX_OFFERS - messagesUsed);
  const canCounter = Boolean(lastDriverOffer) && lastMessage?.sender === 'driver' && !customerLimitReached;
  // You may only accept the OTHER party's LATEST offer. Once the customer
  // counters, their own offer is the latest message, so Accept is gated off
  // until the driver responds again (prevents accepting a stale driver offer).
  const canAccept = Boolean(lastDriverOffer) && lastMessage?.sender === 'driver';
  const actionPanelOffset = actionPanelHeight > 0 ? actionPanelHeight : 108;
  const offerPlaceholder = customerOffers.length === 0
    ? 'Your offer'
    : customerOffers.length === MAX_OFFERS - 1
      ? 'Final offer'
      : 'Counter offer';

  const chatStatus = useMemo(() => {
    if (customerLimitReached) {
      return {
        tone: 'limit' as const,
        title: 'Offer limit reached',
        hint: 'Call your driver to agree on a final fare',
      };
    }
    if (showDriverTyping) {
      return {
        tone: 'waiting' as const,
        title: 'Driver is replying',
        hint: 'Hang tight - they usually respond quickly',
      };
    }
    if (lastDriverOffer?.amount) {
      return {
        tone: 'active' as const,
        title: 'New fare from driver',
        hint: `${formatFare(lastDriverOffer.amount)} - tap Accept fare below when you're ready`,
      };
    }
    return {
      tone: 'neutral' as const,
      title: 'Fare negotiation',
      hint: 'Send an offer below when the driver responds',
    };
  }, [customerLimitReached, lastDriverOffer?.amount, showDriverTyping]);

  useEffect(() => {
    if (lastMessage?.sender !== 'customer') {
      setCounterLoading(false);
      setPendingOfferAmount(null);
    }
  }, [lastMessage?.id, lastMessage?.sender]);

  useEffect(() => {
    if (pendingOfferAmount == null) return;
    const confirmed = negotiation.some(
      message =>
        message.sender === 'customer' &&
        message.type === 'offer' &&
        message.amount === pendingOfferAmount,
    );
    if (confirmed) setPendingOfferAmount(null);
  }, [negotiation, pendingOfferAmount]);

  useEffect(() => {
    const canShowTyping = counterLoading && isAwaitingDriverReply && !showPendingOffer;
    if (!canShowTyping) {
      setShowDriverTyping(false);
      return undefined;
    }
    const timer = setTimeout(() => setShowDriverTyping(true), DRIVER_TYPING_DELAY_MS);
    return () => clearTimeout(timer);
  }, [counterLoading, isAwaitingDriverReply, lastMessage?.id, showPendingOffer]);

  useEffect(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    });
  }, [negotiation.length, pendingOfferAmount, showDriverTyping]);

  return {
    actionPanelOffset,
    canAccept,
    canCounter,
    chatStatus,
    counterLoading,
    customerLimitReached,
    fareError,
    lastDriverOffer,
    messagesUsed,
    negotiation,
    offerPlaceholder,
    offerText,
    offersRemaining,
    pendingOfferMessage,
    scrollRef,
    setActionPanelHeight,
    setCounterLoading,
    setFareError,
    setOfferText,
    setPendingOfferAmount,
    setShowAcceptModal,
    setShowDriverTyping,
    showAcceptModal,
    showDriverTyping,
  };
}
