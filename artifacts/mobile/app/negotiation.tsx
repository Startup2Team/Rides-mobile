import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassScrollView } from '@/components/GlassScrollView';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { AppButton } from '@/components/AppButton';
import { useRide } from '@/context/RideContext';
import { useColors } from '@/hooks/useColors';
import { NegotiationMessage, VEHICLE_LABELS } from '@/types';

const MAX_OFFERS = 3;
const WARNING = '#FF9500';
const INPUT_DOCK_HEIGHT = 64;
const DRIVER_TYPING_DELAY_MS = 450;

function formatFare(amount?: number) {
  return amount ? `${amount.toLocaleString()} RWF` : '--';
}

function formatMessageTime(timestamp: string) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

type StatusTone = 'neutral' | 'active' | 'waiting' | 'limit';

function NegotiationChatStatus({
  tone,
  title,
  hint,
  offersSent,
  maxOffers,
  offersRemaining,
}: {
  tone: StatusTone;
  title: string;
  hint: string;
  offersSent: number;
  maxOffers: number;
  offersRemaining: number;
}) {
  const colors = useColors();

  const iconColor = {
    neutral: colors.mutedForeground,
    active: colors.primary,
    waiting: colors.primary,
    limit: colors.destructive,
  }[tone];

  return (
    <View
      style={[styles.chatStatusCard, { backgroundColor: colors.card }]}
      accessibilityRole="summary"
      accessibilityLabel={`${title}. ${hint}. ${offersSent} of ${maxOffers} offers sent.`}
    >
      <View style={styles.chatStatusTop}>
        <View style={styles.chatStatusIcon}>
          <Feather name={
            tone === 'active' ? 'tag'
              : tone === 'waiting' ? 'clock'
                : tone === 'limit' ? 'alert-circle'
                  : 'message-circle'
          }
          size={20}
          color={iconColor}
          />
        </View>
        <View style={styles.chatStatusCopy}>
          <Text style={[styles.chatStatusTitle, { color: colors.foreground }]} numberOfLines={1}>
            {title}
          </Text>
          <Text
            style={[
              styles.chatStatusHint,
              { color: tone === 'active' ? colors.primary : colors.mutedForeground },
              tone === 'active' && styles.chatStatusHintEmphasis,
            ]}
            numberOfLines={2}
          >
            {hint}
          </Text>
        </View>
        {tone !== 'limit' && offersRemaining > 0 && (
          <View style={[styles.offersLeftBadge, { backgroundColor: colors.muted }]}>
            <Text style={[styles.offersLeftText, { color: colors.foreground }]}>
              {offersRemaining}
            </Text>
            <Text style={[styles.offersLeftLabel, { color: colors.mutedForeground }]}>left</Text>
          </View>
        )}
      </View>

      <View style={styles.offerProgressRow}>
        {Array.from({ length: maxOffers }, (_, index) => {
          const filled = index < offersSent;
          return (
            <View
              key={index}
              style={[
                styles.offerProgressSegment,
                {
                  backgroundColor: filled
                    ? tone === 'limit' && index === maxOffers - 1
                      ? colors.destructive
                      : colors.primary
                    : colors.border,
                },
              ]}
            />
          );
        })}
      </View>
      <Text style={[styles.offerProgressLabel, { color: colors.mutedForeground }]}>
        {offersSent === 0
          ? `You can send up to ${maxOffers} fare offers`
          : offersSent >= maxOffers
            ? 'All offers sent — call driver to continue'
            : `${offersSent} of ${maxOffers} offers sent`}
      </Text>
    </View>
  );
}

