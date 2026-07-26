import React, { useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
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

// Official brand colours — MTN yellow, Airtel red.
const BRAND: Record<ManualPaymentProviderConfiguration['provider'], { name: string; accent: string; on: string }> = {
  mtn: { name: 'MTN MoMo', accent: '#FFCC00', on: '#1A1A1A' },
  airtel: { name: 'Airtel Money', accent: '#E4002B', on: '#FFFFFF' },
};

function formatRwf(amount: number) {
  return `${amount.toLocaleString('en-RW')} RWF`;
}

// Dialer pre-fill; `#` must be percent-encoded or the dialer truncates it.
async function dialUssd(instruction: string) {
  try {
    await Linking.openURL(`tel:${encodeURIComponent(instruction)}`);
  } catch {
    // Dialer unavailable (e.g. simulator) — Copy is the fallback.
  }
}

export function ManualPackagePaymentInstructions({
  offer,
  providers,
  recipientName,
}: ManualPackagePaymentInstructionsProps) {
  const colors = useColors();
  const [copied, setCopied] = useState<string | null>(null);

  const cards = providers.filter(p => p.enabled && p.merchantCode);

  const copy = async (key: string, value: string) => {
    await Clipboard.setStringAsync(value);
    setCopied(key);
    setTimeout(() => setCopied(c => (c === key ? null : c)), 1600);
  };

  return (
    <View style={styles.shell}>
      <View style={styles.header}>
        <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>PAY</Text>
        <Text style={[styles.amount, { color: colors.foreground }]}>{formatRwf(offer.priceRwf)}</Text>
        <Text style={[styles.recipient, { color: colors.mutedForeground }]}>
          to {recipientName || 'Travelis Rwanda LTD'}
        </Text>
      </View>

      {cards.length === 0 ? (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.unavailable, { color: colors.mutedForeground }]}>
            Payment codes unavailable right now. Please try again shortly.
          </Text>
        </View>
      ) : (
        cards.map(p => {
          const brand = BRAND[p.provider];
          const ussd = buildManualPaymentUssdInstruction(p, offer.priceRwf).data ?? p.ussdTemplate;
          return (
            <View key={p.provider} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.accentBar, { backgroundColor: brand.accent }]} />
              <View style={styles.cardRow}>
                <View style={[styles.brandDot, { backgroundColor: brand.accent }]} />
                <Text style={[styles.brandName, { color: colors.foreground }]}>{brand.name}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Copy ${brand.name} code ${p.merchantCode}`}
                onPress={() => copy(p.provider, p.merchantCode)}
                style={styles.codeRow}
              >
                <Text style={[styles.code, { color: colors.foreground }]} selectable adjustsFontSizeToFit numberOfLines={1}>
                  {p.merchantCode}
                </Text>
                <Feather
                  name={copied === p.provider ? 'check' : 'copy'}
                  size={18}
                  color={copied === p.provider ? colors.success : colors.mutedForeground}
                />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Dial ${brand.name}`}
                onPress={() => void dialUssd(ussd)}
                style={[styles.dial, { backgroundColor: brand.accent }]}
              >
                <Feather name="phone-call" size={16} color={brand.on} />
                <Text style={[styles.dialText, { color: brand.on }]}>Dial to pay</Text>
              </Pressable>
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { gap: 12, marginHorizontal: 20 },
  header: { gap: 2, marginBottom: 2 },
  eyebrow: { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 1.5 },
  amount: { fontSize: 30, fontFamily: 'Inter_700Bold', letterSpacing: -0.5 },
  recipient: { fontSize: 13, fontFamily: 'Inter_500Medium' },

  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    paddingTop: 18,
    gap: 12,
    overflow: 'hidden',
  },
  accentBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 5 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandDot: { width: 12, height: 12, borderRadius: 6 },
  brandName: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  codeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  code: { flex: 1, fontSize: 40, fontFamily: 'Inter_700Bold', letterSpacing: 2 },
  dial: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: 14 },
  dialText: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  unavailable: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 19 },
});
