import React, { useState } from 'react';
import {
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { GlassHeader, useGlassHeaderMetrics } from '@/components/GlassHeader';
import { GlassScrollView } from '@/components/GlassScrollView';
import { SAFETY_EMAIL, SUPPORT_EMAIL } from '@/constants/branding';
import { useColors } from '@/hooks/useColors';

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
    a: 'We accept MTN Mobile Money, Airtel Money, and cash. You can manage payment methods in your profile.',
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
    a: 'Ratings are averaged from all customer reviews. Drivers below 4.0 are reviewed by our team.',
  },
];

const CONTACT_CHANNELS = [
  {
    id: 'phone',
    icon: 'phone' as const,
    label: 'Call Support',
    detail: '+250 788 123 456',
    onPress: () => Linking.openURL('tel:+250788123456'),
  },
  {
    id: 'email',
    icon: 'mail' as const,
    label: 'Email Us',
    detail: SUPPORT_EMAIL,
    onPress: () => Linking.openURL(`mailto:${SUPPORT_EMAIL}`),
  },
  {
    id: 'whatsapp',
    icon: 'message-circle' as const,
    label: 'WhatsApp',
    detail: 'Chat with us',
    onPress: () => Linking.openURL('https://wa.me/250788123456'),
  },
];

export default function HelpSupportScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const headerMetrics = useGlassHeaderMetrics();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <GlassHeader title="Help & Support" subtitle="We're here for you" />

      <GlassScrollView
        indicatorTop={headerMetrics.indicatorTop}
        contentContainerStyle={[styles.scroll, { paddingTop: headerMetrics.contentTop, paddingBottom: insets.bottom + 32 }]}
      >
        {/* Contact */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>CONTACT US</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {CONTACT_CHANNELS.map((ch, i) => (
            <View key={ch.id}>
              {i > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
              <TouchableOpacity style={styles.contactRow} onPress={ch.onPress} activeOpacity={0.75}>
                <View style={styles.contactIcon}>
                  <Feather name={ch.icon} size={18} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.contactLabel, { color: colors.foreground }]}>{ch.label}</Text>
                  <Text style={[styles.contactDetail, { color: colors.mutedForeground }]}>{ch.detail}</Text>
                </View>
                <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* FAQs */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>FREQUENTLY ASKED</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
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
                  <Feather name={isOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.mutedForeground} />
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
        <View style={[styles.infoBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
         <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
            Average response time: under 2 hours · Available 7 days a week, 7 AM – 10 PM
          </Text>
        </View>
      </GlassScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: 20 },
  sectionLabel: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 24,
  },
  card: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: 14 },
  contactRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  contactIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  contactLabel: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  contactDetail: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  faqRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  faqQuestion: { fontSize: 14, fontFamily: 'Inter_500Medium', lineHeight: 20 },
  faqAnswer: { paddingHorizontal: 14, paddingBottom: 14, borderTopWidth: StyleSheet.hairlineWidth },
  faqAnswerText: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 20, marginTop: 10 },
  infoBox: {
    flexDirection: 'row',
    gap: 8,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 20,
    alignItems: 'flex-start',
  },
  infoText: { flex: 1, fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 18 },
});
