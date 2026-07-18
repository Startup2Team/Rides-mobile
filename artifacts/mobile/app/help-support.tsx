import React, { useState } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { GlassHeader, useGlassHeaderMetrics } from '@/components/GlassHeader';
import { GlassScrollView } from '@/components/GlassScrollView';
import { SAFETY_EMAIL, SUPPORT_EMAIL } from '@/constants/branding';
import { FORM_BOTTOM_PADDING } from '@/constants/tabBar';
import { useColors } from '@/hooks/useColors';
import { openExternalUrl } from '@/utils/openExternalUrl';
import { usePressGuard } from '@/hooks/usePressGuard';
import { typography } from '@/constants/typography';
import { icons } from '@/constants/icons';
import { radius } from '@/constants/radius';
import { sizes } from '@/constants/sizes';
import { spacing, semanticSpacing } from '@/constants/spacing';

const FAQS = [
  {
    q: 'How do I cancel a ride?',
    a: 'You can cancel during negotiation by tapping the cancel button. Once a driver is confirmed and arriving, cancellation may attract a small fee.',
  },
  {
    q: 'How does fare negotiation work?',
    a: 'The app suggests a fair fare based on distance. You and the driver can each make up to 3 counter-offers. When both agree, the ride is confirmed.',
  },
  {
    q: 'What payment methods are accepted?',
    a: 'Customers pay drivers directly using MTN Mobile Money, Airtel Money, or cash.',
  },
  {
    q: 'How do I report a safety issue?',
    a: `Use the SOS button during an active ride to get emergency contacts. For non-emergency reports, email us at ${SAFETY_EMAIL}.`,
  },
  {
    q: 'My driver did not show up — what do I do?',
    a: 'Call the driver first using the in-app call button. If unreachable, cancel the ride. You will not be charged a cancellation fee.',
  },
  {
    q: 'How are driver ratings calculated?',
    a: 'You can rate a completed trip in the app. Driver averages are based on submitted trip ratings.',
  },
];

const CONTACT_CHANNELS = [
  {
    id: 'phone',
    icon: 'phone' as const,
    label: 'Call Support',
    // TODO: real support number — placeholder until Rides publishes a live support line.
    detail: '+250 788 123 456',
    onPress: () => void openExternalUrl('tel:+250788123456'),
  },
  {
    id: 'email',
    icon: 'mail' as const,
    label: 'Email Us',
    detail: SUPPORT_EMAIL,
    onPress: () => void openExternalUrl(`mailto:${SUPPORT_EMAIL}`),
  },
  {
    id: 'whatsapp',
    icon: 'whatsapp' as const,
    label: 'WhatsApp',
    detail: 'Chat with us',
    // TODO: real support WhatsApp number — placeholder wa.me link.
    onPress: () => void openExternalUrl('https://wa.me/250788123456'),
    family: 'mci' as const,
  },
];

export default function HelpSupportScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const headerMetrics = useGlassHeaderMetrics();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <GlassHeader title="Help and Support" />

      <GlassScrollView
        indicatorTop={headerMetrics.indicatorTop}
        contentContainerStyle={[styles.scroll, { paddingTop: headerMetrics.contentTop, paddingBottom: insets.bottom + FORM_BOTTOM_PADDING }]}
      >
        {/* Contact */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Contact Us</Text>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          {CONTACT_CHANNELS.map((ch, i) => (
            <ContactRow key={ch.id} index={i} channel={ch} />
          ))}
        </View>

        {/* FAQs */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Frequently Asked Questions</Text>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          {FAQS.map((faq, i) => {
            const isOpen = openFaq === i;
            return (
              <View key={i}>
                {i > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
                <TouchableOpacity
                  style={styles.faqRow}
                  onPress={() => setOpenFaq(isOpen ? null : i)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.faqQuestion, { color: colors.foreground, flex: 1 }]}>{faq.q}</Text>
                  <Feather name={isOpen ? 'chevron-up' : 'chevron-down'} size={icons.semantic.button} color={colors.mutedForeground} />
                </TouchableOpacity>
                {isOpen && (
                  <View style={[styles.faqAnswer, { borderTopColor: colors.border }]}>
                    <Text style={[styles.faqAnswerText, { color: colors.mutedForeground }]}>{faq.a}</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Response time */}
        {/* TODO: real support number / SLA — the response-time and hours below are placeholders. */}
        <View style={[styles.infoBox, { backgroundColor: colors.muted }]}>
         <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
            Average response time: under 2 hours · Available 7 days a week, 7 AM – 10 PM
          </Text>
        </View>
      </GlassScrollView>
    </View>
  );
}

function ContactRow({ index, channel }: { index: number; channel: typeof CONTACT_CHANNELS[number] }) {
  const colors = useColors();
  const guardedPress = usePressGuard(channel.onPress);
  return (
    <View>
      {index > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
      <TouchableOpacity style={styles.contactRow} onPress={guardedPress} activeOpacity={0.75}>
        <View style={styles.contactIcon}>
          {channel.family === 'mci' ? (
            <MaterialCommunityIcons name={channel.icon as keyof typeof MaterialCommunityIcons.glyphMap} size={icons.size.lg} color={colors.primary} />
          ) : (
            <Feather name={channel.icon as keyof typeof Feather.glyphMap} size={icons.size.lg} color={colors.primary} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.contactLabel, { color: colors.foreground }]}>{channel.label}</Text>
          <Text style={[styles.contactDetail, { color: colors.mutedForeground }]}>{channel.detail}</Text>
        </View>
        <Feather name="chevron-right" size={icons.semantic.button} color={colors.mutedForeground} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: semanticSpacing.screenPadding },
  sectionLabel: {
    ...typography.bodySmall,
    fontFamily: typography.title.fontFamily,
    letterSpacing: 0,
    marginBottom: spacing[10],
    marginTop: semanticSpacing.sectionGap,
  },
  card: {
    borderRadius: radius.card,
    overflow: 'hidden',
    ...Platform.select({
      ios: { borderCurve: 'continuous' },
    }),
  },
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: semanticSpacing.listItemPadding },
  contactRow: { flexDirection: 'row', alignItems: 'center', padding: semanticSpacing.listItemPadding, gap: semanticSpacing.rowGap },
  contactIcon: { width: sizes.avatar.md, height: sizes.avatar.md, borderRadius: radius.input, alignItems: 'center', justifyContent: 'center' },
  contactLabel: { ...typography.bodySmall, fontFamily: typography.title.fontFamily },
  contactDetail: { ...typography.caption, fontFamily: typography.body.fontFamily, marginTop: spacing[2] },
  faqRow: { flexDirection: 'row', alignItems: 'center', padding: semanticSpacing.listItemPadding, gap: semanticSpacing.rowGap },
  faqQuestion: { ...typography.bodySmall, fontFamily: typography.title.fontFamily, lineHeight: 20 },
  faqAnswer: { paddingHorizontal: semanticSpacing.listItemPadding, paddingBottom: semanticSpacing.listItemPadding, borderTopWidth: StyleSheet.hairlineWidth },
  faqAnswerText: { ...typography.label, fontFamily: typography.body.fontFamily, lineHeight: 20, marginTop: spacing[10] },
  infoBox: {
    flexDirection: 'row',
    gap: semanticSpacing.inlineGap,
    padding: semanticSpacing.listItemPadding,
    borderRadius: radius.card,
    marginTop: spacing[20],
    alignItems: 'flex-start',
    ...Platform.select({
      ios: { borderCurve: 'continuous' },
    }),
  },
  infoText: { flex: 1, ...typography.caption, fontFamily: typography.body.fontFamily, lineHeight: 18 },
});
