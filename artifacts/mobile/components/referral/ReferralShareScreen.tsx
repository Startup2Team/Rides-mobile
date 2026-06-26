import React, { useEffect, useMemo } from 'react';
import { Platform, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { SymbolView } from 'expo-symbols';
import { APP_NAME } from '@/constants/branding';
import { buttonCornerRadius } from '@/constants/buttons';
import { GlassHeader, useGlassHeaderMetrics } from '@/components/GlassHeader';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useColors } from '@/hooks/useColors';
import { ReferralQrCode } from './ReferralQrCode';
import { appendStoredReferralEvent } from '@/persistence/referralEventsPersistence';
import { buildReferralId, buildReferralLink, getReferralPlatform, REFERRAL_EVENT_NAMES } from '@/domain/referrals';
import { typography } from '@/constants/typography';

function eventId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function PrimaryButton({
  label,
  onPress,
  variant = 'solid',
}: {
  label: string;
  onPress: () => void;
  variant?: 'solid' | 'outline';
}) {
  const colors = useColors();
  const isSolid = variant === 'solid';
  return (
    <TouchableOpacity
      style={[
        styles.actionButton,
        {
          backgroundColor: isSolid ? colors.primary : colors.card,
          borderColor: isSolid ? colors.primary : colors.border,
        },
      ]}
      activeOpacity={0.84}
      onPress={onPress}
    >
      {Platform.OS === 'ios' ? (
        <SymbolView
          name="square.and.arrow.up"
          size={20}
          tintColor={isSolid ? '#fff' : colors.foreground}
        />
      ) : (
        <Ionicons name="share-outline" size={21} color={isSolid ? '#fff' : colors.foreground} />
      )}
      <Text style={[styles.actionButtonText, { color: isSolid ? '#fff' : colors.foreground }]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function ReferralShareScreen() {
  const colors = useColors();
  const headerMetrics = useGlassHeaderMetrics();
  const { user } = useAuth();
  const { showToast } = useToast();
  const referralLink = useMemo(() => buildReferralLink(user?.id ?? ''), [user?.id]);
  const referralId = useMemo(() => buildReferralId(user?.id ?? ''), [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const platform = getReferralPlatform();
    const base = {
      userId: user.id,
      referralId,
      referralLink,
      platform,
      createdAt: new Date().toISOString(),
    };
    void appendStoredReferralEvent({
      id: eventId(),
      name: REFERRAL_EVENT_NAMES.linkCreated,
      method: 'display',
      ...base,
    });
    void appendStoredReferralEvent({
      id: eventId(),
      name: REFERRAL_EVENT_NAMES.qrDisplayed,
      method: 'display',
      ...base,
    });
  }, [referralId, referralLink, user?.id]);

  const handleCopyLink = async () => {
    try {
      if (Clipboard?.setStringAsync) {
        await Clipboard.setStringAsync(referralLink);
      } else if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(referralLink);
      } else {
        throw new Error('Clipboard unavailable');
      }
      void appendStoredReferralEvent({
        id: eventId(),
        name: REFERRAL_EVENT_NAMES.linkShared,
        method: 'copy',
        userId: user?.id ?? '',
        referralId,
        referralLink,
        platform: getReferralPlatform(),
        createdAt: new Date().toISOString(),
      });
      showToast('Link copied', 'success');
    } catch {
      showToast('Unable to copy link', 'error');
    }
  };

  const handleShare = async () => {
    await Share.share({
      title: `Share ${APP_NAME}`,
      message: `Join me on ${APP_NAME}: ${referralLink}`,
      url: referralLink,
    });
    void appendStoredReferralEvent({
      id: eventId(),
      name: REFERRAL_EVENT_NAMES.linkShared,
      method: 'share',
      userId: user?.id ?? '',
      referralId,
      referralLink,
      platform: getReferralPlatform(),
      createdAt: new Date().toISOString(),
    });
  };

  if (!user?.id) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <GlassHeader title={`Invite people to ${APP_NAME}`} subtitle="Share your link or QR" />
        <View style={[styles.container, { paddingTop: headerMetrics.contentTop }]}>
          <Text style={[styles.emptyState, { color: colors.mutedForeground }]}>No referral account is available.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <GlassHeader title={`Invite people to ${APP_NAME}`} subtitle="Share your link or QR" />
      <View style={[styles.container, { paddingTop: headerMetrics.contentTop }]}>
        <Text style={[styles.helpText, { color: colors.mutedForeground }]}>
          Ask a friend to scan the QR code, copy the link and send it in chat or contacts, or tap Share to choose social apps and messaging.
        </Text>

        <View style={styles.qrSection}>
          <View style={[styles.qrFrame, { backgroundColor: '#FFFFFF', borderColor: colors.border }]}>
            <View style={styles.qrCenter}>
              <ReferralQrCode data={referralLink} size={256} />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.linkCard, { backgroundColor: colors.input }]}
            activeOpacity={0.76}
            onPress={() => {
              void handleCopyLink();
            }}
            accessibilityRole="button"
            accessibilityLabel="Copy invite link"
          >
            <Text style={[styles.linkText, { color: colors.foreground }]} numberOfLines={1}>
              {referralLink}
            </Text>
            <Feather name="copy" size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.actions}>
          <PrimaryButton label="Share" onPress={() => { void handleShare(); }} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 18,
    gap: 14,
    justifyContent: 'flex-start',
  },
  emptyState: {
    ...typography.bodySmall,
    lineHeight: 20,
  },
  helpText: {
    ...typography.bodySmall,
    lineHeight: 19,
  },
  qrSection: {
    gap: 4,
    marginTop: 56,
  },
  qrFrame: {
    alignSelf: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 0,
    padding: 1,
  },
  qrCenter: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 0,
  },
  linkCard: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 6,
    marginTop: 42,
    paddingHorizontal: 15,
  },
  linkText: {
    flex: 1,
    ...typography.title,
    lineHeight: 22,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    flex: 1,
    borderRadius: buttonCornerRadius(48),
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
  },
  actionButtonText: {
    ...typography.bodySmall,
    fontFamily: typography.badge.fontFamily,
  },
});
