import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import type { NegotiationStatusTone } from './negotiationUtils';
import { styles } from './negotiationStyles';

export function NegotiationStatusCard({
  hint,
  maxOffers,
  offersRemaining,
  offersSent,
  title,
  tone,
}: {
  hint: string;
  maxOffers: number;
  offersRemaining: number;
  offersSent: number;
  title: string;
  tone: NegotiationStatusTone;
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
          <Feather
            name={
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
            <Text style={[styles.offersLeftText, { color: colors.foreground }]}>{offersRemaining}</Text>
            <Text style={[styles.offersLeftLabel, { color: colors.mutedForeground }]}>left</Text>
          </View>
        )}
      </View>

      <View style={styles.offerProgressRow}>
        {Array.from({ length: maxOffers }, (_, index) => (
          <View
            key={index}
            style={[
              styles.offerProgressSegment,
              {
                backgroundColor: index < offersSent
                  ? tone === 'limit' && index === maxOffers - 1
                    ? colors.destructive
                    : colors.primary
                  : colors.border,
              },
            ]}
          />
        ))}
      </View>
      <Text style={[styles.offerProgressLabel, { color: colors.mutedForeground }]}>
        {offersSent === 0
          ? `You can send up to ${maxOffers} fare offers`
          : offersSent >= maxOffers
            ? 'All offers sent. Call Passenger to continue'
            : `${offersSent} of ${maxOffers} offers sent`}
      </Text>
    </View>
  );
}
