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

const PRINT_UNAVAILABLE_NOTE = 'PDF receipts need a newer version of the app.';

/**
 * expo-print is a native module, and expo-modules-core throws the moment its JS
 * module is evaluated on a binary that was built without it. Importing it at
 * module scope therefore took down this whole route — and, through the import
 * chain, the driver-package-payment-status screen — on any build predating the
 * dependency. Loading it on demand keeps that failure inside the two actions
 * that actually need a printer, where it degrades to a readable note.
 */
async function loadPrint(): Promise<typeof import('expo-print') | null> {
  try {
    return await import('expo-print');
  } catch {
    return null;
  }
}

/** Torn-stub divider: the one flourish that makes it read as a receipt. */
function Perforation({ color }: { color: string }) {
  return (
    <View style={styles.perforation}>
      {Array.from({ length: 26 }).map((_, i) => (
        <View key={i} style={[styles.perfDash, { backgroundColor: color }]} />
      ))}
    </View>
  );
}

interface Props {
  receipt: PaymentReceipt | null;
  onClose: () => void;
}

/**
 * Receipt preview for a settled package payment. Download renders a real PDF
 * (expo-print) and hands it to the OS share sheet — Save to Files, Mail, AirDrop,
 * Print. The file is renamed to the receipt number, because printToFileAsync
 * writes to a random temp name that would reach the driver as "abc123.pdf".
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
      const Print = await loadPrint();
      if (!Print) {
        setNote(PRINT_UNAVAILABLE_NOTE);
        return;
      }
      const { uri: tempUri } = await Print.printToFileAsync({
        html: renderReceiptHtml(receipt),
        base64: false,
      });

      // Give the file the receipt number so it lands in Files as RCPT-XXXX.pdf.
      let fileUri = tempUri;
      if (FileSystem.cacheDirectory) {
        const named = `${FileSystem.cacheDirectory}${receiptFileName(receipt)}`;
        try {
          await FileSystem.deleteAsync(named, { idempotent: true });
          await FileSystem.moveAsync({ from: tempUri, to: named });
          fileUri = named;
        } catch {
          // Keep the temp name rather than lose the receipt.
        }
      }

      if (!(await Sharing.isAvailableAsync())) {
        setNote('Sharing is unavailable on this device.');
        return;
      }
      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/pdf',
        dialogTitle: `Receipt ${receipt.receiptNumber}`,
        UTI: 'com.adobe.pdf',
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

  // Amount, package and rides live in the hero — don't repeat them as rows.
  const lines: { label: string; value: string; mono?: boolean }[] = [
    { label: 'Date paid', value: formatReceiptDate(receipt.paidAt) },
    { label: 'Method', value: providerDisplayName(receipt.provider) },
    {
      label: 'Type',
      value: receipt.source === 'automatic' ? 'Automatic (MoMo)' : 'Manual (reviewed)',
    },
    ...(receipt.vehicleType ? [{ label: 'Vehicle', value: receipt.vehicleType }] : []),
    ...(receipt.driverName ? [{ label: 'Driver', value: receipt.driverName }] : []),
    { label: 'Reference', value: receipt.reference, mono: true },
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
          {/* Paper — mirrors the PDF so the preview is honest. */}
          <View style={[styles.paper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.paperHead}>
              <AppText style={[styles.wordmark, { color: colors.foreground }]}>Rides</AppText>
              <AppText style={[styles.receiptNo, { color: colors.mutedForeground }]}>
                {receipt.receiptNumber}
              </AppText>
            </View>

            {/* Hero: what was paid, and that it landed. */}
            <View style={styles.hero}>
              {/* Shrink rather than wrap: a seven-figure amount must still read
                  as one line on the narrowest supported phone. */}
              <AppText
                style={[styles.amount, { color: colors.foreground }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.6}
              >
                {formatReceiptAmount(receipt.amountRwf)}
              </AppText>
              <AppText style={[styles.heroPackage, { color: colors.mutedForeground }]} numberOfLines={2}>
                {receipt.packageName}
              </AppText>
              <View style={[styles.paidPill, { backgroundColor: colors.successHex + '18' }]}>
                <Feather name="check" size={11} color={colors.success} />
                <AppText style={[styles.paidPillText, { color: colors.success }]}>Paid</AppText>
              </View>
            </View>

            {rides ? (
              <View style={[styles.ridesBanner, { backgroundColor: colors.primaryHex + '12' }]}>
                <Feather name="plus-circle" size={13} color={colors.primary} />
                <AppText style={[styles.ridesBannerText, { color: colors.primary }]}>
                  {rides} rides added
                </AppText>
              </View>
            ) : null}

            <Perforation color={colors.border} />

            <View style={styles.lines}>
              {lines.map(line => (
                <View key={line.label} style={styles.line}>
                  <AppText style={[styles.lineLabel, { color: colors.mutedForeground }]}>
                    {line.label}
                  </AppText>
                  <AppText
                    style={[
                      styles.lineValue,
                      { color: colors.foreground },
                      line.mono ? styles.lineValueMono : null,
                    ]}
                    numberOfLines={2}
                  >
                    {line.value}
                  </AppText>
                </View>
              ))}
            </View>

            <AppText style={[styles.footnote, { color: colors.mutedForeground }]}>
              Keep this reference when contacting Rides support about this payment.
            </AppText>
          </View>

          {note ? (
            <AppText style={[styles.note, { color: colors.mutedForeground }]}>{note}</AppText>
          ) : null}
        </ScrollView>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.iconButton, { borderColor: colors.border }]}
            onPress={handleCopyReference}
            accessibilityRole="button"
            accessibilityLabel="Copy payment reference"
            activeOpacity={0.78}
          >
            <Feather name="copy" size={16} color={colors.foreground} />
          </TouchableOpacity>

          {/* No separate print action: the share sheet Download opens already
              offers Print alongside Save to Files, AirDrop and everything else
              the OS supports. A dedicated button duplicated one of its entries. */}
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
            <AppText style={styles.primaryButtonText}>{busy ? 'Preparing…' : 'Download PDF'}</AppText>
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
  paper: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 20, paddingVertical: 18 },
  paperHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  wordmark: { fontSize: 17, fontFamily: 'Inter_700Bold', letterSpacing: -0.3 },
  receiptNo: { fontSize: 11, fontFamily: 'Inter_500Medium', letterSpacing: 0.3 },
  hero: { alignItems: 'center', paddingTop: 18, paddingBottom: 4, gap: 6 },
  // lineHeight is REQUIRED here: AppText defaults to the `body` variant, which
  // sets lineHeight 22. Overriding only fontSize leaves a 34px glyph in a 22px
  // line box, which clips the ascenders clean off the top of the amount.
  amount: { fontSize: 34, lineHeight: 42, fontFamily: 'Inter_700Bold', letterSpacing: -1.2 },
  heroPackage: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  paidPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
  },
  paidPillText: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 0.3 },
  ridesBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 14,
    paddingVertical: 9,
    borderRadius: 12,
  },
  ridesBannerText: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  perforation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 16,
  },
  perfDash: { width: 5, height: StyleSheet.hairlineWidth * 2, borderRadius: 1, opacity: 0.9 },
  lines: { gap: 9 },
  line: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 14,
  },
  lineLabel: { fontSize: 12, fontFamily: 'Inter_400Regular', flexShrink: 0 },
  lineValue: { fontSize: 12, fontFamily: 'Inter_600SemiBold', flex: 1, textAlign: 'right' },
  lineValueMono: { fontFamily: 'Menlo', fontSize: 11 },
  footnote: {
    marginTop: 16,
    fontSize: 10,
    lineHeight: 15,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
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
  iconButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 46,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
  },
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