function OfferTimelineItem({ msg }: { msg: NegotiationMessage }) {
  const colors = useColors();
  const isCustomer = msg.sender === 'customer';
  const isDriver = msg.sender === 'driver';
  const isSystem = msg.sender === 'system';
  const bubbleBackground = isCustomer ? colors.primary : colors.card;
  const textColor = isCustomer ? colors.primaryForeground : colors.foreground;
  const metaColor = isCustomer ? colors.primaryForeground + 'B3' : colors.mutedForeground;

  if (isSystem) {
    return (
      <View style={styles.timelineSystemItem}>
        <View style={[styles.systemBubble, { backgroundColor: colors.muted }]}>
          <Text style={[styles.systemBubbleText, { color: colors.mutedForeground }]}>{msg.text}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[
      styles.timelineItem,
      isDriver && styles.timelineLeftItem,
      isCustomer && styles.timelineRightItem,
    ]}>
      <View style={[
        styles.bubble,
        isCustomer && styles.bubbleOutgoing,
        isDriver && styles.bubbleIncoming,
        { backgroundColor: bubbleBackground },
      ]}>
        {msg.type === 'offer' ? (
          <Text style={[styles.bubbleOfferAmount, { color: textColor }]}>
            {formatFare(msg.amount)}
          </Text>
        ) : (
          <Text style={[styles.bubbleBody, { color: textColor }]}>{msg.text}</Text>
        )}
        <View style={styles.bubbleFooter}>
          {msg.isFinal && (
            <View style={[styles.lockedBadge, { backgroundColor: isCustomer ? 'rgba(255,255,255,0.16)' : colors.primaryHex + '18' }]}>
              <Feather name="lock" size={10} color={isCustomer ? colors.primaryForeground : colors.primary} />
            </View>
          )}
          <Text style={[styles.bubbleTime, { color: metaColor }]}>
            {formatMessageTime(msg.timestamp)}
          </Text>
        </View>
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
  const [pendingOfferAmount, setPendingOfferAmount] = useState<number | null>(null);
  const [showDriverTyping, setShowDriverTyping] = useState(false);
  const [actionPanelHeight, setActionPanelHeight] = useState(0);
  const actionPanelOffset = actionPanelHeight > 0 ? actionPanelHeight : 108;

  const negotiation = currentRide?.negotiation ?? [];
  const customerOffers = negotiation.filter(m => m.sender === 'customer' && m.type === 'offer');
  const driverOffers = negotiation.filter(m => m.sender === 'driver' && m.type === 'offer');
  const lastDriverOffer = [...driverOffers].pop();
  const lastMsg = negotiation[negotiation.length - 1];
  const customerLimitReached = customerOffers.length >= MAX_OFFERS;
  const isRideAccepted = currentRide
    ? ['confirmed', 'arriving', 'arrived', 'in_progress'].includes(currentRide.status)
    : false;
  const isAwaitingDriverReply =
    currentRide?.status === 'negotiating' &&
    lastMsg?.sender === 'customer' &&
    !customerLimitReached;
  const showPendingOffer =
    pendingOfferAmount != null &&
    !negotiation.some(
      m => m.sender === 'customer' && m.type === 'offer' && m.amount === pendingOfferAmount,
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
        hint: 'Hang tight — they usually respond quickly',
      };
    }
    if (lastDriverOffer?.amount) {
      return {
        tone: 'active' as const,
        title: 'New fare from driver',
        hint: `${formatFare(lastDriverOffer.amount)} — tap Accept fare below when you're ready`,
      };
    }
    return {
      tone: 'neutral' as const,
      title: 'Fare negotiation',
      hint: 'Send an offer below when the driver responds',
    };
  }, [customerLimitReached, showDriverTyping, lastDriverOffer?.amount]);
  const offerPlaceholder = customerOffers.length === 0
    ? 'Your offer'
    : customerOffers.length === MAX_OFFERS - 1
      ? 'Final offer'
      : 'Counter offer';

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
    if (lastMsg?.sender !== 'customer') {
      setCounterLoading(false);
      setPendingOfferAmount(null);
    }
  }, [lastMsg?.id, lastMsg?.sender]);

  useEffect(() => {
    if (pendingOfferAmount == null) return;
    const confirmed = negotiation.some(
      m => m.sender === 'customer' && m.type === 'offer' && m.amount === pendingOfferAmount,
    );
    if (confirmed) setPendingOfferAmount(null);
  }, [negotiation, pendingOfferAmount]);

  useEffect(() => {
    const canShowTyping =
      counterLoading &&
      isAwaitingDriverReply &&
      !showPendingOffer;

    if (!canShowTyping) {
      setShowDriverTyping(false);
      return undefined;
    }

    const timer = setTimeout(() => setShowDriverTyping(true), DRIVER_TYPING_DELAY_MS);
    return () => clearTimeout(timer);
  }, [counterLoading, isAwaitingDriverReply, showPendingOffer, lastMsg?.id]);

  useEffect(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      });
    });
  }, [negotiation.length, showDriverTyping, pendingOfferAmount]);

  const sendCounter = (amount: number) => {
    if (!amount || amount < 100 || !canCounter) return;
    setShowDriverTyping(false);
    setPendingOfferAmount(amount);
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
    Alert.alert(
      'Why are you declining?',
      'Your feedback helps improve the experience.',
      [
        { text: 'Price is too high', onPress: () => declineDriverOffer() },
        { text: 'Driver is too far', onPress: () => declineDriverOffer() },
        { text: 'Driver asked me to cancel', onPress: () => declineDriverOffer() },
        { text: 'Changed my plans', onPress: () => declineDriverOffer() },
        { text: 'Keep negotiating', style: 'cancel' },
      ],
    );
  };

  if (!currentRide) return null;

  const driverProfileImage = currentRide.driver?.profileImage;
  const destinationIsGeneric = currentRide.destination.locationType === 'generic';
  const dropoffAccent = destinationIsGeneric ? WARNING : colors.destructive;

  const footerBottomInset = insets.bottom + (Platform.OS === 'web' ? 24 : 6);
  const scrollBottomInset = actionPanelOffset + (canCounter ? INPUT_DOCK_HEIGHT : 0) + 12;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={[
          styles.page,
          { paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 0) + 14 },
        ]}
      >
        <View style={styles.topSection}>
        <View style={styles.header}>
          <View style={styles.identityRow}>
            {driverProfileImage ? (
              <Image
                source={{ uri: driverProfileImage }}
                style={styles.avatarImage}
                accessibilityLabel={currentRide.driver?.name ?? 'Driver profile photo'}
              />
            ) : (
              <View
                style={[styles.avatar, { backgroundColor: colors.muted }]}
                accessibilityLabel={currentRide.driver?.name ?? 'Driver'}
                accessibilityRole="image"
              >
                <Feather name="user" size={22} color={colors.foreground} />
              </View>
            )}
            <View style={styles.identityText}>
              <Text style={[styles.title, { color: colors.foreground }]}>
                {currentRide.driver?.name ?? 'Driver'}
              </Text>
              <View style={styles.subtitleRow}>
                <Text style={[styles.subtitle, { color: colors.mutedForeground }]} numberOfLines={1}>
                  {VEHICLE_LABELS[currentRide.vehicleType]} - {currentRide.driver?.plateNumber ?? 'Plate pending'}
                </Text>
                <Text style={[styles.ratingText, { color: colors.star }]}>
                  ★ {currentRide.driver?.rating?.toFixed(1) ?? '4.8'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={[styles.tripSummaryCard, { backgroundColor: colors.card }]}>
          <View style={styles.tripRoute}>
            <View style={styles.tripRouteTrack}>
              <View style={[styles.tripDot, { backgroundColor: colors.primary }]} />
              <View style={[styles.tripConnector, { backgroundColor: colors.border }]} />
              <View style={[styles.tripDot, styles.tripDotSquare, { backgroundColor: dropoffAccent }]} />
            </View>
            <View style={styles.tripStops}>
              <View style={styles.tripStop}>
                <Text style={[styles.tripStopLabel, { color: colors.mutedForeground }]}>Pickup</Text>
                <Text style={[styles.tripStopValue, { color: colors.foreground }]} numberOfLines={1}>
                  {currentRide.pickup.address ?? 'Pickup location'}
                </Text>
              </View>
              <View style={styles.tripStop}>
                <Text style={[styles.tripStopLabel, { color: colors.mutedForeground }]}>Drop off</Text>
                <Text style={[styles.tripStopValue, { color: colors.foreground }]} numberOfLines={1}>
                  {destinationIsGeneric
                    ? (currentRide.destination.address?.trim() || 'To be confirmed in chat')
                    : (currentRide.destination.address ?? 'Destination')}
                </Text>
              </View>
            </View>
          </View>

          {destinationIsGeneric && (
            <View style={[styles.tripGenericNote, { backgroundColor: WARNING + '14' }]}>
              <Feather name="info" size={12} color={WARNING} />
              <Text style={[styles.tripGenericText, { color: WARNING }]} numberOfLines={1}>
                Drop off to confirm with driver
              </Text>
            </View>
          )}

          <View style={[styles.tripStatsRow, { borderTopColor: colors.border }]}>
            <View style={styles.tripStatInline}>
              <Feather name="navigation" size={12} color={colors.primary} />
              <Text style={[styles.tripStatLabel, { color: colors.mutedForeground }]}>Distance</Text>
              <Text style={[styles.tripStatValue, { color: colors.foreground }]}>
                {currentRide.distance.toFixed(1)} km
              </Text>
            </View>
            <View style={styles.tripStatInline}>
              <Feather name="clock" size={12} color={colors.primary} />
              <Text style={[styles.tripStatLabel, { color: colors.mutedForeground }]}>ETA</Text>
              <Text style={[styles.tripStatValue, { color: colors.foreground }]}>
                ~{currentRide.duration} min
              </Text>
            </View>
          </View>
        </View>

          <NegotiationChatStatus
            tone={chatStatus.tone}
            title={chatStatus.title}
            hint={chatStatus.hint}
            offersSent={messagesUsed}
            maxOffers={MAX_OFFERS}
            offersRemaining={offersRemaining}
          />
        </View>

        <GlassScrollView
          ref={scrollRef}
          style={styles.messagesScroll}
          indicatorTop={4}
          indicatorBottom={8}
          contentContainerStyle={[
            styles.timeline,
            { paddingHorizontal: 16, paddingBottom: scrollBottomInset },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onContentSizeChange={() => {
            requestAnimationFrame(() => {
              scrollRef.current?.scrollToEnd({ animated: true });
            });
          }}
        >
          {negotiation.length === 0 ? (
            <Text style={[styles.emptyTimeline, { color: colors.mutedForeground }]}>
              The first fare offer will appear here.
            </Text>
          ) : (
            negotiation.map(msg => <OfferTimelineItem key={msg.id} msg={msg} />)
          )}
          {pendingOfferMessage && (
            <OfferTimelineItem key={pendingOfferMessage.id} msg={pendingOfferMessage} />
          )}
          {showDriverTyping && (
            <View style={styles.timelineLeftItem}>
              <View style={[styles.typingBubble, { backgroundColor: colors.card }]}>
                <ActivityIndicator size="small" color={colors.mutedForeground} />
                <Text style={[styles.typingText, { color: colors.mutedForeground }]}>
                  typing…
                </Text>
              </View>
            </View>
          )}
        </GlassScrollView>
      </View>

      <View style={styles.bottomChrome}>
        {canCounter && (
          <KeyboardStickyView
            offset={{ closed: 0, opened: actionPanelOffset }}
            style={[
              styles.inputDock,
              { backgroundColor: colors.background, borderTopColor: colors.border },
            ]}
          >
            <View style={styles.inputRow}>
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
          <AppButton
            title="Decline"
            icon="x"
            variant="decline"
            size="sm"
            compact
            onPress={handleDecline}
            style={styles.actionFlexNarrow}
          />
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
            disabled={!lastDriverOffer}
            style={styles.actionFlexPrimary}
          />
        </View>
        </View>
      </View>

      <ConfirmDialog visible={showAcceptModal} onClose={() => setShowAcceptModal(false)}>
        <View style={[styles.modalIcon, { backgroundColor: colors.primaryHex + '20' }]}>
          <Feather name="shield" size={24} color={colors.primary} />
        </View>
        <Text style={[styles.modalTitle, { color: colors.foreground }]}>Accept {formatFare(lastDriverOffer?.amount)}?</Text>
        <Text style={[styles.modalSub, { color: colors.mutedForeground }]}>
          This fare will be locked for the ride and visible to both you and the driver.
        </Text>
        <View style={[styles.acceptSummary, { backgroundColor: colors.muted, borderColor: colors.border }]}>
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
          <View style={[styles.acceptSummaryRow, styles.acceptSummaryTotal, { borderTopColor: colors.border }]}>
            <Text style={[styles.acceptSummaryLabel, { color: colors.mutedForeground }]}>Final fare</Text>
            <Text style={[styles.acceptSummaryAmount, { color: colors.primary }]}>
              {formatFare(lastDriverOffer?.amount)}
            </Text>
          </View>
        </View>
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
              acceptDriverOffer();
            }}
            style={styles.modalActionBtn}
          />
        </View>
      </ConfirmDialog>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, minHeight: 0 },
  topSection: { paddingHorizontal: 16, gap: 10, paddingBottom: 6 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  identityRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: 46, height: 46, borderRadius: 23 },
  identityText: { flex: 1, minWidth: 0 },
  title: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  subtitle: { fontSize: 12, fontFamily: 'Inter_500Medium', marginTop: 2 },
  subtitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7, minWidth: 0 },
  ratingText: { fontSize: 12, fontFamily: 'Inter_700Bold', marginTop: 2 },
  iconButton: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  statusBanner: { minHeight: 46, borderRadius: 14, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusText: { flex: 1, fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  tripSummaryCard: {
    borderRadius: 14,
    paddingHorizontal: 11,
    paddingVertical: 9,
    gap: 7,
  },
  tripRoute: { flexDirection: 'row', gap: 9 },
  tripRouteTrack: { width: 12, alignItems: 'center', paddingTop: 3 },
  tripDot: { width: 8, height: 8, borderRadius: 4 },
  tripDotSquare: { borderRadius: 2 },
  tripConnector: { flex: 1, width: 2, minHeight: 14, marginVertical: 2, borderRadius: 1 },
  tripStops: { flex: 1, minWidth: 0, gap: 8 },
  tripStop: { gap: 1 },
  tripStopLabel: {
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.35,
  },
  tripStopValue: { fontSize: 13, fontFamily: 'Inter_500Medium', lineHeight: 17 },
  tripGenericNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  tripGenericText: { flex: 1, fontSize: 11, fontFamily: 'Inter_500Medium' },
  tripStatsRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 7,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tripStatInline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tripStatLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  tripStatValue: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  offerCard: { borderRadius: 18, padding: 18, gap: 6 },
  offerLabel: { fontSize: 11, fontFamily: 'Inter_700Bold', textTransform: 'uppercase' },
  offerAmount: { fontSize: 34, fontFamily: 'Inter_700Bold' },
  offerDelta: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  trustCopy: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  chatStatusCard: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 11,
    gap: 10,
  },
  chatStatusTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  chatStatusIcon: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatStatusCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  chatStatusTitle: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  chatStatusHint: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    lineHeight: 18,
  },
  chatStatusHintEmphasis: {
    fontFamily: 'Inter_600SemiBold',
  },
  offersLeftBadge: {
    minWidth: 40,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
    alignItems: 'center',
  },
  offersLeftText: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    lineHeight: 18,
  },
  offersLeftLabel: {
    fontSize: 10,
    fontFamily: 'Inter_500Medium',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  offerProgressRow: {
    flexDirection: 'row',
    gap: 6,
  },
  offerProgressSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  offerProgressLabel: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  messagesScroll: { flex: 1, minHeight: 0 },
  timeline: { gap: 6, paddingBottom: 12, paddingTop: 4 },
  emptyTimeline: { fontSize: 15, fontFamily: 'Inter_400Regular', textAlign: 'center', paddingVertical: 24, lineHeight: 22 },
  timelineItem: { flexDirection: 'row', width: '100%' },
  timelineLeftItem: { justifyContent: 'flex-start', paddingRight: 52 },
  timelineRightItem: { justifyContent: 'flex-end', paddingLeft: 52 },
  timelineSystemItem: { alignItems: 'center', paddingVertical: 4 },
  bubble: {
    maxWidth: '100%',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 6,
    gap: 4,
  },
  bubbleOutgoing: {
    borderTopRightRadius: 4,
  },
  bubbleIncoming: {
    borderTopLeftRadius: 4,
  },
  bubbleBody: {
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    lineHeight: 22,
  },
  bubbleOfferAmount: {
    fontSize: 17,
    fontFamily: 'Inter_600SemiBold',
    lineHeight: 22,
  },
  bubbleFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    alignSelf: 'flex-end',
    marginTop: 2,
  },
  bubbleTime: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
  systemBubble: {
    maxWidth: '88%',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  systemBubbleText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    lineHeight: 18,
    textAlign: 'center',
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 16,
    borderTopLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  typingText: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
  },
  lockedBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionPanel: { flexShrink: 0, paddingHorizontal: 14, paddingTop: 10 },
  limitBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 12 },
  limitText: { flex: 1, fontSize: 12, fontFamily: 'Inter_500Medium' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  currencyBadge: { height: 48, paddingHorizontal: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  currencyText: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  offerInput: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  offerInputPlaceholder: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  sendBtn: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  mainActions: {
    flexDirection: 'row',
    gap: 9,
    alignItems: 'center',
    paddingTop: 10,
  },
  bottomChrome: { flexShrink: 0 },
  inputDock: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actionFlexNarrow: { flex: 0.9, minWidth: 0 },
  actionFlexWide: { flex: 1.25, minWidth: 0 },
  actionFlexPrimary: { flex: 1.4, minWidth: 0 },
  modalIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  modalSub: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 20, textAlign: 'center' },
  acceptSummary: { width: '100%', borderRadius: 14, padding: 12, gap: 9, borderWidth: StyleSheet.hairlineWidth },
  acceptSummaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  acceptSummaryTotal: { paddingTop: 9, borderTopWidth: StyleSheet.hairlineWidth },
  acceptSummaryLabel: { fontSize: 11, fontFamily: 'Inter_700Bold', textTransform: 'uppercase' },
  acceptSummaryValue: { flex: 1, textAlign: 'right', fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  acceptSummaryAmount: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  modalActions: { flexDirection: 'row', gap: 10, width: '100%' },
  modalActionBtn: { flex: 1 },
});
