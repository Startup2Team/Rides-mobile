import { Feather } from '@expo/vector-icons';
import React, { type RefObject } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { GlassScrollView } from '@/components/GlassScrollView';
import { useColors } from '@/hooks/useColors';
import type { NegotiationMessage } from '@/types';
import { formatFare, formatMessageTime } from './negotiationUtils';
import { styles } from './negotiationStyles';

function OfferTimelineItem({ message }: { message: NegotiationMessage }) {
  const colors = useColors();
  const isCustomer = message.sender === 'customer';
  const isDriver = message.sender === 'driver';
  if (message.sender === 'system') {
    return (
      <View style={styles.timelineSystemItem}>
        <View style={[styles.systemBubble, { backgroundColor: colors.muted }]}>
          <Text style={[styles.systemBubbleText, { color: colors.mutedForeground }]}>{message.text}</Text>
        </View>
      </View>
    );
  }
  const textColor = isCustomer ? colors.primaryForeground : colors.foreground;
  return (
    <View style={[styles.timelineItem, isDriver && styles.timelineLeftItem, isCustomer && styles.timelineRightItem]}>
      <View style={[
        styles.bubble,
        isCustomer && styles.bubbleOutgoing,
        isDriver && styles.bubbleIncoming,
        { backgroundColor: isCustomer ? colors.primary : colors.card },
      ]}>
        <Text style={[message.type === 'offer' ? styles.bubbleOfferAmount : styles.bubbleBody, { color: textColor }]}>
          {message.type === 'offer' ? formatFare(message.amount) : message.text}
        </Text>
        <View style={styles.bubbleFooter}>
          {message.isFinal && (
            <View style={[styles.lockedBadge, { backgroundColor: isCustomer ? 'rgba(255,255,255,0.16)' : colors.primaryHex + '18' }]}>
              <Feather name="lock" size={10} color={isCustomer ? colors.primaryForeground : colors.primary} />
            </View>
          )}
          <Text style={[styles.bubbleTime, { color: isCustomer ? colors.primaryForeground + 'B3' : colors.mutedForeground }]}>
            {formatMessageTime(message.timestamp)}
          </Text>
        </View>
      </View>
    </View>
  );
}

export function NegotiationTimeline({
  bottomInset,
  negotiation,
  pendingOfferMessage,
  scrollRef,
  showDriverTyping,
}: {
  bottomInset: number;
  negotiation: NegotiationMessage[];
  pendingOfferMessage: NegotiationMessage | null;
  scrollRef: RefObject<ScrollView | null>;
  showDriverTyping: boolean;
}) {
  const colors = useColors();
  return (
    <GlassScrollView
      ref={scrollRef}
      style={styles.messagesScroll}
      indicatorTop={4}
      indicatorBottom={8}
      contentContainerStyle={[styles.timeline, { paddingHorizontal: 16, paddingBottom: bottomInset }]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      onContentSizeChange={() => {
        requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
      }}
    >
      {negotiation.length === 0 ? (
        <Text style={[styles.emptyTimeline, { color: colors.mutedForeground }]}>
          The first fare offer will appear here.
        </Text>
      ) : negotiation.map(message => <OfferTimelineItem key={message.id} message={message} />)}
      {pendingOfferMessage && <OfferTimelineItem message={pendingOfferMessage} />}
      {showDriverTyping && (
        <View style={styles.timelineLeftItem}>
          <View style={[styles.typingBubble, { backgroundColor: colors.card }]}>
            <ActivityIndicator size="small" color={colors.mutedForeground} />
            <Text style={[styles.typingText, { color: colors.mutedForeground }]}>typingâ€¦</Text>
          </View>
        </View>
      )}
    </GlassScrollView>
  );
}
