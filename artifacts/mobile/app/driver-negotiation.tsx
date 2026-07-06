import { AppText } from '@/components/AppText';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Platform, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { AppButton } from '@/components/AppButton';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ProfileAvatarCircle } from '@/components/ProfileAvatarCircle';
import { NegotiationStatusCard } from '@/components/negotiation/NegotiationStatusCard';
import { NegotiationTimeline } from '@/components/negotiation/NegotiationTimeline';
import { INPUT_DOCK_HEIGHT, MAX_OFFERS, WARNING } from '@/components/negotiation/negotiationUtils';
import { formatFare } from '@/components/negotiation/negotiationUtils';
import { styles } from '@/components/negotiation/negotiationStyles';
import { useRide } from '@/context/RideContext';
import { useColors } from '@/hooks/useColors';
import { useDriverNegotiationState } from '@/hooks/negotiation/useDriverNegotiationState';
import { useDriverNegotiationActions } from '@/hooks/negotiation/useDriverNegotiationActions';
import { VEHICLE_LABELS } from '@/types';
import { icons } from '@/constants/icons';
import { spacing } from '@/constants/spacing';

export default function DriverNegotiationScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { currentRide, sendDriverOffer, acceptCustomerOffer, cancelRide, riderAcceptWithFare } = useRide();

  const state = useDriverNegotiationState(currentRide);
  const actions = useDriverNegotiationActions({
    canSendOffer: state.canSendOffer,
    sendDriverOffer,
    cancelRide,
    currentRide,
    offerText: state.offerText,
    setOfferText: state.setOfferText,
  });

  if (!currentRide) return null;

  const footerBottomInset = insets.bottom + (Platform.OS === 'web' ? 24 : 6);
  const scrollBottomInset =
    state.actionPanelOffset + (state.canSendOffer ? INPUT_DOCK_HEIGHT : 0) + 12;

  const customerInitial = (currentRide.customerName ?? 'C').charAt(0).toUpperCase();
  const destinationIsGeneric = currentRide.destination.locationType === 'generic';
  const dropoffAccent = destinationIsGeneric ? WARNING : colors.destructive;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={[
          styles.page,
          { paddingTop: insets.top + (Platform.OS === 'web' ? 67 : spacing[0]) + spacing[14] },
        ]}
      >
        {/* Header */}
        <View style={[styles.topSection]}>
          <View style={styles.header}>
            <View style={styles.identityRow}>
              <ProfileAvatarCircle
                size={46}
                initial={customerInitial}
                imageUri={currentRide.customerImage ?? null}
              />
              <View style={styles.identityText}>
                <AppText style={[styles.title, { color: colors.foreground }]}>
                  {currentRide.customerName ?? 'Customer'}
                </AppText>
                <View style={styles.subtitleRow}>
                  <AppText style={[styles.subtitle, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {VEHICLE_LABELS[currentRide.vehicleType]}
                  </AppText>
                  {currentRide.customerRating != null && (
                    <View style={styles.ratingRow}>
                      <MaterialCommunityIcons name="star" size={13} color={colors.star} />
                      <AppText style={[styles.ratingText, { color: colors.star }]}>
                        {currentRide.customerRating.toFixed(1)}
                      </AppText>
                    </View>
                  )}
                </View>
              </View>
            </View>
          </View>

          {/* Trip summary card */}
          <View style={[styles.tripSummaryCard, { backgroundColor: colors.card }]}>
            <View style={styles.tripRoute}>
              <View style={styles.tripRouteTrack}>
                <View style={[styles.tripDot, { backgroundColor: colors.primary }]} />
                <View style={[styles.tripConnector, { backgroundColor: colors.border }]} />
                <View style={[styles.tripDot, styles.tripDotSquare, { backgroundColor: dropoffAccent }]} />
              </View>
              <View style={styles.tripStops}>
                <View style={styles.tripStop}>
                  <AppText style={[styles.tripStopLabel, { color: colors.mutedForeground }]}>Pickup</AppText>
                  <AppText style={[styles.tripStopValue, { color: colors.foreground }]} numberOfLines={1}>
                    {currentRide.pickup.address ?? 'Pickup location'}
                  </AppText>
                </View>
                <View style={styles.tripStop}>
                  <AppText style={[styles.tripStopLabel, { color: colors.mutedForeground }]}>Drop off</AppText>
                  <AppText style={[styles.tripStopValue, { color: colors.foreground }]} numberOfLines={1}>
                    {destinationIsGeneric
                      ? (currentRide.destination.address?.trim() || 'To be confirmed in chat')
                      : (currentRide.destination.address ?? 'Destination')}
                  </AppText>
                </View>
              </View>
            </View>
            {destinationIsGeneric && (
              <View style={[styles.tripGenericNote, { backgroundColor: WARNING + '14' }]}>
                <Feather name="info" size={icons.size.xxs} color={WARNING} />
                <AppText style={[styles.tripGenericText, { color: WARNING }]} numberOfLines={1}>
                  Confirm exact drop off with customer before locking fare
                </AppText>
              </View>
            )}
            <View style={[styles.tripStatsRow, { borderTopColor: colors.border }]}>
              <View style={styles.tripStatInline}>
                <Feather name="navigation" size={icons.size.xxs} color={colors.primary} />
                <AppText style={[styles.tripStatLabel, { color: colors.mutedForeground }]}>Distance</AppText>
                <AppText style={[styles.tripStatValue, { color: colors.foreground }]}>{currentRide.distance.toFixed(1)} km</AppText>
              </View>
              <View style={styles.tripStatInline}>
                <Feather name="clock" size={icons.size.xxs} color={colors.primary} />
                <AppText style={[styles.tripStatLabel, { color: colors.mutedForeground }]}>ETA</AppText>
                <AppText style={[styles.tripStatValue, { color: colors.foreground }]}>~{currentRide.duration} min</AppText>
              </View>
            </View>
          </View>

          <NegotiationStatusCard
            tone={state.chatStatus.tone}
            title={state.chatStatus.title}
            hint={state.chatStatus.hint}
            offersSent={state.messagesUsed}
            maxOffers={MAX_OFFERS}
            offersRemaining={state.offersRemaining}
          />
        </View>

        <NegotiationTimeline
          bottomInset={scrollBottomInset}
          negotiation={state.negotiation}
          pendingOfferMessage={null}
          scrollRef={state.scrollRef}
          showDriverTyping={state.showCustomerTyping}
          perspective="driver"
        />
      </View>

      {/* Input dock + action panel */}
      <View style={styles.bottomChrome}>
        {state.canSendOffer && (
          <KeyboardStickyView
            offset={{ closed: 0, opened: state.actionPanelOffset }}
            style={[styles.inputDock, { backgroundColor: colors.background }]}
          >
            <View style={styles.inputRow}>
              <View style={[styles.currencyBadge, { backgroundColor: colors.muted }]}>
                <AppText style={[styles.currencyText, { color: colors.foreground }]}>RWF</AppText>
              </View>
              <TextInput
                style={[
                  styles.offerInput,
                  !state.offerText && styles.offerInputPlaceholder,
                  { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card },
                ]}
                value={state.offerText}
                onChangeText={text => state.setOfferText(text.replace(/\D/g, ''))}
                placeholder={state.offerPlaceholder}
                placeholderTextColor={colors.mutedForeground}
                keyboardType="number-pad"
              />
              <TouchableOpacity
                style={[styles.sendBtn, { backgroundColor: state.offerText ? colors.primary : colors.muted }]}
                onPress={actions.handleSendOffer}
                disabled={!state.offerText}
                accessibilityLabel="Send offer"
                accessibilityRole="button"
              >
                <Feather name="send" size={icons.semantic.row} color={state.offerText ? colors.primaryForeground : colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          </KeyboardStickyView>
        )}

        <View
          style={[styles.actionPanel, { backgroundColor: colors.background }]}
          onLayout={event => state.setActionPanelHeight(event.nativeEvent.layout.height)}
        >
          {state.driverLimitReached && (
            <View style={[styles.limitBanner, { backgroundColor: colors.primaryHex + '14' }]}>
              <Feather name="phone-call" size={15} color={colors.primary} />
              <AppText style={[styles.limitText, { color: colors.foreground }]}>
                Offer limit reached. Call the customer to continue.
              </AppText>
            </View>
          )}
          <View style={[styles.mainActions, { paddingBottom: footerBottomInset }]}>
            <AppButton title="Decline" icon="x" variant="decline" size="sm" compact onPress={actions.handleDecline} style={styles.actionFlexNarrow} />
            <AppButton title="Call" icon="phone" variant="call" size="sm" compact onPress={actions.handleCall} style={state.driverLimitReached ? styles.actionFlexWide : styles.actionFlexNarrow} />
            <AppButton
              title={state.lastCustomerOffer ? 'Accept fare' : 'Waiting'}
              icon="check"
              variant="primary"
              size="sm"
              compact
              onPress={() => state.setShowAcceptModal(true)}
              disabled={!state.lastCustomerOffer}
              style={styles.actionFlexPrimary}
            />
          </View>
        </View>
      </View>

      {/* Accept fare modal */}
      <ConfirmDialog
        visible={state.showAcceptModal}
        onClose={() => state.setShowAcceptModal(false)}
        cardStyle={styles.acceptFareDialogCard}
      >
        <View style={[styles.modalIcon, { backgroundColor: colors.primaryHex + '20' }]}>
          <Feather name="shield" size={icons.size.xl} color={colors.primary} />
        </View>
        <AppText style={[styles.modalTitle, { color: colors.foreground }]}>
          Accept {formatFare(state.lastCustomerOffer?.amount)}?
        </AppText>
        <AppText style={[styles.modalSub, { color: colors.mutedForeground }]}>
          This fare will be locked for the ride and visible to both you and the customer.
        </AppText>
        <View style={[styles.acceptSummary, { backgroundColor: colors.muted }]}>
          {[
            ['Customer', currentRide.customerName ?? 'Customer'],
            ['Pickup', currentRide.pickup.address ?? 'Pickup'],
            ['Drop off', currentRide.destination.address ?? 'Destination'],
          ].map(([label, value]) => (
            <View key={label} style={styles.acceptSummaryRow}>
              <AppText style={[styles.acceptSummaryLabel, { color: colors.mutedForeground }]}>{label}</AppText>
              <AppText style={[styles.acceptSummaryValue, { color: colors.foreground }]} numberOfLines={1}>{value}</AppText>
            </View>
          ))}
          <View style={[styles.acceptSummaryRow, styles.acceptSummaryTotal, { borderTopColor: colors.border }]}>
            <AppText style={[styles.acceptSummaryLabel, { color: colors.mutedForeground }]}>Final fare</AppText>
            <AppText style={[styles.acceptSummaryAmount, { color: colors.primary }]}>{formatFare(state.lastCustomerOffer?.amount)}</AppText>
          </View>
        </View>
        <View style={styles.modalActions}>
          <AppButton title="Back" variant="secondary" size="md" onPress={() => state.setShowAcceptModal(false)} style={styles.modalActionBtn} />
          <AppButton
            title="Accept Fare"
            variant="primary"
            size="md"
            onPress={() => {
              state.setShowAcceptModal(false);
              acceptCustomerOffer();
            }}
            style={styles.modalActionBtn}
          />
        </View>
      </ConfirmDialog>
    </View>
  );
}
