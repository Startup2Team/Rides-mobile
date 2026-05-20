import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
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

function MessageBubble({ msg }: { msg: NegotiationMessage }) {
  const colors = useColors();
  const isCustomer = msg.sender === 'customer';

  return (
    <View style={[styles.bubbleRow, isCustomer ? styles.bubbleRight : styles.bubbleLeft]}>
      {!isCustomer && (
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
          <Text style={styles.avatarText}>D</Text>
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
        <Text style={[styles.bubbleSender, { color: isCustomer ? colors.primaryForeground + 'AA' : colors.mutedForeground }]}>
          {isCustomer ? 'You' : 'Driver'}
          {msg.isFinal ? ' · Final offer' : ''}
        </Text>
        <Text style={[styles.bubbleAmount, { color: isCustomer ? colors.primaryForeground : colors.foreground }]}>
          {msg.amount.toLocaleString()} RWF
        </Text>
      </View>
    </View>
  );
}

export default function NegotiationScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { currentRide, proposeFare, acceptDriverOffer, declineDriverOffer, cancelRide } = useRide();

  const [offerText, setOfferText] = useState('');
  const [waitingDriver, setWaitingDriver] = useState(false);
  const listRef = useRef<FlatList>(null);

  const negotiation = currentRide?.negotiation ?? [];
  const roundCount = negotiation.filter(m => m.sender === 'customer').length;
  const lastDriverMsg = [...negotiation].reverse().find(m => m.sender === 'driver');
  const lastMsg = negotiation[negotiation.length - 1];
  const isDriverFinalOffer = lastDriverMsg?.isFinal && lastMsg?.sender === 'driver';
  const canCounter = roundCount < 4 && !isDriverFinalOffer;
  const isFinalRound = roundCount === 3;

  useEffect(() => {
    if (currentRide?.status === 'confirmed') router.replace('/ride');
    if (!currentRide || currentRide.status === 'cancelled') router.replace('/(tabs)/');
  }, [currentRide?.status]);

  // Track waiting state
  useEffect(() => {
    if (lastMsg?.sender === 'customer') {
      setWaitingDriver(true);
    } else {
      setWaitingDriver(false);
    }
  }, [negotiation.length]);

  const handleSendOffer = () => {
    const amount = parseInt(offerText.replace(/\D/g, ''), 10);
    if (isNaN(amount) || amount < 100) return;
    setOfferText('');
    proposeFare(amount, isFinalRound);
  };

  const suggestedFare = currentRide?.suggestedFare ?? 0;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
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
            <Text style={styles.driverInitial}>
              {currentRide?.driver?.name?.[0] ?? 'D'}
            </Text>
          </View>
          <View>
            <Text style={[styles.driverName, { color: colors.foreground }]}>
              {currentRide?.driver?.name ?? 'Driver'}
            </Text>
            <Text style={[styles.driverVehicle, { color: colors.mutedForeground }]}>
              {VEHICLE_LABELS[currentRide?.vehicleType ?? 'moto']} · {currentRide?.driver?.plateNumber}
            </Text>
          </View>
        </View>
        <View style={[styles.roundBadge, { backgroundColor: colors.muted }]}>
          <Text style={[styles.roundText, { color: colors.mutedForeground }]}>
            Round {roundCount}/{4}
          </Text>
        </View>
      </View>

      {/* Suggested fare banner */}
      <View style={[styles.fareBanner, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '40' }]}>
        <Feather name="info" size={14} color={colors.primary} />
        <Text style={[styles.fareText, { color: colors.primary }]}>
          Suggested: {suggestedFare.toLocaleString()} RWF · {currentRide?.distance} km
        </Text>
      </View>

      {/* Messages */}
      <FlatList
        ref={listRef}
        data={negotiation}
        keyExtractor={m => m.id}
        renderItem={({ item }) => <MessageBubble msg={item} />}
        contentContainerStyle={styles.messages}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListHeaderComponent={
          negotiation.length === 0 ? (
            <View style={styles.emptyChat}>
              <Text style={[styles.emptyChatText, { color: colors.mutedForeground }]}>
                Propose a fare to begin negotiation
              </Text>
            </View>
          ) : null
        }
      />

      {/* Waiting indicator */}
      {waitingDriver && (
        <View style={styles.waitingRow}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.waitingText, { color: colors.mutedForeground }]}>Driver is responding...</Text>
        </View>
      )}

      {/* Final offer actions */}
      {isDriverFinalOffer && (
        <View style={[styles.finalActions, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <Text style={[styles.finalTitle, { color: colors.foreground }]}>
            Driver's final offer: {lastDriverMsg?.amount.toLocaleString()} RWF
          </Text>
          <View style={styles.finalBtns}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.destructive + '20', borderColor: colors.destructive }]}
              onPress={declineDriverOffer}
            >
              <Text style={[styles.actionBtnText, { color: colors.destructive }]}>Decline</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.primary, flex: 1 }]}
              onPress={acceptDriverOffer}
            >
              <Text style={[styles.actionBtnText, { color: colors.primaryForeground }]}>Accept</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Input */}
      {!isDriverFinalOffer && !waitingDriver && canCounter && (
        <View
          style={[
            styles.inputArea,
            {
              backgroundColor: colors.card,
              borderTopColor: colors.border,
              paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 8),
            },
          ]}
        >
          {isFinalRound && (
            <Text style={[styles.finalHint, { color: colors.warning ?? colors.mutedForeground }]}>
              ⚠ This is your final offer — no further negotiation
            </Text>
          )}
          <View style={styles.inputRow}>
            <View style={[styles.currencyBadge, { backgroundColor: colors.muted }]}>
              <Text style={[styles.currencyText, { color: colors.foreground }]}>RWF</Text>
            </View>
            <TextInput
              style={[styles.offerInput, { color: colors.foreground, borderColor: colors.border }]}
              value={offerText}
              onChangeText={t => setOfferText(t.replace(/\D/g, ''))}
              placeholder={String(Math.round(suggestedFare * 0.85 / 100) * 100)}
              placeholderTextColor={colors.mutedForeground}
              keyboardType="number-pad"
            />
            <TouchableOpacity
              style={[
                styles.sendBtn,
                { backgroundColor: offerText.length > 0 ? colors.primary : colors.muted },
              ]}
              onPress={handleSendOffer}
              disabled={!offerText}
            >
              <Feather name="send" size={18} color={offerText.length > 0 ? colors.primaryForeground : colors.mutedForeground} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={() => { cancelRide(); router.replace('/(tabs)/'); }}>
            <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>Cancel ride</Text>
          </TouchableOpacity>
        </View>
      )}
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
  driverInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  driverAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  driverInitial: { fontSize: 20, fontFamily: 'Inter_700Bold', color: '#000' },
  driverName: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  driverVehicle: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  roundBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100 },
  roundText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  fareBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  fareText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  messages: { padding: 16, gap: 10 },
  bubbleRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-end', marginBottom: 8 },
  bubbleLeft: { justifyContent: 'flex-start' },
  bubbleRight: { justifyContent: 'flex-end' },
  avatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 14, fontFamily: 'Inter_700Bold', color: '#000' },
  bubble: {
    maxWidth: '70%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    gap: 4,
  },
  bubbleSender: { fontSize: 11, fontFamily: 'Inter_500Medium' },
  bubbleAmount: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  emptyChat: { alignItems: 'center', paddingTop: 40, paddingBottom: 20 },
  emptyChatText: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  waitingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, justifyContent: 'center' },
  waitingText: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  finalActions: { padding: 16, gap: 12, borderTopWidth: 1 },
  finalTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
  finalBtns: { flexDirection: 'row', gap: 12 },
  actionBtn: {
    flex: 0.5,
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  actionBtnText: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  inputArea: { borderTopWidth: 1, padding: 16, gap: 10 },
  finalHint: { fontSize: 12, fontFamily: 'Inter_400Regular', textAlign: 'center' },
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
  cancelText: { textAlign: 'center', fontSize: 13, fontFamily: 'Inter_400Regular' },
});
