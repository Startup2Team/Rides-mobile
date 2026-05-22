import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Modal,
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
  const isRider = msg.sender === 'driver';
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
    <View style={[styles.bubbleRow, isRider ? styles.bubbleRight : styles.bubbleLeft]}>
      {!isRider && (
        <View style={[styles.avatar, { backgroundColor: colors.muted }]}>
          <Feather name="user" size={16} color={colors.foreground} />
        </View>
      )}
      <View style={[styles.bubble, {
        backgroundColor: isRider ? colors.primary : colors.card,
        borderColor: isRider ? colors.primary : colors.border,
      }]}>
        <Text style={[styles.bubbleSender, {
          color: isRider ? colors.primaryForeground + 'AA' : colors.mutedForeground,
        }]}>
          {isRider ? 'You' : 'Customer'}
          {msg.isFinal ? ' · Accepted' : ''}
        </Text>
        {msg.type === 'offer' && msg.amount != null ? (
          <Text style={[styles.bubbleAmount, {
            color: isRider ? colors.primaryForeground : colors.foreground,
          }]}>
            {msg.amount.toLocaleString()} RWF
          </Text>
        ) : (
          <Text style={[styles.bubbleText, {
            color: isRider ? colors.primaryForeground : colors.foreground,
          }]}>
            {msg.text}
          </Text>
        )}
      </View>
    </View>
  );
}

