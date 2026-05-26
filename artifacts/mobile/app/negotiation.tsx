import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRide } from '@/context/RideContext';
import { useColors } from '@/hooks/useColors';
import { NegotiationMessage, VEHICLE_LABELS } from '@/types';

const MAX_OFFERS = 3;
const WARNING = '#FF9500';
const GOLD = '#D6A21E';

function formatFare(amount?: number) {
  return amount ? `${amount.toLocaleString()} RWF` : '--';
}

function formatMessageTime(timestamp: string) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
  const bubbleBorder = isCustomer ? colors.primary : colors.border;
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
        { backgroundColor: isSystem ? colors.card : bubbleBackground, borderColor: isSystem ? colors.border : bubbleBorder },
      ]}>
        <View style={styles.timelineHeader}>
          <Text style={[styles.timelineActor, { color: isSystem ? colors.mutedForeground : metaColor }]}>{label}</Text>
          {msg.isFinal && (
            <View style={[styles.lockedBadge, { backgroundColor: isCustomer ? 'rgba(255,255,255,0.18)' : colors.primary + '20' }]}>
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
        <Text style={[styles.messageTime, { color: isSystem ? colors.mutedForeground : metaColor }]}>
          {formatMessageTime(msg.timestamp)}
        </Text>
      </View>
    </View>
  );
}

