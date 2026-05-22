import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useRide } from '@/context/RideContext';
import { NegotiationMessage, VEHICLE_LABELS } from '@/types';

const MAX_MESSAGES = 3;
const WARNING = '#FF9500';

function MessageBubble({ msg }: { msg: NegotiationMessage }) {
  const colors = useColors();
  const isCustomer = msg.sender === 'customer';
  const isSystem = msg.sender === 'system';

  if (isSystem) {
    return (
      <View style={styles.systemMsgRow}>
        <View style={[styles.systemBubble, { backgroundColor: colors.muted, borderColor: colors.border }]}>
          <Feather name="info" size={12} color={colors.mutedForeground} />
          <Text style={[styles.systemMsgText, { color: colors.mutedForeground }]}>{msg.text}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.bubbleRow, isCustomer ? styles.bubbleRight : styles.bubbleLeft]}>
      {!isCustomer && (
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
          <Text style={[styles.avatarText, { color: colors.primaryForeground }]}>
            {msg.sender === 'driver' ? 'D' : 'S'}
          </Text>
        </View>
      )}
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: isCustomer ? colors.primary : colors.card,
            borderColor: isCustomer ? colors.primary : colors.border,
          },
        ]}
      >
        <Text style={[styles.bubbleSender, {
          color: isCustomer ? colors.primaryForeground + 'AA' : colors.mutedForeground,
        }]}>
          {isCustomer ? 'You' : 'Driver'}
          {msg.isFinal ? ' · Accepted' : ''}
        </Text>
        {msg.type === 'offer' && msg.amount != null ? (
          <Text style={[styles.bubbleAmount, {
            color: isCustomer ? colors.primaryForeground : colors.foreground,
          }]}>
            {msg.amount.toLocaleString()} RWF
          </Text>
        ) : (
          <Text style={[styles.bubbleText, {
            color: isCustomer ? colors.primaryForeground : colors.foreground,
          }]}>
            {msg.text}
          </Text>
        )}
      </View>
    </View>
  );
}

