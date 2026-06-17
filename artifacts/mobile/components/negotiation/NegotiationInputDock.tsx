import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { AppButton } from '@/components/AppButton';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useColors } from '@/hooks/useColors';
import type { NegotiationMessage, Ride } from '@/types';
import { formatFare } from './negotiationUtils';
import { styles } from './negotiationStyles';

export function NegotiationInputDock({
  acceptDriverOffer,
  actionPanelOffset,
  canAccept,
  canCounter,
  counterLoading,
  customerLimitReached,
  footerBottomInset,
  handleCall,
  handleDecline,
  handleSendCounter,
  handleSendText,
  lastDriverOffer,
  offerPlaceholder,
  offerText,
  ride,
  setActionPanelHeight,
  setOfferText,
  setShowAcceptModal,
  showAcceptModal,
}: {
  acceptDriverOffer: () => void;
  actionPanelOffset: number;
  canAccept: boolean;
  canCounter: boolean;
  counterLoading: boolean;
  customerLimitReached: boolean;
  footerBottomInset: number;
  handleCall: () => void;
  handleDecline: () => void;
  handleSendCounter: () => void;
  handleSendText?: (text: string) => void;
  lastDriverOffer: NegotiationMessage | undefined;
  offerPlaceholder: string;
  offerText: string;
  ride: Ride;
  setActionPanelHeight: (height: number) => void;
  setOfferText: (text: string) => void;
  setShowAcceptModal: (show: boolean) => void;
  showAcceptModal: boolean;
}) {
  const colors = useColors();
  const [inputMode, setInputMode] = useState<'offer' | 'text'>('offer');
  const [messageText, setMessageText] = useState('');
  const showInput = canCounter || (handleSendText && inputMode === 'text');

  return (
    <>
      <View style={styles.bottomChrome}>
        {showInput && (
          <KeyboardStickyView
            offset={{ closed: 0, opened: actionPanelOffset }}
            style={[styles.inputDock, { backgroundColor: colors.background }]}
          >
            <View style={styles.inputRow}>
              {inputMode === 'offer' ? (
                <>
                  <View style={[styles.currencyBadge, { backgroundColor: colors.muted }]}>
                    <Text style={[styles.currencyText, { color: colors.foreground }]}>RWF</Text>
                  </View>
                  <TextInput
                    style={[
                      styles.offerInput,
                      !offerText && styles.offerInputPlaceholder,
                      { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card },
                    ]}
                    value={offerText}
                    onChangeText={text => setOfferText(text.replace(/\D/g, ''))}
                    placeholder={offerPlaceholder}
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="number-pad"
                  />
                </>
              ) : (
                <TextInput
                  style={[
                    styles.offerInput,
                    { flex: 1, color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card },
                  ]}
                  value={messageText}
                  onChangeText={setMessageText}
                  placeholder="Type a message…"
                  placeholderTextColor={colors.mutedForeground}
                  maxLength={500}
                />
              )}
              {handleSendText && (
                <TouchableOpacity
                  style={[styles.sendBtn, { backgroundColor: colors.muted }]}
                  onPress={() => setInputMode(prev => prev === 'offer' ? 'text' : 'offer')}
                  accessibilityLabel={inputMode === 'offer' ? 'Switch to message' : 'Switch to offer'}
                >
                  <Feather name={inputMode === 'offer' ? 'message-circle' : 'dollar-sign'} size={18} color={colors.foreground} />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.sendBtn, { backgroundColor: (inputMode === 'offer' ? offerText : messageText) ? colors.primary : colors.muted }]}
                onPress={() => {
                  if (inputMode === 'text' && handleSendText && messageText.trim()) {
                    handleSendText(messageText.trim());
                    setMessageText('');
                  } else {
                    handleSendCounter();
                  }
                }}
                disabled={inputMode === 'offer' ? (!offerText || counterLoading) : !messageText.trim()}
                accessibilityLabel={inputMode === 'offer' ? 'Send offer' : 'Send message'}
                accessibilityRole="button"
              >
                {counterLoading && inputMode === 'offer' ? (
                  <ActivityIndicator size="small" color={colors.primaryForeground} />
                ) : (
                  <Feather name="send" size={18} color={(inputMode === 'offer' ? offerText : messageText.trim()) ? colors.primaryForeground : colors.mutedForeground} />
                )}
              </TouchableOpacity>
            </View>
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
              title={lastDriverOffer ? 'Accept fare' : 'Waiting'}
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
