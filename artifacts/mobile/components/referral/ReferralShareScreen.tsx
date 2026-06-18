import React, { useEffect, useMemo } from 'react';
import { Alert, Linking, Pressable, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { APP_NAME, APP_SCHEME } from '@/constants/branding';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';
import { ReferralQrCode } from './ReferralQrCode';
import { appendStoredReferralEvent } from '@/persistence/referralEventsPersistence';
import { buildReferralId, buildReferralLink, getReferralPlatform, REFERRAL_EVENT_NAMES } from '@/domain/referrals';

function eventId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function PrimaryButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <TouchableOpacity style={[styles.actionButton, { backgroundColor: colors.primary }]} activeOpacity={0.84} onPress={onPress}>
      <Feather name={icon} size={18} color="#fff" />
      <Text style={styles.actionButtonText}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function ReferralShareScreen() {
  const colors = useColors();
  const { user } = useAuth();
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
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(referralLink);
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
        Alert.alert('Link copied', 'Your invite link was copied to the clipboard.');
        return;
      }
    } catch {
      // fall through to share sheet
    }

    await Share.share({
      title: `${APP_NAME} invite link`,
      message: referralLink,
      url: referralLink,
    });
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

  const handleOpenLink = async () => {
    void appendStoredReferralEvent({
      id: eventId(),
      name: REFERRAL_EVENT_NAMES.linkOpened,
      method: 'open',
      userId: user?.id ?? '',
      referralId,
      referralLink,
      platform: getReferralPlatform(),
      createdAt: new Date().toISOString(),
    });
    await Linking.openURL(referralLink);
  };

  if (!user?.id) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Share App</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>No referral account is available.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.foreground }]}>Share App</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
        Share your invite code or QR so friends can join {APP_NAME}.
      </Text>

      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <ReferralQrCode data={referralLink} />
        <Text style={[styles.linkLabel, { color: colors.mutedForeground }]}>Invite link</Text>
        <Pressable onPress={handleOpenLink} accessibilityRole="link" accessibilityLabel="Open invite link">
          <Text style={[styles.link, { color: colors.primary }]} numberOfLines={2}>
            {referralLink}
          </Text>
        </Pressable>
        <Text style={[styles.code, { color: colors.mutedForeground }]}>Referral ID: {referralId}</Text>
      </View>

      <View style={styles.actions}>
        <PrimaryButton icon="copy" label="Copy link" onPress={() => { void handleCopyLink(); }} />
        <PrimaryButton icon="share-2" label="Share" onPress={() => { void handleShare(); }} />
      </View>

      <View style={[styles.noteCard, { borderColor: colors.border }]}>
        <Text style={[styles.noteTitle, { color: colors.foreground }]}>Backend-ready attribution</Text>
        <Text style={[styles.noteText, { color: colors.mutedForeground }]}>
          QR scans, app installs, and signup attribution are recorded later by backend install attribution and deferred deep linking.
        </Text>
        <Text style={[styles.noteText, { color: colors.mutedForeground }]}>
          Local tracking currently captures link creation, QR display, link sharing, and link opens only.
        </Text>
        <Text style={[styles.noteText, { color: colors.mutedForeground }]}>Custom scheme: {APP_SCHEME}://invite?ref={referralId}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    gap: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 21,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    gap: 12,
    alignItems: 'center',
  },
  linkLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  link: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  code: {
    fontSize: 13,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  noteCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  noteTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  noteText: {
    fontSize: 13,
    lineHeight: 18,
  },
});
