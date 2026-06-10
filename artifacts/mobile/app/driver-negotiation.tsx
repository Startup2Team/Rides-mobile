import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { AppButton } from '@/components/AppButton';
import { useRide } from '@/context/RideContext';
import { useColors } from '@/hooks/useColors';
import { NegotiationMessage, VEHICLE_LABELS } from '@/types';

const MAX_OFFERS = 3;
const WARNING = '#FF9500';

function formatFare(amount?: number) {
  return amount ? `${amount.toLocaleString()} RWF` : '--';
}

function OfferTimelineItem({
  msg,
  perspective,
}: {
  msg: NegotiationMessage;
  perspective: 'customer' | 'driver';
}) {
  const colors = useColors();
  const isCustomer = msg.sender === 'customer';
  const isDriver = msg.sender === 'driver';
  const isSystem = msg.sender === 'system';
  const label = msg.sender === 'system'
    ? 'Trip note'
    : isCustomer
      ? perspective === 'customer' ? 'You' : 'Customer'
      : perspective === 'driver' ? 'You' : 'Driver';
  const bubbleBackground = isCustomer ? colors.primary : colors.card;
  const textColor = isCustomer ? colors.primaryForeground : colors.foreground;
  const metaColor = isCustomer ? colors.primaryForeground + 'CC' : colors.mutedForeground;

  return (
    <View style={[
      styles.timelineItem,
      isDriver && styles.timelineLeftItem,
      isCustomer && styles.timelineRightItem,
      isSystem && styles.timelineSystemItem,
    ]}>
      <View style={[
        styles.timelineCard,
        isCustomer && styles.timelineCustomerCard,
        isDriver && styles.timelineDriverCard,
        isSystem && styles.timelineSystemCard,
        { backgroundColor: isSystem ? colors.card : bubbleBackground },
      ]}>
        <View style={styles.timelineHeader}>
          <Text style={[styles.timelineActor, { color: isSystem ? colors.mutedForeground : metaColor }]}>{label}</Text>
          {msg.isFinal && (
            <View style={[styles.lockedBadge, { backgroundColor: isCustomer ? 'rgba(255,255,255,0.18)' : colors.primaryHex + '20' }]}>
              <Feather name="lock" size={11} color={isCustomer ? colors.primaryForeground : colors.primary} />
              <Text style={[styles.lockedText, { color: isCustomer ? colors.primaryForeground : colors.primary }]}>Locked</Text>
            </View>
          )}
        </View>
        {msg.type === 'offer' ? (
          <Text style={[styles.timelineAmount, { color: isSystem ? colors.foreground : textColor }]}>
            {formatFare(msg.amount)}
          </Text>
        ) : (
          <Text style={[styles.timelineText, { color: isSystem ? colors.foreground : textColor }]}>{msg.text}</Text>
        )}
      </View>
    </View>
  );
}