export default function NegotiationScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { currentRide, counterOffer, acceptDriverOffer, declineDriverOffer, cancelRide } = useRide();

  const [offerText, setOfferText] = useState('');
  const [waitingDriver, setWaitingDriver] = useState(false);
  const [counterLoading, setCounterLoading] = useState(false);
  const listRef = useRef<FlatList>(null);

  const negotiation = currentRide?.negotiation ?? [];
  const customerMessages = negotiation.filter(m => m.sender === 'customer');
  const driverMessages = negotiation.filter(m => m.sender === 'driver' && m.type === 'offer');
  const lastDriverOffer = [...driverMessages].pop();
  const lastMsg = negotiation[negotiation.length - 1];

  const customerMsgCount = customerMessages.length;
  const driverHasSentFirstOffer = driverMessages.length > 0;
  const limitReached = customerMsgCount >= MAX_MESSAGES || driverMessages.length >= MAX_MESSAGES;
  const showCallButton = driverHasSentFirstOffer || limitReached;
  const canCounter = customerMsgCount < MAX_MESSAGES && lastMsg?.sender === 'driver' && !waitingDriver;
  const isRideAccepted = currentRide?.status === 'confirmed' || currentRide?.status === 'arriving' || currentRide?.status === 'arrived' || currentRide?.status === 'in_progress';

  useEffect(() => {
    if (isRideAccepted) {
      router.replace('/ride');
      return;
    }
    if (!currentRide || currentRide.status === 'cancelled') {
      router.replace('/(tabs)');
    }
  }, [currentRide?.status]);

  useEffect(() => {
    if (lastMsg?.sender === 'customer') {
      setWaitingDriver(true);
    } else {
      setWaitingDriver(false);
      setCounterLoading(false);
    }
  }, [negotiation.length]);

  const handleSendCounter = () => {
    const amount = parseInt(offerText.replace(/\D/g, ''), 10);
    if (isNaN(amount) || amount < 100) return;
    setOfferText('');
    setCounterLoading(true);
    counterOffer(amount);
  };

  const handleCall = () => {
    const phone = currentRide?.driver?.phone;
    if (phone) {
      Linking.openURL(`tel:${phone}`).catch(() => {
        Alert.alert('Cannot call', 'Unable to open the phone dialler.');
      });
    }
  };

  const handleAccept = () => {
    if (!lastDriverOffer?.amount) return;
    acceptDriverOffer();
  };

  const handleDecline = () => {
    Alert.alert(
      'Cancel negotiation',
      'Are you sure you want to cancel this ride?',
      [
        { text: 'Back', style: 'cancel' },
        { text: 'Cancel Ride', style: 'destructive', onPress: () => declineDriverOffer() },
      ]
    );
  };

  if (!currentRide) return null;

  const waitingForFirstOffer = !driverHasSentFirstOffer && !waitingDriver;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 0) + 12,
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={styles.driverInfo}>
          <View style={[styles.driverAvatar, { backgroundColor: colors.primary }]}>
            <Text style={[styles.driverInitial, { color: colors.primaryForeground }]}>
              {currentRide.driver?.name?.[0] ?? 'D'}
            </Text>
          </View>
          <View>
            <Text style={[styles.driverName, { color: colors.foreground }]}>
              {currentRide.driver?.name ?? 'Driver'}
            </Text>
            <Text style={[styles.driverVehicle, { color: colors.mutedForeground }]}>
              {VEHICLE_LABELS[currentRide.vehicleType]} · {currentRide.driver?.plateNumber}
            </Text>
          </View>
        </View>
        <View style={[styles.counterBadge, { backgroundColor: colors.muted }]}>
          <Text style={[styles.counterText, {
            color: limitReached ? colors.destructive : colors.mutedForeground,
          }]}>
            {customerMsgCount} / {MAX_MESSAGES} messages used
          </Text>
        </View>
      </View>

      <View style={[styles.routeBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={styles.routeItem}>
          <View style={[styles.routeDot, { backgroundColor: colors.primary }]} />
          <Text style={[styles.routeLabel, { color: colors.mutedForeground }]} numberOfLines={1}>
            {currentRide.pickup.address ?? 'Pickup'}
          </Text>
        </View>
        <View style={[styles.routeArrow, { backgroundColor: colors.border }]} />
        <View style={styles.routeItem}>
          <View style={[styles.routeDot, { backgroundColor: currentRide.destination.locationType === 'generic' ? WARNING : colors.destructive }]} />
          <Text style={[styles.routeLabel, { color: colors.mutedForeground }]} numberOfLines={1}>
            {currentRide.destination.locationType === 'generic'
              ? `${currentRide.destination.address ?? 'Unknown'} (to confirm)`
              : (currentRide.destination.address ?? 'Destination')}
          </Text>
        </View>
      </View>

      <FlatList
        ref={listRef}
        data={negotiation}
        keyExtractor={m => m.id}
        renderItem={({ item }) => <MessageBubble msg={item} />}
        contentContainerStyle={styles.messages}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListHeaderComponent={
          waitingForFirstOffer ? (
            <View style={styles.emptyChat}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.emptyChatText, { color: colors.mutedForeground }]}>
                Waiting for driver's price offer...
              </Text>
            </View>
          ) : null
        }
      />

      {waitingDriver && (
        <View style={styles.waitingRow}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.waitingText, { color: colors.mutedForeground }]}>Driver is responding...</Text>
        </View>
      )}

      <View
        style={[
          styles.actionPanel,
          {
            backgroundColor: colors.background,
            borderTopColor: colors.border,
            paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 8),
          },
        ]}
      >
        {lastDriverOffer && !limitReached && (
          <View style={[styles.currentOfferRow, { backgroundColor: colors.muted, borderRadius: 10 }]}>
            <Text style={[styles.currentOfferLabel, { color: colors.mutedForeground }]}>Driver's offer:</Text>
            <Text style={[styles.currentOfferAmount, { color: colors.foreground }]}>
              {lastDriverOffer.amount?.toLocaleString()} RWF
            </Text>
          </View>
        )}

        {canCounter && !limitReached && (
          <View style={styles.inputRow}>
            <View style={[styles.currencyBadge, { backgroundColor: colors.muted }]}>
              <Text style={[styles.currencyText, { color: colors.foreground }]}>RWF</Text>
            </View>
            <TextInput
              style={[styles.offerInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
              value={offerText}
              onChangeText={t => setOfferText(t.replace(/\D/g, ''))}
              placeholder="Your counter-offer"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="number-pad"
            />
            <TouchableOpacity
              style={[styles.sendBtn, { backgroundColor: offerText.length > 0 ? colors.primary : colors.muted }]}
              onPress={handleSendCounter}
              disabled={!offerText || counterLoading}
            >
              {counterLoading ? (
                <ActivityIndicator size="small" color={colors.primaryForeground} />
              ) : (
                <Feather name="send" size={18} color={offerText.length > 0 ? colors.primaryForeground : colors.mutedForeground} />
              )}
            </TouchableOpacity>
          </View>
        )}

        {limitReached && (
          <View style={[styles.limitBanner, { backgroundColor: colors.destructive + '15', borderRadius: 10 }]}>
            <Feather name="alert-circle" size={14} color={colors.destructive} />
            <Text style={[styles.limitText, { color: colors.destructive }]}>
              Message limit reached. Call to continue negotiation.
            </Text>
          </View>
        )}

        <View style={styles.mainActions}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.declineBtn, { borderColor: colors.destructive, backgroundColor: colors.destructive + '15' }]}
            onPress={handleDecline}
          >
            <Feather name="x" size={16} color={colors.destructive} />
            <Text style={[styles.actionBtnText, { color: colors.destructive }]}>Decline</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.callBtn, { borderColor: colors.border, backgroundColor: colors.muted }]}
            onPress={handleCall}
          >
            <Feather name="phone" size={16} color={colors.foreground} />
            <Text style={[styles.actionBtnText, { color: colors.foreground }]}>Call</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.acceptBtn, {
              backgroundColor: lastDriverOffer ? colors.primary : colors.muted,
              opacity: lastDriverOffer ? 1 : 0.5,
            }]}
            onPress={handleAccept}
            disabled={!lastDriverOffer}
          >
            <Feather name="check" size={16} color={lastDriverOffer ? colors.primaryForeground : colors.mutedForeground} />
            <Text style={[styles.actionBtnText, { color: lastDriverOffer ? colors.primaryForeground : colors.mutedForeground }]}>
              Accept
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  driverInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  driverAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  driverInitial: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  driverName: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  driverVehicle: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  counterBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100 },
  counterText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  routeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 8,
  },
  routeItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  routeDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  routeArrow: { width: 1, height: 20 },
  routeLabel: { fontSize: 12, fontFamily: 'Inter_400Regular', flex: 1 },
  messages: { padding: 16, gap: 10 },
  systemMsgRow: { alignItems: 'center', marginBottom: 8 },
  systemBubble: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    maxWidth: '85%',
  },
  systemMsgText: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  bubbleRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-end', marginBottom: 8 },
  bubbleLeft: { justifyContent: 'flex-start' },
  bubbleRight: { justifyContent: 'flex-end' },
  avatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  bubble: {
    maxWidth: '70%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    gap: 4,
  },
  bubbleSender: { fontSize: 11, fontFamily: 'Inter_500Medium' },
  bubbleAmount: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  bubbleText: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 20 },
  emptyChat: { alignItems: 'center', paddingTop: 40, paddingBottom: 20, gap: 12 },
  emptyChatText: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  waitingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, justifyContent: 'center' },
  waitingText: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  actionPanel: { borderTopWidth: 1, padding: 16, gap: 12 },
  currentOfferRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    paddingHorizontal: 14,
  },
  currentOfferLabel: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  currentOfferAmount: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  currencyBadge: { height: 48, paddingHorizontal: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  currencyText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  offerInput: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
  },
  sendBtn: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  limitBanner: {
    flexDirection: 'row',
    gap: 8,
    padding: 10,
    alignItems: 'center',
  },
  limitText: { flex: 1, fontSize: 12, fontFamily: 'Inter_400Regular' },
  mainActions: { flexDirection: 'row', gap: 10 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 50,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 14,
  },
  declineBtn: { flex: 1 },
  callBtn: { flex: 1 },
  acceptBtn: { flex: 1, borderColor: 'transparent' },
  actionBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
});
