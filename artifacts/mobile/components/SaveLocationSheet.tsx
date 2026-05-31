import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Dimensions,
  Keyboard,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { CloseButton, type CloseButtonHandle } from '@/components/BackButton';
import { SheetBackdrop } from '@/components/SheetBackdrop';
import { buttonCornerRadius } from '@/constants/buttons';
import {
  SAVE_LABEL_WIDTHS,
  SAVE_LOCATION_LABELS,
} from '@/constants/savedLocations';
import { useColors } from '@/hooks/useColors';
import { useSavedLocations } from '@/hooks/useSavedLocations';
import { useToast } from '@/context/ToastContext';
import { RideLocation } from '@/types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const FLOATING_PANEL_RADIUS = Platform.OS === 'ios' ? 47 : 28;
const GREETING_LEFT_INSET = 14;
const BOOKING_SHEET_PADDING_H = 22;
const BOOKING_CLOSE_EDGE_INSET = 16;
const BOOKING_CLOSE_ROTATION_PAD = 10;

interface SaveLocationSheetProps {
  location: RideLocation | null;
  onClose: () => void;
  onSaved?: () => void;
}

export function SaveLocationSheet({ location, onClose, onSaved }: SaveLocationSheetProps) {
  const colors = useColors();
  const isDark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const { saveLocation } = useSavedLocations();
  const { showToast } = useToast();
  const [isCustomSaveLabel, setIsCustomSaveLabel] = useState(false);
  const [customSaveLabel, setCustomSaveLabel] = useState('');
  const [formSheetMeasuredHeight, setFormSheetMeasuredHeight] = useState(280);

  const saveFormCloseRef = useRef<CloseButtonHandle>(null);
  const formSheetDragAnim = useRef(new Animated.Value(0)).current;
  const formSheetDragStart = useRef(0);
  const formSheetHeightRef = useRef(280);
  const sheetKeyboardAnim = useRef(new Animated.Value(0)).current;
  const closeSheetRef = useRef<() => void>(() => {});

  const sheetSurface = useMemo(
    () => ({
      backgroundColor: colors.card,
      borderTopColor: isDark ? 'rgba(255,255,255,0.14)' : colors.border,
    }),
    [colors.border, colors.card, isDark],
  );

  const formSheetBackdropOpacity = useMemo(
    () =>
      formSheetDragAnim.interpolate({
        inputRange: [0, Math.max(formSheetMeasuredHeight, 1)],
        outputRange: [1, 0],
        extrapolate: 'clamp',
      }),
    [formSheetDragAnim, formSheetMeasuredHeight],
  );

  const resetSheetState = useCallback(() => {
    sheetKeyboardAnim.setValue(0);
    setIsCustomSaveLabel(false);
    setCustomSaveLabel('');
    Keyboard.dismiss();
  }, [sheetKeyboardAnim]);

  const closeSheet = useCallback(() => {
    resetSheetState();
    onClose();
  }, [onClose, resetSheetState]);

  closeSheetRef.current = closeSheet;

  const snapFormSheetOpen = useCallback((onSnapOpen?: () => void) => {
    onSnapOpen?.();
    Animated.spring(formSheetDragAnim, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 4,
    }).start();
  }, [formSheetDragAnim]);

  const dismissFormSheetAnimated = useCallback(
    (onAnimateStart?: () => void) => {
      onAnimateStart?.();
      const max = formSheetHeightRef.current;
      Animated.timing(formSheetDragAnim, {
        toValue: max,
        duration: 250,
        useNativeDriver: true,
      }).start(() => {
        closeSheetRef.current();
      });
    },
    [formSheetDragAnim],
  );

  const dismissSaveFormSheet = useCallback(
    () => dismissFormSheetAnimated(() => saveFormCloseRef.current?.spinShut()),
    [dismissFormSheetAnimated],
  );

  const createFormSheetPanResponder = useCallback(
    (
      onDismissStart?: () => void,
      onDragProgress?: (progress: number) => void,
      onSnapOpen?: () => void,
    ) =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) =>
          gestureState.dy > 6 && gestureState.dy > Math.abs(gestureState.dx),
        onMoveShouldSetPanResponderCapture: (_, gestureState) =>
          gestureState.dy > 8 && gestureState.dy > Math.abs(gestureState.dx) * 1.2,
        onPanResponderGrant: () => {
          Keyboard.dismiss();
          formSheetDragAnim.stopAnimation(value => {
            formSheetDragStart.current = value;
          });
        },
        onPanResponderMove: (_, gestureState) => {
          const max = formSheetHeightRef.current;
          const next = Math.max(0, Math.min(max, formSheetDragStart.current + gestureState.dy));
          formSheetDragAnim.setValue(next);
          if (max > 0) {
            onDragProgress?.(1 - next / max);
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          const max = formSheetHeightRef.current;
          const current = Math.max(0, Math.min(max, formSheetDragStart.current + gestureState.dy));
          const shouldClose = current > max * 0.28 || gestureState.vy > 0.65;
          const hadVerticalDrag = Math.abs(gestureState.dy) > 8;
          if (shouldClose) {
            dismissFormSheetAnimated(onDismissStart);
          } else if (hadVerticalDrag) {
            snapFormSheetOpen(onSnapOpen);
          }
        },
        onPanResponderTerminationRequest: () => false,
      }),
    [dismissFormSheetAnimated, formSheetDragAnim, snapFormSheetOpen],
  );

  const saveFormSheetPanResponder = useMemo(
    () => createFormSheetPanResponder(
      () => saveFormCloseRef.current?.spinShut(),
      progress => saveFormCloseRef.current?.setSpinProgress(progress),
      () => saveFormCloseRef.current?.spinOpen(),
    ),
    [createFormSheetPanResponder],
  );

  useEffect(() => {
    const liftSheet = (height: number) => {
      Animated.spring(sheetKeyboardAnim, {
        toValue: Math.max(0, height - insets.bottom),
        damping: 24,
        stiffness: 260,
        mass: 0.8,
        useNativeDriver: true,
      }).start();
    };

    const willShowSub = Keyboard.addListener('keyboardWillShow', event => {
      liftSheet(event.endCoordinates.height);
    });
    const showSub = Keyboard.addListener('keyboardDidShow', event => {
      liftSheet(event.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      Animated.timing(sheetKeyboardAnim, {
        toValue: 0,
        duration: 100,
        useNativeDriver: true,
      }).start();
    });

    return () => {
      willShowSub.remove();
      showSub.remove();
      hideSub.remove();
    };
  }, [insets.bottom, sheetKeyboardAnim]);

  useEffect(() => {
    if (!location) {
      sheetKeyboardAnim.setValue(0);
      formSheetDragAnim.setValue(0);
      setIsCustomSaveLabel(false);
      setCustomSaveLabel('');
      return;
    }

    setIsCustomSaveLabel(false);
    setCustomSaveLabel('');
    formSheetDragAnim.setValue(formSheetHeightRef.current);
    Animated.spring(formSheetDragAnim, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 4,
    }).start();
  }, [formSheetDragAnim, location, sheetKeyboardAnim]);

  const handleSave = useCallback(async (label: string) => {
    if (!location) return;
    const cleanLabel = label.trim();
    const saved = await saveLocation(location, cleanLabel);
    if (!saved) return;
    showToast(`Saved as ${cleanLabel}`);
    resetSheetState();
    onSaved?.();
    onClose();
  }, [location, onClose, onSaved, resetSheetState, saveLocation, showToast]);

  const handleLabelPress = useCallback((label: string) => {
    if (label === 'Other') {
      setIsCustomSaveLabel(true);
      setCustomSaveLabel('');
      return;
    }
    void handleSave(label);
  }, [handleSave]);

  if (!location) return null;

  return (
    <>
      <SheetBackdrop onPress={dismissSaveFormSheet} animatedOpacity={formSheetBackdropOpacity} />

      <Animated.View
        onLayout={event => {
          const height = event.nativeEvent.layout.height;
          formSheetHeightRef.current = height;
          setFormSheetMeasuredHeight(height);
        }}
        style={[
          styles.sheet,
          styles.sheetRaised,
          sheetSurface,
          {
            paddingBottom: insets.bottom + (Platform.OS === 'web' ? 88 : 72),
            transform: [
              {
                translateY: Animated.add(
                  formSheetDragAnim,
                  isCustomSaveLabel ? Animated.multiply(sheetKeyboardAnim, -1) : 0,
                ),
              },
            ],
          },
        ]}
        {...saveFormSheetPanResponder.panHandlers}
      >
        <View style={styles.closeAnchor} pointerEvents="box-none">
          <CloseButton
            ref={saveFormCloseRef}
            shutOnPress={false}
            onPress={dismissSaveFormSheet}
            accessibilityLabel="Close save location"
          />
        </View>

        <View style={styles.body}>
          <View style={styles.dragZone}>
            <View style={styles.handleTouch}>
              <View style={styles.handle} />
            </View>
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.foreground }]}>Save location as</Text>
            </View>
            <View style={styles.subheader}>
              <Text style={[styles.subtitle, { color: colors.mutedForeground }]} numberOfLines={2}>
                {location.address ?? 'Selected location'}
              </Text>
              <Text style={[styles.hint, { color: colors.mutedForeground }]}>
                {isCustomSaveLabel ? 'Type a custom label to finish saving.' : 'Choose one label to finish saving.'}
              </Text>
            </View>
          </View>

          <View style={styles.content}>
            <View style={styles.labelRow}>
              {SAVE_LOCATION_LABELS.map(label => (
                <TouchableOpacity
                  key={label}
                  style={[
                    styles.labelChip,
                    { width: SAVE_LABEL_WIDTHS[label], backgroundColor: colors.muted, borderColor: colors.border },
                  ]}
                  onPress={() => handleLabelPress(label)}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={`Save as ${label}`}
                >
                  <Text style={[styles.labelChipText, { color: colors.foreground }]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {isCustomSaveLabel && (
              <View style={styles.customSection}>
                <View style={[styles.inputWrap, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                  <Feather name="tag" size={18} color={colors.mutedForeground} />
                  <TextInput
                    style={[styles.input, { color: colors.foreground }]}
                    value={customSaveLabel}
                    onChangeText={setCustomSaveLabel}
                    placeholder="Custom label"
                    placeholderTextColor={colors.mutedForeground}
                    autoFocus
                    returnKeyType="done"
                    onSubmitEditing={() => void handleSave(customSaveLabel)}
                  />
                </View>
                <TouchableOpacity
                  style={[
                    styles.customSaveButton,
                    {
                      backgroundColor: customSaveLabel.trim() ? colors.primary : colors.muted,
                      opacity: customSaveLabel.trim() ? 1 : 0.6,
                    },
                  ]}
                  onPress={() => void handleSave(customSaveLabel)}
                  disabled={!customSaveLabel.trim()}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel="Save custom label"
                >
                  <Feather
                    name="check"
                    size={18}
                    color={customSaveLabel.trim() ? colors.primaryForeground : colors.mutedForeground}
                  />
                  <Text
                    style={[
                      styles.customSaveButtonText,
                      { color: customSaveLabel.trim() ? colors.primaryForeground : colors.mutedForeground },
                    ]}
                  >
                    Save custom label
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    width: SCREEN_WIDTH,
    maxHeight: SCREEN_HEIGHT * 0.92,
    borderRadius: FLOATING_PANEL_RADIUS,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'visible',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 14,
    ...Platform.select({
      ios: { borderCurve: 'continuous' },
      default: {},
    }),
  },
  sheetRaised: {
    zIndex: 90,
  },
  closeAnchor: {
    position: 'absolute',
    top: BOOKING_CLOSE_EDGE_INSET - BOOKING_CLOSE_ROTATION_PAD,
    right: BOOKING_CLOSE_EDGE_INSET - BOOKING_CLOSE_ROTATION_PAD,
    width: 44 + BOOKING_CLOSE_ROTATION_PAD * 2,
    height: 44 + BOOKING_CLOSE_ROTATION_PAD * 2,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  body: {
    paddingHorizontal: BOOKING_SHEET_PADDING_H,
    gap: 10,
  },
  dragZone: {
    paddingTop: 0,
    paddingBottom: 0,
    marginTop: 0,
  },
  handleTouch: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingTop: 6,
    paddingBottom: 4,
    marginBottom: 0,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#3A3A3A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: GREETING_LEFT_INSET,
    paddingRight: 52,
    minHeight: 44,
  },
  subheader: {
    paddingLeft: GREETING_LEFT_INSET,
    paddingRight: 52,
    gap: 4,
    paddingBottom: 2,
  },
  content: {
    marginHorizontal: GREETING_LEFT_INSET,
    gap: 10,
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    marginRight: 8,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    lineHeight: 18,
  },
  hint: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  labelChip: {
    minHeight: 44,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelChipText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  customSection: {
    gap: 12,
  },
  inputWrap: {
    height: 52,
    borderRadius: buttonCornerRadius(52),
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
  },
  customSaveButton: {
    minHeight: 52,
    borderRadius: buttonCornerRadius(52),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  customSaveButtonText: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
  },
});