export default function DriverNegotiationScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { currentRide, counterOffer, cancelRide, riderAcceptWithFare } = useRide();

  const [offerText, setOfferText] = useState('');
  const [showAgreedModal, setShowAgreedModal] = useState(false);
  const [agreedAmount, setAgreedAmount] = useState('');
  const [agreedError, setAgreedError] = useState('');
  const listRef = useRef<FlatList>(null);

  const negotiation = currentRide?.negotiation ?? [];
  const riderMessages = negotiation.filter(m => m.sender === 'driver' && m.type === 'offer');
  const customerMessages = negotiation.filter(m => m.sender === 'customer');
  const lastCustomerOffer = [...customerMessages].pop();

  const riderMsgCount = riderMessages.length;
  const limitReached = riderMsgCount >= MAX_MESSAGES || customerMessages.length >= MAX_MESSAGES;
  const hasRiderSentOffer = riderMsgCount > 0;
  const canSendOffer = riderMsgCount < MAX_MESSAGES;

  useEffect(() => {
    if (currentRide?.status === 'confirmed' || currentRide?.status === 'arriving') {
      router.replace('/driver-navigate');
    }
    if (!currentRide || currentRide.status === 'cancelled') {
      router.replace('/(driver)');
    }
  }, [currentRide?.status]);

  const handleSendOffer = () => {
    const amount = parseInt(offerText.replace(/\D/g, ''), 10);
    if (isNaN(amount) || amount <= 0) return;
    setOfferText('');
    counterOffer(amount);
  };

  const handleCall = () => {
    const phone = currentRide?.customerPhone ?? '';
    if (phone) {
      Linking.openURL(`tel:${phone}`).catch(() => {
        Alert.alert('Cannot call', 'Unable to open the phone dialler.');
      });
    }
  };

  const handleAccept = () => {
    setAgreedAmount(lastCustomerOffer?.amount?.toString() ?? '');
    setAgreedError('');
    setShowAgreedModal(true);
  };

  const handleConfirmAgreed = () => {
    const amount = parseInt(agreedAmount.replace(/\D/g, ''), 10);
    if (isNaN(amount) || amount <= 0) {
      setAgreedError('Please enter a valid amount');
      return;
    }
    setShowAgreedModal(false);
    riderAcceptWithFare(amount);
  };

  const handleDecline = () => {
    Alert.alert(
      'Decline ride',
      'Decline this negotiation? The request will return to the pool.',
      [
        { text: 'Back', style: 'cancel' },
        { text: 'Decline', style: 'destructive', onPress: () => { cancelRide(); router.replace('/(driver)'); } },
      ]
    );
  };

  if (!currentRide) return null;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.header, {
        paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 0) + 12,
        backgroundColor: colors.background,
        borderBottomColor: colors.border,
      }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Negotiation</Text>
          <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
            {VEHICLE_LABELS[currentRide.vehicleType]} · {currentRide.customerName ?? 'Customer'}
          </Text>
        </View>
        <View style={[styles.counterBadge, { backgroundColor: colors.muted }]}>
          <Text style={[styles.counterText, { color: limitReached ? colors.destructive : colors.mutedForeground }]}>
            {riderMsgCount} / {MAX_MESSAGES} messages used
          </Text>
        </View>
      </View>

      <View style={[styles.customerCard, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={styles.customerCardRow}>
          <View style={[styles.customerAvatar, { backgroundColor: colors.muted }]}>
            <Feather name="user" size={20} color={colors.foreground} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.customerName, { color: colors.foreground }]}>
              {currentRide.customerName ?? 'Customer'}
            </Text>
            <Text style={[styles.routeText, { color: colors.mutedForeground }]} numberOfLines={1}>
              {currentRide.pickup.address ?? 'Pickup'} → {' '}
              {currentRide.destination.locationType === 'generic'
                ? `${currentRide.destination.address ?? 'Unknown'} (to confirm)`
                : (currentRide.destination.address ?? 'Destination')}
            </Text>
          </View>
        </View>
        {currentRide.destination.locationType === 'generic' && (
          <View style={[styles.genericBadge, { backgroundColor: WARNING + '20', borderColor: WARNING + '40' }]}>
            <Feather name="alert-circle" size={12} color={WARNING} />
            <Text style={[styles.genericText, { color: WARNING }]}>
              Unknown / Generic destination — negotiate exact location
            </Text>
          </View>
        )}
      </View>

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
                Send your price offer to begin negotiation
              </Text>
            </View>
          ) : null
        }
      />

      {limitReached && (
        <View style={[styles.limitBanner, { backgroundColor: colors.destructive + '12' }]}>
          <Feather name="alert-circle" size={14} color={colors.destructive} />
          <Text style={[styles.limitText, { color: colors.destructive }]}>
            Message limit reached. Use Call button to continue.
          </Text>
        </View>
      )}

      <View style={[styles.actionPanel, {
        backgroundColor: colors.background,
        borderTopColor: colors.border,
        paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 8),
      }]}>
        {canSendOffer && !limitReached && (
          <View style={styles.inputRow}>
            <View style={[styles.currencyBadge, { backgroundColor: colors.muted }]}>
              <Text style={[styles.currencyText, { color: colors.foreground }]}>RWF</Text>
            </View>
            <TextInput
              style={[styles.offerInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
              value={offerText}
              onChangeText={t => { setOfferText(t.replace(/\D/g, '')); }}
              placeholder={hasRiderSentOffer ? 'Adjust your offer...' : 'Your price offer'}
              placeholderTextColor={colors.mutedForeground}
              keyboardType="number-pad"
            />
            <TouchableOpacity
              style={[styles.sendBtn, { backgroundColor: offerText.length > 0 ? colors.primary : colors.muted }]}
              onPress={handleSendOffer}
              disabled={!offerText}
            >
              <Feather name="send" size={18} color={offerText.length > 0 ? colors.primaryForeground : colors.mutedForeground} />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.mainActions}>
          <TouchableOpacity
            style={[styles.actionBtn, { borderColor: colors.destructive, backgroundColor: colors.destructive + '10' }]}
            onPress={handleDecline}
          >
            <Feather name="x" size={16} color={colors.destructive} />
            <Text style={[styles.actionBtnText, { color: colors.destructive }]}>Decline</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { borderColor: colors.border, backgroundColor: colors.muted }]}
            onPress={handleCall}
          >
            <Feather name="phone" size={16} color={colors.foreground} />
            <Text style={[styles.actionBtnText, { color: colors.foreground }]}>Call</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.acceptBtn, {
              backgroundColor: hasRiderSentOffer ? colors.primary : colors.muted,
              borderColor: 'transparent',
              opacity: hasRiderSentOffer ? 1 : 0.5,
            }]}
            onPress={handleAccept}
            disabled={!hasRiderSentOffer}
          >
            <Feather name="check" size={16} color={hasRiderSentOffer ? colors.primaryForeground : colors.mutedForeground} />
            <Text style={[styles.actionBtnText, { color: hasRiderSentOffer ? colors.primaryForeground : colors.mutedForeground }]}>
              Accept
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <Modal
        visible={showAgreedModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAgreedModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Enter Final Agreed Amount</Text>
            <Text style={[styles.modalSub, { color: colors.mutedForeground }]}>
              This amount will be shown to both you and the customer.
            </Text>
            <View style={[styles.modalInputRow, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <Text style={[styles.modalCurrency, { color: colors.mutedForeground }]}>RWF</Text>
              <TextInput
                style={[styles.modalInput, { color: colors.foreground }]}
                value={agreedAmount}
                onChangeText={t => { setAgreedAmount(t.replace(/\D/g, '')); setAgreedError(''); }}
                keyboardType="number-pad"
                placeholder="e.g. 2500"
                placeholderTextColor={colors.mutedForeground}
                autoFocus
              />
            </View>
            {agreedError ? <Text style={[styles.modalError, { color: colors.destructive }]}>{agreedError}</Text> : null}
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}
                onPress={() => setShowAgreedModal(false)}
              >
                <Text style={[styles.modalBtnText, { color: colors.foreground }]}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalConfirmBtn, { backgroundColor: colors.primary }]}
                onPress={handleConfirmAgreed}
              >
                <Text style={[styles.modalBtnText, { color: colors.primaryForeground }]}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  },
  headerLeft: { flex: 1, gap: 2 },
  headerTitle: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  headerSub: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  counterBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100 },
  counterText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  customerCard: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 10,
  },
  customerCardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  customerAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  customerName: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  routeText: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  genericBadge: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  genericText: { flex: 1, fontSize: 12, fontFamily: 'Inter_400Regular' },
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
  bubble: { maxWidth: '70%', borderRadius: 16, borderWidth: 1, padding: 12, gap: 4 },
  bubbleSender: { fontSize: 11, fontFamily: 'Inter_500Medium' },
  bubbleAmount: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  bubbleText: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 20 },
  emptyChat: { alignItems: 'center', paddingTop: 40, paddingBottom: 20 },
  emptyChatText: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  limitBanner: { flexDirection: 'row', gap: 8, padding: 12, alignItems: 'center', marginHorizontal: 16, borderRadius: 10, marginBottom: 4 },
  limitText: { flex: 1, fontSize: 12, fontFamily: 'Inter_400Regular' },
  actionPanel: { borderTopWidth: 1, padding: 16, gap: 12 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  currencyBadge: { height: 48, paddingHorizontal: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  currencyText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  offerInput: {
    flex: 1, height: 48, borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 14, fontSize: 18, fontFamily: 'Inter_600SemiBold',
  },
  sendBtn: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
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
  acceptBtn: { flex: 1 },
  actionBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    gap: 16,
  },
  modalTitle: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  modalSub: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 20 },
  modalInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 56,
    gap: 10,
  },
  modalCurrency: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  modalInput: { flex: 1, fontSize: 22, fontFamily: 'Inter_700Bold' },
  modalError: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  modalBtns: { flexDirection: 'row', gap: 12 },
  modalBtn: {
    flex: 1,
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalConfirmBtn: { borderWidth: 0 },
  modalBtnText: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
});
