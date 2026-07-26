import React, { useEffect, useMemo } from 'react';
import { Platform, Share, StyleSheet, Text, TouchableOpacity, View, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import QRCode from 'qrcode';
import { LinearGradient } from 'expo-linear-gradient';
import { APP_NAME } from '@/constants/branding';
import { GlassHeader, useGlassHeaderMetrics } from '@/components/GlassHeader';
import { useToast } from '@/context/ToastContext';
import { useColors } from '@/hooks/useColors';
import { ReferralQrCode } from './ReferralQrCode';
import { appendStoredReferralEvent } from '@/persistence/referralEventsPersistence';
import { buildReferralId, buildReferralLink, getReferralPlatform, REFERRAL_EVENT_NAMES } from '@/domain/referrals';
import { useProfile } from '@/domains/profile';
import { openExternalUrl } from '@/utils/openExternalUrl';

function eventId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export default function ReferralShareScreen() {
  const colors = useColors();
  const headerMetrics = useGlassHeaderMetrics();
  const insets = useSafeAreaInsets();
  const { user, profile, driverProfile } = useProfile();
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

  const handleShareCode = async () => {
    try {
      if (!FileSystem.cacheDirectory) {
        throw new Error('Cache directory unavailable');
      }

      const fileUri = `${FileSystem.cacheDirectory}rides_invite_qr.svg`;
      const svg = await QRCode.toString(referralLink, {
        type: 'svg',
        width: 500,
        margin: 2,
        errorCorrectionLevel: 'M',
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });

      await FileSystem.writeAsStringAsync(fileUri, svg, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'image/svg+xml',
          dialogTitle: 'Share QR code',
          UTI: 'public.svg-image',
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
      } else {
        showToast('Sharing is not available on this device', 'error');
      }
    } catch (error: any) {
      showToast(`Failed to share QR code: ${error?.message || error}`, 'error');
    }
  };

  const handleLearnMore = async () => {
    await openExternalUrl('https://rides.rw/faq');
  };

  if (!user?.id) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <GlassHeader title="QR code" />
        <View style={[styles.container, { paddingTop: headerMetrics.contentTop }]}>
          <Text style={[styles.emptyState, { color: colors.mutedForeground }]}>
            No referral account is available.
          </Text>
        </View>
      </View>
    );
  }

  const profileName = profile?.fullName || user?.name || 'Rides Partner';
  const profileImage = profile?.profilePhoto?.uri || driverProfile?.profileImage;
  const profileInitial = (profileName || '?').trim()[0].toUpperCase();

  const footerText = user?.isDriver
    ? 'Your customer can scan this code to start a ride with you.'
    : `Your friend can scan this code to sign up and start riding with ${APP_NAME}.`;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* No "Scan" action yet — the header button was a no-op ("coming soon"
          toast), so it's hidden until an in-app scanner actually ships. */}
      <GlassHeader title="QR code" />
      <View style={[styles.container, { paddingTop: headerMetrics.contentTop, paddingBottom: Math.max(insets.bottom, 16) + 56 }]}>
        <View style={styles.cardContainer}>
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            {/* Circular Avatar overlapping the top edge */}
            <View style={[styles.avatarOverlap, { borderColor: colors.card, backgroundColor: colors.card }]}>
              {profileImage ? (
                <Image source={{ uri: profileImage }} style={styles.avatarImage} />
              ) : (
                <LinearGradient
                  colors={['#9DBBE0', '#7984C3']}
                  style={styles.avatarPlaceholder}
                >
                  <Text style={styles.avatarInitial}>{profileInitial}</Text>
                </LinearGradient>
              )}
            </View>

            {/* Profile Info */}
            <Text style={[styles.nameText, { color: colors.foreground }]} numberOfLines={1}>{profileName}</Text>



            <Text style={[styles.descriptorText, { color: colors.mutedForeground }]}>
              {user?.isDriver ? 'Rides Partner Account' : 'Rides Account'}
            </Text>

            {/* QR Code section */}
            <View style={styles.qrContainer}>
              <ReferralQrCode data={referralLink} size={180} />
            </View>
          </View>
        </View>

        {/* Footer Text */}
        <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
          {footerText}{' '}
          <Text style={[styles.learnMoreText, { color: colors.primary }]} onPress={handleLearnMore}>
            Learn More
          </Text>
        </Text>

        {/* Action Buttons Section */}
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity
            style={styles.actionButtonCol}
            onPress={handleShare}
            activeOpacity={0.7}
          >
            <View style={[styles.actionCircle, { backgroundColor: colors.card === '#FFFFFF' ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.08)' }]}>
              <Feather name="share" size={20} color={colors.foreground} />
            </View>
            <Text style={[styles.actionLabel, { color: colors.foreground }]}>Share link</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButtonCol}
            onPress={handleCopyLink}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Copy invite link"
          >
            <View style={[styles.actionCircle, { backgroundColor: colors.card === '#FFFFFF' ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.08)' }]}>
              <Feather name="copy" size={20} color={colors.foreground} />
            </View>
            <Text style={[styles.actionLabel, { color: colors.foreground }]}>Copy link</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButtonCol}
            onPress={handleShareCode}
            activeOpacity={0.7}
          >
            <View style={[styles.actionCircle, { backgroundColor: colors.card === '#FFFFFF' ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.08)' }]}>
              <Ionicons name="qr-code-outline" size={20} color={colors.foreground} />
            </View>
            <Text style={[styles.actionLabel, { color: colors.foreground }]}>Share code</Text>
          </TouchableOpacity>
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
    paddingHorizontal: 24,
    paddingBottom: 24,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  emptyState: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 40,
  },
  headerRight: {
    marginLeft: 'auto',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  headerRightText: {
    fontSize: 16,
    fontWeight: '600',
  },
  cardContainer: {
    width: '100%',
    marginTop: 64, // space to account for the overlapping avatar
    alignItems: 'center',
  },
  card: {
    width: '100%',
    borderRadius: 20,
    paddingTop: 56, // space from top of card to the name text
    paddingBottom: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 6,
  },
  avatarOverlap: {
    position: 'absolute',
    top: -44, // overlaps the top card border
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 4,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 40,
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  nameText: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
  },

  descriptorText: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 28,
  },
  qrContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },

  footerText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 16,
    marginTop: 20,
    marginBottom: 'auto',
  },
  learnMoreText: {
    fontWeight: '600',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 24,
  },
  actionButtonCol: {
    alignItems: 'center',
    flex: 1,
  },
  actionCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionLabel: {
    fontSize: 12,
    marginTop: 8,
    fontWeight: '500',
    textAlign: 'center',
  },
});
