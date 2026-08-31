import { Feather } from '@expo/vector-icons';
import React, { type RefObject } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { GlassScrollView } from '@/components/GlassScrollView';
import { useColors } from '@/hooks/useColors';
import type { NegotiationMessage } from '@/types';
import { formatFare, formatMessageTime } from './negotiationUtils';
import { styles } from './negotiationStyles';

function OfferTimelineItem({
  message,
  perspective = 'customer',
  onRetry,
}: {
  message: NegotiationMessage;
  perspective?: 'customer' | 'driver';
  onRetry?: (message: NegotiationMessage) => void;
}) {
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
  const isOutgoing = perspective === 'customer' ? isCustomer : isDriver;
  const textColor = isOutgoing ? colors.primaryForeground : colors.foreground;
  // Delivery state only ever applies to the viewer's own outgoing messages —
  // anything that arrived from the server (socket echo, history replay) has
  // no deliveryStatus and is already confirmed delivered.
  const isPending = isOutgoing && message.deliveryStatus === 'pending';
  const isFailed = isOutgoing && message.deliveryStatus === 'failed';
  const bubble = (
    <View style={[
      styles.bubble,
      isOutgoing ? styles.bubbleOutgoing : styles.bubbleIncoming,
      { backgroundColor: isOutgoing ? colors.primary : colors.card },
      isPending && styles.bubblePending,
    ]}>
      <Text style={[message.type === 'offer' ? styles.bubbleOfferAmount : styles.bubbleBody, { color: textColor }]}>
        {message.type === 'offer' ? formatFare(message.amount) : message.text}
      </Text>
      <View style={styles.bubbleFooter}>
        {message.isFinal && (
          <View style={[styles.lockedBadge, { backgroundColor: isOutgoing ? 'rgba(255,255,255,0.16)' : colors.primaryHex + '18' }]}>
            <Feather name="lock" size={10} color={isOutgoing ? colors.primaryForeground : colors.primary} />
          </View>
        )}
        {isPending && (
          <ActivityIndicator
            size="small"
            color={isOutgoing ? colors.primaryForeground : colors.mutedForeground}
            style={styles.deliveryIndicator}
          />
        )}
        {isFailed && (
          <Feather name="alert-circle" size={12} color={colors.destructive} style={styles.deliveryIndicator} />
        )}
        <Text style={[styles.bubbleTime, { color: isOutgoing ? colors.primaryForeground + 'B3' : colors.mutedForeground }]}>
          {formatMessageTime(message.timestamp)}
        </Text>
      </View>
    </View>
  );

  if (!isFailed || !onRetry) {
    return (
      <View style={[styles.timelineItem, isOutgoing ? styles.timelineRightItem : styles.timelineLeftItem]}>
        {bubble}
      </View>
    );
  }

  return (
    <View style={[styles.timelineItem, isOutgoing ? styles.timelineRightItem : styles.timelineLeftItem]}>
      <TouchableOpacity
        onPress={() => onRetry(message)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        // TODO(i18n)
        accessibilityLabel="Message failed to send. Tap send to retry."
      >
        {bubble}
        <Text style={[styles.retryHint, { color: colors.destructive }]}>
          {/* TODO(i18n) */}
          Tap to retry
        </Text>
      </TouchableOpacity>
    </View>
  );
}

export function NegotiationTimeline({
  bottomInset,
  negotiation,
  onRetryMessage,
  pendingOfferMessage,
  scrollRef,
  showDriverTyping,
  perspective = 'customer',
}: {
  bottomInset: number;
  negotiation: NegotiationMessage[];
  onRetryMessage?: (message: NegotiationMessage) => void;
  pendingOfferMessage: NegotiationMessage | null;
  scrollRef: RefObject<ScrollView | null>;
  showDriverTyping: boolean;
  perspective?: 'customer' | 'driver';
}) {
  const colors = useColors();
  const typingPosition = styles.timelineLeftItem;
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
      ) : negotiation.map(message => (
        <OfferTimelineItem key={message.id} message={message} perspective={perspective} onRetry={onRetryMessage} />
      ))}
      {pendingOfferMessage && <OfferTimelineItem message={pendingOfferMessage} perspective={perspective} />}
      {showDriverTyping && (
        <View style={typingPosition}>
          <View style={[styles.typingBubble, { backgroundColor: colors.card }]}>
            <ActivityIndicator size="small" color={colors.mutedForeground} />
            <Text style={[styles.typingText, { color: colors.mutedForeground }]}>typing…</Text>
          </View>
        </View>
      )}
    </GlassScrollView>
  );
}
