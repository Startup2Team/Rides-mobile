import React from 'react';
import { Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NegotiationHeader } from '@/components/negotiation/NegotiationHeader';
import { NegotiationInputDock } from '@/components/negotiation/NegotiationInputDock';
import { NegotiationTimeline } from '@/components/negotiation/NegotiationTimeline';
import { INPUT_DOCK_HEIGHT } from '@/components/negotiation/negotiationUtils';
import { styles } from '@/components/negotiation/negotiationStyles';
import { useRide } from '@/context/RideContext';
import { useColors } from '@/hooks/useColors';
import { useNegotiationActions } from '@/hooks/negotiation/useNegotiationActions';
import { useNegotiationState } from '@/hooks/negotiation/useNegotiationState';

export default function NegotiationScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { currentRide, counterOffer, acceptDriverOffer, declineDriverOffer, sendNegotiationMessage } =
    useRide();
  const state = useNegotiationState(currentRide);
  const actions = useNegotiationActions({
    canCounter: state.canCounter,
    canSendMessage: state.canSendMessage,
    counterOffer,
    currentRide,
    declineDriverOffer,
    messageText: state.messageText,
    offerText: state.offerText,
    sendNegotiationMessage,
    setCounterLoading: state.setCounterLoading,
    setFareError: state.setFareError,
    setMessageError: state.setMessageError,
    setMessageSending: state.setMessageSending,
    setMessageText: state.setMessageText,
    setOfferText: state.setOfferText,
    setPendingOfferAmount: state.setPendingOfferAmount,
    setShowDriverTyping: state.setShowDriverTyping,
  });

  if (!currentRide) return null;

  const footerBottomInset = insets.bottom + (Platform.OS === 'web' ? 24 : 6);
  const scrollBottomInset =
    state.actionPanelOffset + (state.canCounter ? INPUT_DOCK_HEIGHT : 0) + 12;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={[
          styles.page,
          { paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 0) + 14 },
        ]}
      >
        <NegotiationHeader
          chatStatus={state.chatStatus}
          messagesUsed={state.messagesUsed}
          offersRemaining={state.offersRemaining}
          ride={currentRide}
        />
        <NegotiationTimeline
          bottomInset={scrollBottomInset}
          negotiation={state.negotiation}
          pendingOfferMessage={state.pendingOfferMessage}
          scrollRef={state.scrollRef}
          showDriverTyping={state.showDriverTyping}
        />
      </View>

      <NegotiationInputDock
        acceptDriverOffer={acceptDriverOffer}
        actionPanelOffset={state.actionPanelOffset}
        canAccept={state.canAccept}
        canCounter={state.canCounter}
        canSendMessage={state.canSendMessage}
        counterLoading={state.counterLoading}
        customerLimitReached={state.customerLimitReached}
        fareError={state.fareError}
        footerBottomInset={footerBottomInset}
        handleCall={actions.handleCall}
        handleDecline={actions.handleDecline}
        handleSendCounter={actions.handleSendCounter}
        handleSendMessage={actions.handleSendMessage}
        lastDriverOffer={state.lastDriverOffer}
        messageError={state.messageError}
        messageSending={state.messageSending}
        messageText={state.messageText}
        offerPlaceholder={state.offerPlaceholder}
        offerText={state.offerText}
        ride={currentRide}
        setActionPanelHeight={state.setActionPanelHeight}
        setFareError={state.setFareError}
        setMessageError={state.setMessageError}
        setMessageText={state.setMessageText}
        setOfferText={state.setOfferText}
        setShowAcceptModal={state.setShowAcceptModal}
        showAcceptModal={state.showAcceptModal}
      />
    </View>
  );
}