export default function NegotiationScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { currentRide, counterOffer, acceptDriverOffer, declineDriverOffer } = useRide();
  const scrollRef = useRef<ScrollView>(null);

  const [offerText, setOfferText] = useState('');
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [counterLoading, setCounterLoading] = useState(false);

  const negotiation = currentRide?.negotiation ?? [];
  const customerOffers = negotiation.filter(m => m.sender === 'customer' && m.type === 'offer');
  const driverOffers = negotiation.filter(m => m.sender === 'driver' && m.type === 'offer');
  const lastDriverOffer = [...driverOffers].pop();
  const lastMsg = negotiation[negotiation.length - 1];
  const customerLimitReached = customerOffers.length >= MAX_OFFERS;
  const isRideAccepted = currentRide
    ? ['confirmed', 'arriving', 'arrived', 'in_progress'].includes(currentRide.status)
    : false;
  const isDriverReplying =
    currentRide?.status === 'negotiating' &&
    lastMsg?.sender === 'customer' &&
    !customerLimitReached;
  const negotiationStatus = isRideAccepted
    ? 'Fare locked'
    : customerLimitReached
      ? 'Offer limit reached'
      : isDriverReplying
        ? 'Driver is replying...'
        : lastDriverOffer
          ? 'Driver offer ready'
          : 'Waiting for driver offer...';
  const messagesUsed = Math.min(customerOffers.length, MAX_OFFERS);
  const offerPlaceholder = customerOffers.length === 0
    ? 'Enter your offer'
    : customerOffers.length === MAX_OFFERS - 1
      ? 'Enter your final offer'
      : 'Enter your counter offer';

  const canCounter = !!lastDriverOffer && lastMsg?.sender === 'driver' && !customerLimitReached;

  useEffect(() => {
    if (isRideAccepted) {
      router.replace('/ride');
      return;
    }
    if (!currentRide || currentRide.status === 'cancelled') {
      router.replace('/(tabs)');
    }
  }, [currentRide?.status, isRideAccepted]);

  useEffect(() => {
    if (lastMsg?.sender !== 'customer') setCounterLoading(false);
  }, [lastMsg?.id]);

  useEffect(() => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }, [negotiation.length, isDriverReplying]);

  const sendCounter = (amount: number) => {
    if (!amount || amount < 100 || !canCounter) return;
    setOfferText('');
    setCounterLoading(true);
    counterOffer(amount);
  };

  const handleSendCounter = () => {
    sendCounter(parseInt(offerText.replace(/\D/g, ''), 10));
  };

  const handleCall = () => {
    const phone = currentRide?.driver?.phone;
    if (!phone) return;
    Linking.openURL(`tel:${phone}`).catch(() => {
      Alert.alert('Cannot call', 'Unable to open the phone dialler.');
    });
  };

  const handleDecline = () => {
    Alert.alert('Cancel negotiation', 'Are you sure you want to cancel this ride?', [
      { text: 'Back', style: 'cancel' },
      { text: 'Cancel Ride', style: 'destructive', onPress: () => declineDriverOffer() },
    ]);
  };

  if (!currentRide) return null;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View
        style={[
          styles.content,
          { paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 0) + 14 },
        ]}
      >
        <View style={styles.header}>
          <View style={styles.identityRow}>
            <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
              <Text style={[styles.avatarText, { color: colors.primaryForeground }]}>
                {currentRide.driver?.name?.[0] ?? 'D'}
              </Text>
            </View>
            <View style={styles.identityText}>
              <Text style={[styles.title, { color: colors.foreground }]}>
                {currentRide.driver?.name ?? 'Driver'}
              </Text>
              <View style={styles.subtitleRow}>
                <Text style={[styles.subtitle, { color: colors.mutedForeground }]} numberOfLines={1}>
                  {VEHICLE_LABELS[currentRide.vehicleType]} - {currentRide.driver?.plateNumber ?? 'Plate pending'}
                </Text>
                <View style={styles.ratingWrap}>
                  <Feather name="star" size={12} color={GOLD} />
                  <Text style={[styles.ratingText, { color: GOLD }]}>
                    {currentRide.driver?.rating?.toFixed(1) ?? '4.8'}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.compactRouteRow}>
            <View style={styles.compactRoutePoint}>
              <View style={[styles.routeIcon, { backgroundColor: colors.primary + '18' }]}>
                <Feather name="map-pin" size={13} color={colors.primary} />
              </View>
              <Text style={[styles.routeText, { color: colors.foreground }]} numberOfLines={1}>
                {currentRide.pickup.address ?? 'Pickup'}
              </Text>
            </View>
            <View style={styles.compactRoutePoint}>
              <View style={[styles.routeIcon, { backgroundColor: (currentRide.destination.locationType === 'generic' ? WARNING : colors.destructive) + '18' }]}>
                <Feather
                  name="flag"
                  size={13}
                  color={currentRide.destination.locationType === 'generic' ? WARNING : colors.destructive}
                />
              </View>
              <Text style={[styles.routeText, { color: colors.foreground }]} numberOfLines={1}>
                {currentRide.destination.address ?? 'Destination'}
              </Text>
            </View>
          </View>
          <View style={[styles.compactMetaRow, { borderTopColor: colors.border }]}>
            <Text style={[styles.compactMetaText, { color: colors.mutedForeground }]}>
              Distance <Text style={{ color: colors.foreground }}>{currentRide.distance} km</Text>
            </Text>
            <Text style={[styles.compactMetaText, { color: colors.mutedForeground }]}>
              ETA <Text style={{ color: colors.foreground }}>{currentRide.duration} min</Text>
            </Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Messages</Text>
            <Text style={[styles.negotiationStatus, { color: customerLimitReached ? colors.destructive : colors.mutedForeground }]}>
              {negotiationStatus}
            </Text>
          </View>
          <Text style={[styles.messagesUsedText, { color: customerLimitReached ? colors.destructive : colors.mutedForeground }]}>
            {messagesUsed}/{MAX_OFFERS} messages used
          </Text>
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.messagesScroll}
          contentContainerStyle={styles.timeline}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {negotiation.length === 0 ? (
            <Text style={[styles.emptyTimeline, { color: colors.mutedForeground }]}>
              The first fare offer will appear here.
            </Text>
          ) : (
            negotiation.map(msg => <OfferTimelineItem key={msg.id} msg={msg} perspective="customer" />)
          )}
          {isDriverReplying && (
            <View style={[styles.replyIndicator, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.replyIndicatorText, { color: colors.mutedForeground }]}>
                Driver is replying...
              </Text>
            </View>
          )}
        </ScrollView>
      </View>

      <View style={[styles.actionPanel, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: insets.bottom + (Platform.OS === 'web' ? 24 : 6) }]}>
        {customerLimitReached && (
          <View style={[styles.limitBanner, { backgroundColor: colors.primary + '14' }]}>
            <Feather name="phone-call" size={15} color={colors.primary} />
            <Text style={[styles.limitText, { color: colors.foreground }]}>
              Offer limit reached. Call the driver to continue.
            </Text>
          </View>
        )}

        {canCounter && (
          <>
            <View style={styles.inputRow}>
              <View style={[styles.currencyBadge, { backgroundColor: colors.muted }]}>
                <Text style={[styles.currencyText, { color: colors.foreground }]}>RWF</Text>
              </View>
              <TextInput
                style={[styles.offerInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
                value={offerText}
                onChangeText={text => setOfferText(text.replace(/\D/g, ''))}
                placeholder={offerPlaceholder}
                placeholderTextColor={colors.mutedForeground}
                keyboardType="number-pad"
              />
              <TouchableOpacity
                style={[styles.sendBtn, { backgroundColor: offerText ? colors.primary : colors.muted }]}
                onPress={handleSendCounter}
                disabled={!offerText || counterLoading}
              >
                {counterLoading ? (
                  <ActivityIndicator size="small" color={colors.primaryForeground} />
                ) : (
                  <Feather name="send" size={18} color={offerText ? colors.primaryForeground : colors.mutedForeground} />
                )}
              </TouchableOpacity>
            </View>
          </>
        )}

        <View style={styles.mainActions}>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.destructive + '12', borderColor: colors.destructive }]} onPress={handleDecline}>
            <Feather name="x" size={17} color={colors.destructive} />
            <Text style={[styles.actionText, { color: colors.destructive }]}>Decline</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.actionBtn,
              customerLimitReached && styles.callFallbackBtn,
              {
                backgroundColor: customerLimitReached ? colors.primary : colors.muted,
                borderColor: customerLimitReached ? colors.primary : colors.border,
              },
            ]}
            onPress={handleCall}
          >
            <Feather name="phone" size={17} color={customerLimitReached ? colors.primaryForeground : colors.foreground} />
            <Text style={[styles.actionText, { color: customerLimitReached ? colors.primaryForeground : colors.foreground }]}>
              {customerLimitReached ? 'Call Driver' : 'Call'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.acceptBtn, { backgroundColor: lastDriverOffer ? colors.primary : colors.muted, opacity: lastDriverOffer ? 1 : 0.5 }]}
            onPress={() => setShowAcceptModal(true)}
            disabled={!lastDriverOffer}
          >
            <Feather name="check" size={18} color={lastDriverOffer ? colors.primaryForeground : colors.mutedForeground} />
            <Text style={[styles.acceptText, { color: lastDriverOffer ? colors.primaryForeground : colors.mutedForeground }]}>
              {lastDriverOffer ? 'Accept Fare' : 'Waiting for offer'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <Modal visible={showAcceptModal} transparent animationType="fade" onRequestClose={() => setShowAcceptModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <View style={[styles.modalIcon, { backgroundColor: colors.primary + '20' }]}>
              <Feather name="shield" size={24} color={colors.primary} />
            </View>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Accept {formatFare(lastDriverOffer?.amount)}?</Text>
            <Text style={[styles.modalSub, { color: colors.mutedForeground }]}>
              This fare will be locked for the ride and visible to both you and the driver.
            </Text>
            <View style={[styles.acceptSummary, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.acceptSummaryRow}>
                <Text style={[styles.acceptSummaryLabel, { color: colors.mutedForeground }]}>Driver</Text>
                <Text style={[styles.acceptSummaryValue, { color: colors.foreground }]} numberOfLines={1}>
                  {currentRide.driver?.name ?? 'Driver'}
                </Text>
              </View>
              <View style={styles.acceptSummaryRow}>
                <Text style={[styles.acceptSummaryLabel, { color: colors.mutedForeground }]}>Pickup</Text>
                <Text style={[styles.acceptSummaryValue, { color: colors.foreground }]} numberOfLines={1}>
                  {currentRide.pickup.address ?? 'Pickup'}
                </Text>
              </View>
              <View style={styles.acceptSummaryRow}>
                <Text style={[styles.acceptSummaryLabel, { color: colors.mutedForeground }]}>Dropoff</Text>
                <Text style={[styles.acceptSummaryValue, { color: colors.foreground }]} numberOfLines={1}>
                  {currentRide.destination.address ?? 'Destination'}
                </Text>
              </View>
              <View style={[styles.acceptSummaryRow, styles.acceptSummaryTotal]}>
                <Text style={[styles.acceptSummaryLabel, { color: colors.mutedForeground }]}>Final fare</Text>
                <Text style={[styles.acceptSummaryAmount, { color: colors.primary }]}>
                  {formatFare(lastDriverOffer?.amount)}
                </Text>
              </View>
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.muted, borderColor: colors.border }]} onPress={() => setShowAcceptModal(false)}>
                <Text style={[styles.modalBtnText, { color: colors.foreground }]}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]}
                onPress={() => {
                  setShowAcceptModal(false);
                  acceptDriverOffer();
                }}
              >
                <Text style={[styles.modalBtnText, { color: colors.primaryForeground }]}>Accept Fare</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, minHeight: 0, paddingHorizontal: 16, paddingBottom: 10, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  identityRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  identityText: { flex: 1, minWidth: 0 },
  title: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  subtitle: { fontSize: 12, fontFamily: 'Inter_500Medium', marginTop: 2 },
  subtitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7, minWidth: 0 },
  ratingWrap: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  ratingText: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  iconButton: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  statusBanner: { minHeight: 46, borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusText: { flex: 1, fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  summaryCard: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8, gap: 6 },
  compactRouteRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  compactRoutePoint: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6 },
  compactMetaRow: { borderTopWidth: 1, paddingTop: 6, flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  compactMetaText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 22 },
  routeDot: { width: 8, height: 8, borderRadius: 4 },
  routeIcon: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  routeLine: { width: 1, height: 9, marginLeft: 3 },
  routeText: { flex: 1, fontSize: 12, fontFamily: 'Inter_500Medium' },
  metaGrid: { borderTopWidth: 1, marginTop: 5, paddingTop: 7, flexDirection: 'row', gap: 6 },
  metaItem: { flex: 1, gap: 1 },
  metaLabel: { fontSize: 9, fontFamily: 'Inter_700Bold', textTransform: 'uppercase' },
  metaValue: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  offerCard: { borderRadius: 18, borderWidth: 1, padding: 18, gap: 6 },
  offerLabel: { fontSize: 11, fontFamily: 'Inter_700Bold', textTransform: 'uppercase' },
  offerAmount: { fontSize: 34, fontFamily: 'Inter_700Bold' },
  offerDelta: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  trustCopy: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  negotiationStatus: { fontSize: 12, fontFamily: 'Inter_600SemiBold', marginTop: 2 },
  offerCount: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  messagesUsedText: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  messagesScroll: { flex: 1, minHeight: 0 },
  timeline: { gap: 10, paddingBottom: 18 },
  emptyTimeline: { fontSize: 13, fontFamily: 'Inter_500Medium', textAlign: 'center', paddingVertical: 20 },
  timelineItem: { flexDirection: 'row' },
  timelineLeftItem: { justifyContent: 'flex-start', paddingRight: 46 },
  timelineRightItem: { justifyContent: 'flex-end', paddingLeft: 46 },
  timelineSystemItem: { justifyContent: 'center' },
  timelineDotSpacer: { width: 10 },
  timelineCard: { maxWidth: '84%', borderRadius: 18, borderWidth: 1, padding: 12, gap: 4 },
  timelineCustomerCard: { borderTopRightRadius: 6 },
  timelineDriverCard: { borderTopLeftRadius: 6 },
  timelineSystemCard: { flex: 0, width: '86%', alignSelf: 'center' },
  replyIndicator: {
    maxWidth: '72%',
    alignSelf: 'flex-start',
    borderRadius: 18,
    borderTopLeftRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  replyIndicatorText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  timelineHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timelineActor: { fontSize: 11, fontFamily: 'Inter_700Bold', textTransform: 'uppercase' },
  timelineAmount: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  timelineText: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 19 },
  messageTime: { alignSelf: 'flex-end', fontSize: 10, fontFamily: 'Inter_500Medium', marginTop: 1 },
  lockedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3 },
  lockedText: { fontSize: 10, fontFamily: 'Inter_700Bold' },
  actionPanel: { flexShrink: 0, borderTopWidth: 1, padding: 14, gap: 12 },
  limitBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 12 },
  limitText: { flex: 1, fontSize: 12, fontFamily: 'Inter_500Medium' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  currencyBadge: { height: 48, paddingHorizontal: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  currencyText: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  offerInput: { flex: 1, height: 48, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, fontSize: 17, fontFamily: 'Inter_700Bold' },
  sendBtn: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  mainActions: { flexDirection: 'row', gap: 9 },
  actionBtn: { flex: 0.9, height: 50, borderRadius: 13, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  callFallbackBtn: { flex: 1.25 },
  actionText: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  acceptBtn: { flex: 1.4, height: 50, borderRadius: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  acceptText: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard: { width: '100%', borderRadius: 20, borderWidth: 1, padding: 22, gap: 14, alignItems: 'center' },
  modalIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  modalSub: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 20, textAlign: 'center' },
  acceptSummary: { width: '100%', borderRadius: 14, borderWidth: 1, padding: 12, gap: 9 },
  acceptSummaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  acceptSummaryTotal: { paddingTop: 9, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(128,128,128,0.25)' },
  acceptSummaryLabel: { fontSize: 11, fontFamily: 'Inter_700Bold', textTransform: 'uppercase' },
  acceptSummaryValue: { flex: 1, textAlign: 'right', fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  acceptSummaryAmount: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  modalActions: { flexDirection: 'row', gap: 10, width: '100%' },
  modalBtn: { flex: 1, height: 50, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  modalBtnText: { fontSize: 14, fontFamily: 'Inter_700Bold' },
});
