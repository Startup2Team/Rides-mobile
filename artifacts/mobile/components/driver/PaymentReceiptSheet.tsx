import React from 'react';
import {
  ActivityIndicator,
  Animated,
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import { SheetBackdrop } from '@/components/SheetBackdrop';
import { AppText } from '@/components/AppText';
import { duration, easing } from '@/constants/motion';
import { useColors } from '@/hooks/useColors';
import {
  formatReceiptAmount,
  formatReceiptDate,
  providerDisplayName,
  receiptFileName,
  renderReceiptHtml,
  type PaymentReceipt,
} from '@/domains/package-payments';

const ENTRANCE_TRANSLATE_Y = 24;

interface Props {
  receipt: PaymentReceipt | null;
  onClose: () => void;
}

/**
 * Receipt preview for a settled package payment, with a download that hands the
 * document to the OS share sheet (Save to Files, Print, Mail, AirDrop).
 *
 * The document is HTML rather than a PDF so the feature ships over OTA — a PDF
 * would need expo-print, which is a native module and therefore a new build.
 * Printing from the share sheet produces a PDF anyway.
 */
export function PaymentReceiptSheet({ receipt, onClose }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const backdropOpacity = React.useRef(new Animated.Value(0)).current;
  const sheetOpacity = React.useRef(new Animated.Value(0)).current;
  const sheetTranslateY = React.useRef(new Animated.Value(ENTRANCE_TRANSLATE_Y)).current;
  const [shouldRender, setShouldRender] = React.useState(Boolean(receipt));
  const [busy, setBusy] = React.useState(false);
  const [note, setNote] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (receipt) {
      setShouldRender(true);
      setNote(null);
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 1, duration: duration.slow, useNativeDriver: true }),
        Animated.timing(sheetOpacity, { toValue: 1, duration: duration.fast, useNativeDriver: true }),
        Animated.timing(sheetTranslateY, {
          toValue: 0,
          duration: duration.fast,
          easing: easing.easeOutCubic,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      backdropOpacity.setValue(0);
      sheetOpacity.setValue(0);
      sheetTranslateY.setValue(ENTRANCE_TRANSLATE_Y);
      setShouldRender(false);
    }
  }, [backdropOpacity, receipt, sheetOpacity, sheetTranslateY]);

  const handleClose = React.useCallback(() => {
    Animated.parallel([
      Animated.timing(backdropOpacity, { toValue: 0, duration: duration.toast, useNativeDriver: true }),
      Animated.timing(sheetOpacity, { toValue: 0, duration: duration.toast, useNativeDriver: true }),
      Animated.timing(sheetTranslateY, {
        toValue: ENTRANCE_TRANSLATE_Y,
        duration: duration.toast,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShouldRender(false);
      onClose();
    });
  }, [backdropOpacity, onClose, sheetOpacity, sheetTranslateY]);

  const handleDownload = React.useCallback(async () => {
    if (!receipt || busy) return;
    setBusy(true);
    setNote(null);
    try {
      if (!FileSystem.cacheDirectory) {
        throw new Error('Cache directory unavailable');
      }
      const fileUri = `${FileSystem.cacheDirectory}${receiptFileName(receipt)}`;
      await FileSystem.writeAsStringAsync(fileUri, renderReceiptHtml(receipt), {
        encoding: FileSystem.EncodingType.UTF8,
      });

      if (!(await Sharing.isAvailableAsync())) {
        setNote('Sharing is unavailable on this device.');
        return;
      }
      await Sharing.shareAsync(fileUri, {
        mimeType: 'text/html',
        dialogTitle: `Receipt ${receipt.receiptNumber}`,
        UTI: 'public.html',
      });
    } catch {
      setNote("Couldn't prepare the receipt. Try again.");
    } finally {
      setBusy(false);
    }
  }, [busy, receipt]);

  const handleCopyReference = React.useCallback(async () => {
    if (!receipt) return;
    await Clipboard.setStringAsync(receipt.reference);
    setNote('Reference copied.');
  }, [receipt]);

  if (!shouldRender || !receipt) return null;

  const rides =
    receipt.ridesGranted == null
      ? null
      : receipt.bonusRidesGranted && receipt.bonusRidesGranted > 0
        ? `${receipt.ridesGranted} + ${receipt.bonusRidesGranted} bonus`
        : `${receipt.ridesGranted}`;

  const lines: { label: string; value: string }[] = [
    { label: 'Receipt number', value: receipt.receiptNumber },
    { label: 'Date paid', value: formatReceiptDate(receipt.paidAt) },
    { label: 'Package', value: receipt.packageName },
    ...(receipt.vehicleType ? [{ label: 'Vehicle', value: receipt.vehicleType }] : []),
    { label: 'Payment method', value: providerDisplayName(receipt.provider) },
    {
      label: 'Payment type',
      value: receipt.source === 'automatic' ? 'Automatic (MoMo)' : 'Manual (proof reviewed)',
    },
    ...(rides ? [{ label: 'Rides added', value: rides }] : []),
    { label: 'Reference', value: receipt.reference },
  ];

  return (
    <Modal visible={shouldRender} transparent animationType="none" onRequestClose={handleClose}>
      <SheetBackdrop
        onPress={handleClose}
        animatedOpacity={backdropOpacity}
        blurIntensity={0}
        lightScrimOpacity={0.3}
        darkScrimOpacity={0.45}
      />
      <Animated.View
        style={[
          styles.sheet,
          {
            backgroundColor: colors.background,
            borderColor: colors.border,
            opacity: sheetOpacity,
            transform: [{ translateY: sheetTranslateY }],
            paddingBottom: Math.max(insets.bottom, 20),
          },
        ]}
      >
        <View style={styles.handleArea}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
        </View>

        <View style={styles.titleRow}>
          <AppText style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>
            Receipt
          </AppText>
          <TouchableOpacity
            onPress={handleClose}
            accessibilityRole="button"
            accessibilityLabel="Close receipt"
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Feather name="x" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Paper — mirrors the downloaded document so the preview is honest. */}
          <View style={[styles.paper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.paperHead}>
              <AppText style={[styles.wordmark, { color: colors.foreground }]}>Rides</AppText>
              <View style={[styles.paidPill, { backgroundColor: colors.successHex + '18' }]}>
                <AppText style={[styles.paidPillText, { color: colors.success }]}>Payment confirmed</AppText>
              </View>
            </View>

            <AppText style={[styles.amount, { color: colors.foreground }]}>
              {formatReceiptAmount(receipt.amountRwf)}
            </AppText>
            <AppText style={[styles.amountCaption, { color: colors.mutedForeground }]}>
              Paid for {receipt.packageName}
            </AppText>

            <View style={[styles.paperDivider, { backgroundColor: colors.border }]} />

            <View style={styles.lines}>
              {lines.map(line => (
                <View key={line.label} style={styles.line}>
                  <AppText style={[styles.lineLabel, { color: colors.mutedForeground }]}>{line.label}</AppText>
                  <AppText style={[styles.lineValue, { color: colors.foreground }]} numberOfLines={2}>
                    {line.value}
                  </AppText>
                </View>
              ))}
            </View>
          </View>

          {note ? (
            <AppText style={[styles.note, { color: colors.mutedForeground }]}>{note}</AppText>
          ) : null}
        </ScrollView>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: colors.border }]}
            onPress={handleCopyReference}
            accessibilityRole="button"
            accessibilityLabel="Copy payment reference"
            activeOpacity={0.78}
          >
            <Feather name="copy" size={15} color={colors.foreground} />
            <AppText style={[styles.secondaryButtonText, { color: colors.foreground }]}>Copy ref</AppText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.primary, opacity: busy ? 0.7 : 1 }]}
            onPress={handleDownload}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Download receipt"
            accessibilityHint="Opens the share sheet so you can save or print this receipt"
            activeOpacity={0.85}
          >
            {busy ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Feather name="download" size={15} color="#FFFFFF" />
            )}
            <AppText style={styles.primaryButtonText}>{busy ? 'Preparing…' : 'Download'}</AppText>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '88%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  handleArea: { alignItems: 'center', paddingTop: 8, paddingBottom: 4 },
  handle: { width: 36, height: 5, borderRadius: 3 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 8,
    gap: 12,
  },
  title: { fontSize: 17, fontFamily: 'Inter_700Bold' },
  scroll: { flexGrow: 0 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 8, gap: 10 },
  paper: { borderRadius: 18, borderWidth: 1, padding: 18, gap: 4 },
  paperHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  wordmark: { fontSize: 19, fontFamily: 'Inter_700Bold', letterSpacing: -0.4 },
  paidPill: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8 },
  paidPillText: { fontSize: 10, fontFamily: 'Inter_700Bold' },
  amount: { marginTop: 14, fontSize: 30, fontFamily: 'Inter_700Bold', letterSpacing: -0.8 },
  amountCaption: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  paperDivider: { height: StyleSheet.hairlineWidth, marginVertical: 14 },
  lines: { gap: 8 },
  line: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 14,
  },
  lineLabel: { fontSize: 12, fontFamily: 'Inter_400Regular', flexShrink: 0 },
  lineValue: { fontSize: 12, fontFamily: 'Inter_600SemiBold', flex: 1, textAlign: 'right' },
  note: { fontSize: 12, fontFamily: 'Inter_400Regular', textAlign: 'center', paddingHorizontal: 8 },
  actions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    height: 46,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  secondaryButtonText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 46,
    borderRadius: 14,
  },
  primaryButtonText: { fontSize: 14, fontFamily: 'Inter_700Bold', color: '#FFFFFF' },
});
