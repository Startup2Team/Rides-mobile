import { Feather } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { AppButton } from '@/components/AppButton';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useColors } from '@/hooks/useColors';
import type { NegotiationMessage, Ride } from '@/types';
import { formatFare, MAX_NEGOTIATION_MESSAGE_LENGTH } from './negotiationUtils';
import { styles } from './negotiationStyles';

export function NegotiationInputDock({
  acceptDriverOffer,
  actionPanelOffset,
  canAccept,
  canCounter,
  canSendMessage,
  counterLoading,
  customerLimitReached,
  fareError,
  footerBottomInset,
  handleCall,
  handleDecline,
  handleSendCounter,
  handleSendMessage,
  lastDriverOffer,
  messageError,
  messageSending,
  messageText,
  offerPlaceholder,
  offerText,
  ride,
  setActionPanelHeight,
  setFareError,
  setMessageError,
  setMessageText,
  setOfferText,
  setShowAcceptModal,
  showAcceptModal,
}: {
  acceptDriverOffer: () => void;
  actionPanelOffset: number;
  canAccept: boolean;
  canCounter: boolean;
  canSendMessage: boolean;
  counterLoading: boolean;
  customerLimitReached: boolean;
  fareError: string | null;
  footerBottomInset: number;
  handleCall: () => void;
  handleDecline: () => void;
  handleSendCounter: () => void;
  handleSendMessage: () => void;
  lastDriverOffer: NegotiationMessage | undefined;
  messageError: string | null;
  messageSending: boolean;
  messageText: string;
  offerPlaceholder: string;
  offerText: string;
  ride: Ride;
  setActionPanelHeight: (height: number) => void;
  setFareError: (message: string | null) => void;
  setMessageError: (message: string | null) => void;
  setMessageText: (text: string) => void;
  setOfferText: (text: string) => void;
  setShowAcceptModal: (show: boolean) => void;
  showAcceptModal: boolean;
}) {
  const colors = useColors();
  return (
    <>
      <View style={styles.bottomChrome}>
        {(canCounter || canSendMessage) && (
          <KeyboardStickyView
            offset={{ closed: 0, opened: actionPanelOffset }}
            style={[styles.inputDock, { backgroundColor: colors.background }]}
          >
            {canCounter && (
              <>
                <View style={styles.inputRow}>
                  <View style={[styles.currencyBadge, { backgroundColor: colors.muted }]}>
                    <Text style={[styles.currencyText, { color: colors.foreground }]}>RWF</Text>
                  </View>
                  <TextInput
                    style={[
                      styles.offerInput,
                      !offerText && styles.offerInputPlaceholder,
                      {
                        color: colors.foreground,
                        borderColor: fareError ? colors.destructive : colors.border,
                        backgroundColor: colors.card,
                      },
                    ]}
                    value={offerText}
                    onChangeText={text => {
                      setOfferText(text.replace(/\D/g, ''));
                      if (fareError) setFareError(null);
                    }}
                    placeholder={offerPlaceholder}
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="number-pad"
                    accessibilityLabel="Your fare offer in RWF"
                  />
                  <TouchableOpacity
                    style={[styles.sendBtn, { backgroundColor: offerText ? colors.primary : colors.muted }]}
                    onPress={handleSendCounter}
                    disabled={!offerText || counterLoading}
                    accessibilityLabel="Send offer"
                    accessibilityRole="button"
                  >
                    {counterLoading ? (
                      <ActivityIndicator size="small" color={colors.primaryForeground} />
                    ) : (
                      <Feather name="send" size={18} color={offerText ? colors.primaryForeground : colors.mutedForeground} />
                    )}
                  </TouchableOpacity>
                </View>
                {fareError ? (
                  <Text
                    style={[styles.fareErrorText, { color: colors.destructive }]}
                    accessibilityRole="alert"
                  >
                    {fareError}
                  </Text>
                ) : null}
              </>
            )}

            {canSendMessage && (
              <>
                <View style={[styles.inputRow, canCounter && styles.messageRowSpacing]}>
                  <TextInput
                    style={[
                      styles.messageInput,
                      {
                        color: colors.foreground,
                        borderColor: messageError ? colors.destructive : colors.border,
                        backgroundColor: colors.card,
                      },
                    ]}
                    value={messageText}
                    onChangeText={text => {
                      setMessageText(text.slice(0, MAX_NEGOTIATION_MESSAGE_LENGTH));
                      if (messageError) setMessageError(null);
                    }}
                    // TODO(i18n)
                    placeholder="Message the driver"
                    placeholderTextColor={colors.mutedForeground}
                    multiline
                    maxLength={MAX_NEGOTIATION_MESSAGE_LENGTH}
                    editable={!messageSending}
                    // TODO(i18n)
                    accessibilityLabel="Message to driver"
                    // TODO(i18n)
                    accessibilityHint="Type a message to send to your driver during negotiation"
                  />
                  <TouchableOpacity
                    style={[styles.sendBtn, { backgroundColor: messageText.trim() ? colors.primary : colors.muted }]}
                    onPress={handleSendMessage}
                    disabled={!messageText.trim() || messageSending}
                    // TODO(i18n)
                    accessibilityLabel="Send message"
                    accessibilityRole="button"
                  >
                    {messageSending ? (
                      <ActivityIndicator size="small" color={colors.primaryForeground} />
                    ) : (
                      <Feather
                        name="message-circle"
                        size={18}
                        color={messageText.trim() ? colors.primaryForeground : colors.mutedForeground}
                      />
                    )}
                  </TouchableOpacity>
                </View>
                {messageError ? (
                  <Text
                    style={[styles.fareErrorText, { color: colors.destructive }]}
                    accessibilityRole="alert"
                  >
                    {messageError}
                  </Text>
                ) : null}
              </>
            )}
          </KeyboardStickyView>
        )}

        <View
          style={[styles.actionPanel, { backgroundColor: colors.background }]}
          onLayout={event => setActionPanelHeight(event.nativeEvent.layout.height)}
        >
          {customerLimitReached && (
            <View style={[styles.limitBanner, { backgroundColor: colors.primaryHex + '14' }]}>
              <Feather name="phone-call" size={15} color={colors.primary} />
              <Text style={[styles.limitText, { color: colors.foreground }]}>
                Offer limit reached. Call the driver to continue.
              </Text>
            </View>
          )}
          <View style={[styles.mainActions, { paddingBottom: footerBottomInset }]}>
            <AppButton title="Decline" icon="x" variant="decline" size="sm" compact onPress={handleDecline} style={styles.actionFlexNarrow} />
            <AppButton
              title="Call"
              icon="phone"
              variant="call"
              size="sm"
              compact
              onPress={handleCall}
              style={customerLimitReached ? styles.actionFlexWide : styles.actionFlexNarrow}
            />
            <AppButton
              title={canAccept ? 'Accept fare' : 'Waiting'}
              icon="check"
              variant="primary"
              size="sm"
              compact
              onPress={() => setShowAcceptModal(true)}
              disabled={!canAccept}
              style={styles.actionFlexPrimary}
            />
          </View>
        </View>
      </View>

      <ConfirmDialog
        visible={showAcceptModal}
        onClose={() => setShowAcceptModal(false)}
        cardStyle={styles.acceptFareDialogCard}
      >
        <View style={[styles.modalIcon, { backgroundColor: colors.primaryHex + '20' }]}>
          <Feather name="shield" size={24} color={colors.primary} />
        </View>
        <Text style={[styles.modalTitle, { color: colors.foreground }]}>Accept {formatFare(lastDriverOffer?.amount)}?</Text>
        <Text style={[styles.modalSub, { color: colors.mutedForeground }]}>
          This fare will be locked for the ride and visible to both you and the driver.
        </Text>
        <View style={[styles.acceptSummary, { backgroundColor: colors.muted }]}>
          {[
            ['Driver', ride.driver?.name ?? 'Driver'],
            ['Pickup', ride.pickup.address ?? 'Pickup'],
            ['Dropoff', ride.destination.address ?? 'Destination'],
          ].map(([label, value]) => (
            <View key={label} style={styles.acceptSummaryRow}>
              <Text style={[styles.acceptSummaryLabel, { color: colors.mutedForeground }]}>{label}</Text>
              <Text style={[styles.acceptSummaryValue, { color: colors.foreground }]} numberOfLines={1}>{value}</Text>
            </View>
          ))}
          <View style={[styles.acceptSummaryRow, styles.acceptSummaryTotal, { borderTopColor: colors.border }]}>
            <Text style={[styles.acceptSummaryLabel, { color: colors.mutedForeground }]}>Final fare</Text>
            <Text style={[styles.acceptSummaryAmount, { color: colors.primary }]}>{formatFare(lastDriverOffer?.amount)}</Text>
          </View>
        </View>
        <View style={styles.modalActions}>
          <AppButton title="Back" variant="secondary" size="md" onPress={() => setShowAcceptModal(false)} style={styles.modalActionBtn} />
          <AppButton
            title="Accept Fare"
            variant="primary"
            size="md"
            onPress={() => {
              setShowAcceptModal(false);
              acceptDriverOffer();
            }}
            style={styles.modalActionBtn}
          />
        </View>
      </ConfirmDialog>
    </>
  );
}
