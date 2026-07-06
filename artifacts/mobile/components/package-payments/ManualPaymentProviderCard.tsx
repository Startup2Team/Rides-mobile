import React from 'react';
import { Feather } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AppButton } from '@/components/AppButton';
import { useColors } from '@/hooks/useColors';
import type { ManualPaymentProviderConfiguration } from '@/domains/package-payments';

export interface ManualPaymentProviderCardProps {
  provider: ManualPaymentProviderConfiguration;
  instruction: string;
  amountLabel: string;
  onCopy: () => void;
}

const PROVIDER_DISPLAY: Record<ManualPaymentProviderConfiguration['provider'], { title: string; iconColor: string }> = {
  mtn: { title: 'MTN MoMo', iconColor: '#FFCC00' },
  airtel: { title: 'Airtel Money', iconColor: '#FF0000' },
};

export function ManualPaymentProviderCard({ provider, instruction, amountLabel, onCopy }: ManualPaymentProviderCardProps) {
  const colors = useColors();
  const meta = PROVIDER_DISPLAY[provider.provider];

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.header}>
        <View style={[styles.iconWrap, { backgroundColor: meta.iconColor + '22' }]}>
          <Feather name="smartphone" size={18} color={meta.iconColor} />
        </View>
        <View style={styles.titleBlock}>
          <Text style={[styles.title, { color: colors.foreground }]}>{meta.title}</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Merchant code: {provider.merchantCode}</Text>
        </View>
        <AppButton
          title="Copy"
          onPress={onCopy}
          variant="secondary"
          size="sm"
          compact
          icon="copy"
        />
      </View>

      <View style={[styles.codeBlock, { backgroundColor: colors.muted }]}>
        <Text style={[styles.codeLabel, { color: colors.mutedForeground }]}>USSD</Text>
        <Text style={[styles.codeText, { color: colors.foreground }]} selectable numberOfLines={2}>
          {instruction}
        </Text>
      </View>

      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: colors.mutedForeground }]}>Amount: {amountLabel}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlock: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
  },
  subtitle: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
  codeBlock: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  codeLabel: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.6,
  },
  codeText: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
});