export default function DriverNegotiationScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { currentRide, sendDriverOffer, acceptCustomerOffer, cancelRide, riderAcceptWithFare } = useRide();

  const [offerText, setOfferText] = useState('');
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualAmount, setManualAmount] = useState('');
  const [manualError, setManualError] = useState('');

  const negotiation = currentRide?.negotiation ?? [];
  const driverOffers = negotiation.filter(m => m.sender === 'driver' && m.type === 'offer');
  const customerOffers = negotiation.filter(m => m.sender === 'customer' && m.type === 'offer');
  const lastDriverOffer = [...driverOffers].pop();
  const lastCustomerOffer = [...customerOffers].pop();
  const lastOffer = [...negotiation].reverse().find(m => m.type === 'offer');
  const driverLimitReached = driverOffers.length >= MAX_OFFERS;
  const canSendOffer = !driverLimitReached;
  const suggestedFare = currentRide?.suggestedFare ?? 0;
  const acceptAmount = lastCustomerOffer?.amount;

  const sendOffer = (amount: number) => {
    if (!amount || amount <= 0 || !canSendOffer) return;
    setOfferText('');
    sendDriverOffer(amount);
  };

  const handleSendOffer = () => {
    sendOffer(parseInt(offerText.replace(/\D/g, ''), 10));
  };

  const handleCall = () => {
    const phone = currentRide?.customerPhone ?? '';
    if (!phone) return;
    Linking.openURL(`tel:${phone}`).catch(() => {
      Alert.alert('Cannot call', 'Unable to open the phone dialler.');
    });
  };

  const handleDecline = () => {
    Alert.alert('Decline ride', 'Decline this negotiation? The request will return to the pool.', [
      { text: 'Decline', onPress: () => { cancelRide(); router.replace('/(driver)'); } },
      { text: 'Back', style: 'cancel' },
    ]);
  };

  const confirmManualFare = () => {
    const amount = parseInt(manualAmount.replace(/\D/g, ''), 10);
    if (isNaN(amount) || amount <= 0) {
      setManualError('Please enter a valid amount');
      return;
    }
    setShowManualModal(false);
    riderAcceptWithFare(amount);
  };

  if (!currentRide) return null;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 0) + 14 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={styles.identityRow}>
            <View style={[styles.avatar, { backgroundColor: colors.muted }]}>
              <Feather name="user" size={22} color={colors.foreground} />
            </View>
            <View style={styles.identityText}>
              <Text style={[styles.title, { color: colors.foreground }]}>
                {currentRide.customerName ?? 'Customer'}
              </Text>
              <Text style={[styles.subtitle, { color: colors.mutedForeground }]} numberOfLines={1}>
                {VEHICLE_LABELS[currentRide.vehicleType]} request · {currentRide.distance} km · {currentRide.duration} min
              </Text>
            </View>
          </View>
          <TouchableOpacity style={[styles.iconButton, { backgroundColor: colors.call }]} onPress={handleCall}>
            <Feather name="phone" size={19} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View style={[styles.summaryCard, { backgroundColor: colors.card }]}>
          <View style={styles.routeRow}>
            <View style={[styles.routeDot, { backgroundColor: colors.primary }]} />
            <Text style={[styles.routeText, { color: colors.foreground }]} numberOfLines={1}>
              {currentRide.pickup.address ?? 'Pickup'}
            </Text>
          </View>
          <View style={[styles.routeLine, { backgroundColor: colors.border }]} />
          <View style={styles.routeRow}>
            <View style={[styles.routeDot, { backgroundColor: currentRide.destination.locationType === 'generic' ? WARNING : colors.destructive }]} />
            <Text style={[styles.routeText, { color: colors.foreground }]} numberOfLines={1}>
              {currentRide.destination.locationType === 'generic'
                ? `${currentRide.destination.address ?? 'Unknown'} (to confirm)`
                : currentRide.destination.address ?? 'Destination'}
            </Text>
          </View>
          {currentRide.destination.locationType === 'generic' && (
            <View style={[styles.genericBadge, { backgroundColor: WARNING + '16' }]}>
              <Feather name="alert-circle" size={14} color={WARNING} />
              <Text style={[styles.genericText, { color: WARNING }]}>Confirm exact destination before locking fare.</Text>
            </View>
          )}
          <View style={[styles.metaGrid, { borderTopColor: colors.border }]}>
            <View style={styles.metaItem}>
              <Text style={[styles.metaLabel, { color: colors.mutedForeground }]}>Your offers</Text>
              <Text style={[styles.metaValue, { color: colors.foreground }]}>{driverOffers.length}/{MAX_OFFERS}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={[styles.metaLabel, { color: colors.mutedForeground }]}>Customer</Text>
              <Text style={[styles.metaValue, { color: colors.foreground }]}>{customerOffers.length}/{MAX_OFFERS}</Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Offer timeline</Text>
          <Text style={[styles.offerCount, { color: driverLimitReached ? colors.destructive : colors.mutedForeground }]}>
            {driverOffers.length}/{MAX_OFFERS} offers sent
          </Text>
        </View>

        <View style={styles.timeline}>
          {negotiation.length === 0 ? (
            <Text style={[styles.emptyTimeline, { color: colors.mutedForeground }]}>
              Send your fare offer to begin negotiation.
            </Text>
          ) : (
            negotiation.map(msg => <OfferTimelineItem key={msg.id} msg={msg} perspective="driver" />)
          )}
        </View>
      </ScrollView>

      <View style={[styles.actionPanel, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 10) }]}>
        {driverLimitReached && (
          <View style={[styles.limitBanner, { backgroundColor: colors.destructiveHex + '12' }]}>
            <Feather name="alert-circle" size={15} color={colors.destructive} />
            <Text style={[styles.limitText, { color: colors.destructive }]}>Offer limit reached. Use Call to continue.</Text>
          </View>
        )}

        {canSendOffer && (
          <View style={styles.inputRow}>
            <View style={[styles.currencyBadge, { backgroundColor: colors.muted }]}>
              <Text style={[styles.currencyText, { color: colors.foreground }]}>RWF</Text>
            </View>
            <TextInput
              style={[styles.offerInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
              value={offerText}
              onChangeText={text => setOfferText(text.replace(/\D/g, ''))}
              placeholder={lastDriverOffer ? 'Adjust your offer' : 'Your fare offer'}
              placeholderTextColor={colors.mutedForeground}
              keyboardType="number-pad"
            />
            <TouchableOpacity style={[styles.sendBtn, { backgroundColor: offerText ? colors.primary : colors.muted }]} onPress={handleSendOffer} disabled={!offerText}>
              <Feather name="send" size={18} color={offerText ? colors.primaryForeground : colors.mutedForeground} />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.mainActions}>
          <AppButton
            title="Decline"
            icon="x"
            variant="dangerPlain"
            size="sm"
            onPress={handleDecline}
            style={styles.actionFlexNarrow}
          />
          <AppButton
            title="Call"
            icon="phone"
            variant="call"
            size="sm"
            onPress={handleCall}
            style={styles.actionFlexNarrow}
          />
          <AppButton
            title="Accept"
            icon="check"
            variant="primary"
            size="sm"
            onPress={() => setShowAcceptModal(true)}
            disabled={!acceptAmount}
            style={styles.actionFlexPrimary}
          />
        </View>
        <AppButton
          title="Lock manually agreed fare"
          icon="lock"
          variant="plain"
          size="sm"
          fullWidth
          onPress={() => {
            setManualAmount((lastOffer?.amount ?? suggestedFare).toString());
            setManualError('');
            setShowManualModal(true);
          }}
        />
      </View>

      <ConfirmDialog
        visible={showAcceptModal}
        onClose={() => setShowAcceptModal(false)}
        cardStyle={styles.acceptFareDialogCard}
      >
        <View style={[styles.modalIcon, { backgroundColor: colors.primaryHex + '20' }]}>
          <Feather name="shield" size={24} color={colors.primary} />
        </View>
        <Text style={[styles.modalTitle, { color: colors.foreground }]}>Accept {formatFare(acceptAmount)}?</Text>
        <Text style={[styles.modalSub, { color: colors.mutedForeground }]}>
          This fare will be locked for the ride and visible to both you and the customer.
        </Text>
        <View style={styles.modalActions}>
          <AppButton
            title="Back"
            variant="secondary"
            size="md"
            onPress={() => setShowAcceptModal(false)}
            style={styles.modalActionBtn}
          />
          <AppButton
            title="Accept Fare"
            variant="primary"
            size="md"
            onPress={() => {
              setShowAcceptModal(false);
              acceptCustomerOffer();
            }}
            style={styles.modalActionBtn}
          />
        </View>
      </ConfirmDialog>

      <ConfirmDialog visible={showManualModal} onClose={() => setShowManualModal(false)}>
        <Text style={[styles.modalTitle, { color: colors.foreground }]}>Final agreed fare</Text>
        <Text style={[styles.modalSub, { color: colors.mutedForeground }]}>
          Use this only after confirming the amount with the customer.
        </Text>
        <View style={[styles.modalInputRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
          <Text style={[styles.currencyText, { color: colors.mutedForeground }]}>RWF</Text>
          <TextInput
            style={[styles.modalInput, { color: colors.foreground }]}
            value={manualAmount}
            onChangeText={text => { setManualAmount(text.replace(/\D/g, '')); setManualError(''); }}
            placeholder="e.g. 2500"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="number-pad"
            autoFocus
          />
        </View>
        {manualError ? <Text style={[styles.errorText, { color: colors.destructive }]}>{manualError}</Text> : null}
        <View style={styles.modalActions}>
          <AppButton
            title="Back"
            variant="secondary"
            size="md"
            onPress={() => setShowManualModal(false)}
            style={styles.modalActionBtn}
          />
          <AppButton
            title="Lock Fare"
            variant="primary"
            size="md"
            onPress={confirmManualFare}
            style={styles.modalActionBtn}
          />
        </View>
      </ConfirmDialog>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 18, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  identityRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  identityText: { flex: 1, minWidth: 0 },
  title: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  subtitle: { fontSize: 12, fontFamily: 'Inter_500Medium', marginTop: 2 },
  iconButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  statusBanner: { minHeight: 46, borderRadius: 14, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusText: { flex: 1, fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  summaryCard: { borderRadius: 16, padding: 14, gap: 8 },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  routeDot: { width: 10, height: 10, borderRadius: 5 },
  routeLine: { width: 1, height: 14, marginLeft: 4 },
  routeText: { flex: 1, fontSize: 14, fontFamily: 'Inter_500Medium' },
  genericBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, padding: 10, marginTop: 6 },
  genericText: { flex: 1, fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  metaGrid: { borderTopWidth: 1, marginTop: 8, paddingTop: 12, flexDirection: 'row', gap: 8 },
  metaItem: { flex: 1, gap: 2 },
  metaLabel: { fontSize: 10, fontFamily: 'Inter_700Bold', textTransform: 'uppercase' },
  metaValue: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  offerCard: { borderRadius: 18, padding: 18, gap: 6 },
  offerLabel: { fontSize: 11, fontFamily: 'Inter_700Bold', textTransform: 'uppercase' },
  offerAmount: { fontSize: 34, fontFamily: 'Inter_700Bold' },
  trustCopy: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  offerCount: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  timeline: { gap: 10 },
  emptyTimeline: { fontSize: 13, fontFamily: 'Inter_500Medium', textAlign: 'center', paddingVertical: 20 },
  timelineItem: { flexDirection: 'row' },
  timelineLeftItem: { justifyContent: 'flex-start', paddingRight: 46 },
  timelineRightItem: { justifyContent: 'flex-end', paddingLeft: 46 },
  timelineSystemItem: { justifyContent: 'center' },
  timelineCard: { maxWidth: '84%', borderRadius: 18, padding: 12, gap: 4 },
  timelineCustomerCard: { borderTopRightRadius: 6 },
  timelineDriverCard: { borderTopLeftRadius: 6 },
  timelineSystemCard: { flex: 0, width: '86%', alignSelf: 'center' },
  timelineHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timelineActor: { fontSize: 11, fontFamily: 'Inter_700Bold', textTransform: 'uppercase' },
  timelineAmount: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  timelineText: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 19 },
  lockedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3 },
  lockedText: { fontSize: 10, fontFamily: 'Inter_700Bold' },
  actionPanel: { borderTopWidth: 1, padding: 14, gap: 12 },
  limitBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 12 },
  limitText: { flex: 1, fontSize: 12, fontFamily: 'Inter_500Medium' },
  quickRow: { flexDirection: 'row', gap: 8 },
  quickChip: { flex: 1, minHeight: 38, borderRadius: 19, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  quickText: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  currencyBadge: { height: 48, paddingHorizontal: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  currencyText: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  offerInput: { flex: 1, height: 48, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, fontSize: 17, fontFamily: 'Inter_700Bold' },
  sendBtn: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  mainActions: { flexDirection: 'row', gap: 9, alignItems: 'center' },
  actionFlexNarrow: { flex: 0.9 },
  actionFlexPrimary: { flex: 1.1 },
  modalIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  modalSub: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 20, textAlign: 'center' },
  modalActions: { flexDirection: 'row', gap: 10, width: '100%' },
  acceptFareDialogCard: { borderWidth: 0 },
  modalActionBtn: { flex: 1 },
  modalInputRow: { width: '100%', height: 54, borderRadius: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 },
  modalInput: { flex: 1, fontSize: 20, fontFamily: 'Inter_700Bold' },
  errorText: { alignSelf: 'flex-start', fontSize: 12, fontFamily: 'Inter_500Medium' },
});
