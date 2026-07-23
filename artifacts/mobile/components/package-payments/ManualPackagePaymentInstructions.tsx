import React, { useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { AppButton } from '@/components/AppButton';
import { useColors } from '@/hooks/useColors';
import type { ManualPaymentProviderConfiguration } from '@/domains/package-payments';
import { buildManualPaymentUssdInstruction } from '@/domains/package-payments';

export interface ManualPackagePaymentInstructionsProps {
  offer: { packageName: string; priceRwf: number };
  vehicleLabel?: string | null;
  providers: ManualPaymentProviderConfiguration[];
  recipientName?: string | null;
  recipientPhone?: string | null;
  onCopyProvider?: (provider: ManualPaymentProviderConfiguration, instruction: string) => void;
}

function formatRwf(amount: number) {
  return `${amount.toLocaleString('en-RW')} RWF`;
}

// Open the dialer pre-filled with the USSD string. `#` must be percent-encoded
// or the dialer truncates it; the user still presses call (carriers block
// auto-firing USSD from a link).
async function dialUssd(instruction: string) {
  try {
    await Linking.openURL(`tel:${encodeURIComponent(instruction)}`);
  } catch {
    // Dialer unavailable (e.g. simulator) — Copy is the fallback.
  }
}

export function ManualPackagePaymentInstructions({
  offer,
  vehicleLabel,
  providers,
  recipientName,
  recipientPhone,
}: ManualPackagePaymentInstructionsProps) {
  const colors = useColors();
  const [copied, setCopied] = useState<null | 'code' | 'phone'>(null);

  const provider = providers.find(p => p.enabled) ?? providers[0];
  const accent = colors.primary;
  const providerName = provider?.provider === 'airtel' ? 'Airtel Money' : 'MTN MoMo';
  const ussd = provider ? (buildManualPaymentUssdInstruction(provider, offer.priceRwf).data ?? provider.ussdTemplate) : null;

  const copy = async (kind: 'code' | 'phone', value: string) => {
    await Clipboard.setStringAsync(value);
    setCopied(kind);
    setTimeout(() => setCopied(c => (c === kind ? null : c)), 1600);
  };

  return (
    <View style={styles.shell}>
      {/* What you're buying + how much to send — the amount leads. */}
      <View style={styles.header}>
        <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>PAY FOR</Text>
        <Text style={[styles.packageName, { color: colors.foreground }]}>{offer.packageName}</Text>
      </View>

      {/* Pay-to hero: the code is the whole point of this screen. */}
      <View style={[styles.hero, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.heroAccent, { backgroundColor: accent }]} />

        <View style={styles.heroTop}>
          <View style={styles.providerTag}>
            <View style={[styles.providerDot, { backgroundColor: accent }]} />
            <Text style={[styles.providerName, { color: colors.foreground }]}>{providerName}</Text>
          </View>
          <View style={[styles.amountPill, { backgroundColor: colors.primaryHex + '14' }]}>
            <Text style={[styles.amountPillText, { color: colors.primary }]}>Send {formatRwf(offer.priceRwf)}</Text>
          </View>
        </View>

        {provider ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Copy MoMo code ${provider.merchantCode}`}
            onPress={() => copy('code', provider.merchantCode)}
            style={styles.codeBlock}
          >
            <Text style={[styles.codeLabel, { color: colors.mutedForeground }]}>MOMO CODE</Text>
            <Text style={[styles.codeValue, { color: colors.foreground }]} selectable adjustsFontSizeToFit numberOfLines={1}>
              {provider.merchantCode}
            </Text>
            <View style={styles.copyRow}>
              <Feather name={copied === 'code' ? 'check' : 'copy'} size={13} color={copied === 'code' ? colors.success : colors.primary} />
              <Text style={[styles.copyText, { color: copied === 'code' ? colors.success : colors.primary }]}>
                {copied === 'code' ? 'Copied' : 'Tap to copy'}
              </Text>
            </View>
          </Pressable>
        ) : (
          <Text style={[styles.noProvider, { color: colors.mutedForeground }]}>
            Payment code unavailable right now. Please try again shortly.
          </Text>
        )}

        {/* Who the money goes to — name + number, so drivers can confirm before sending. */}
        {(recipientName || recipientPhone) ? (
          <View style={[styles.recipient, { borderTopColor: colors.border }]}>
            <View style={styles.recipientText}>
              <Text style={[styles.recipientLabel, { color: colors.mutedForeground }]}>Recipient</Text>
              <Text style={[styles.recipientName, { color: colors.foreground }]}>
                {recipientName || 'Rides'}
                {recipientPhone ? <Text style={{ color: colors.mutedForeground }}>{`  ·  ${recipientPhone}`}</Text> : null}
              </Text>
            </View>
            {recipientPhone ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Copy number ${recipientPhone}`}
                onPress={() => copy('phone', recipientPhone)}
                hitSlop={8}
              >
                <Feather name={copied === 'phone' ? 'check' : 'copy'} size={16} color={copied === 'phone' ? colors.success : colors.mutedForeground} />
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {ussd ? (
          <AppButton
            title="Dial to pay"
            onPress={() => void dialUssd(ussd)}
            accessibilityLabel={`Dial ${providerName} to pay ${formatRwf(offer.priceRwf)}`}
            icon="phone-call"
            fullWidth
            size="lg"
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { gap: 18, marginHorizontal: 20 },
  header: { gap: 3 },
  eyebrow: { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 1 },
  packageName: { fontSize: 24, fontFamily: 'Inter_700Bold', letterSpacing: -0.4 },

  hero: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
    paddingTop: 20,
    gap: 16,
    overflow: 'hidden',
  },
  heroAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 4 },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  providerTag: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  providerDot: { width: 10, height: 10, borderRadius: 5 },
  providerName: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  amountPill: { paddingHorizontal: 11, paddingVertical: 5, borderRadius: 999 },
  amountPillText: { fontSize: 13, fontFamily: 'Inter_700Bold' },

  codeBlock: { alignItems: 'center', gap: 6, paddingVertical: 6 },
  codeLabel: { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 1.5 },
  codeValue: { fontSize: 46, fontFamily: 'Inter_700Bold', letterSpacing: 3, lineHeight: 52 },
  copyRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  copyText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  noProvider: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 19, paddingVertical: 12 },

  recipient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 14 },
  recipientText: { flex: 1, gap: 2 },
  recipientLabel: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 0.8 },
  recipientName: { fontSize: 15, fontFamily: 'Inter_700Bold' },
});
