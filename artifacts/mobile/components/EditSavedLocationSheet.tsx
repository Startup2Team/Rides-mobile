import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Feather } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Keyboard,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CloseButton, type CloseButtonHandle } from '@/components/BackButton';
import { SheetBackdrop } from '@/components/SheetBackdrop';
import { buttonCornerRadius } from '@/constants/buttons';
import { FLOATING_PANEL_TOP_RADIUS } from '@/constants/surfaces';
import { useColors } from '@/hooks/useColors';
import type { GeocodeSuggestion } from '@/services/geocoding';
import type { SavedLocation } from '@/types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const GREETING_LEFT_INSET = 14;
const BOOKING_SHEET_PADDING_H = 22;
const BOOKING_CLOSE_EDGE_INSET = 16;
const BOOKING_CLOSE_ROTATION_PAD = 10;
const EDIT_SAVED_FORM_TAB_BAR_PADDING = Platform.OS === 'web' ? 88 : 72;
const EDIT_SHEET_SEARCH_TOP_GAP = 10;
const EDIT_SHEET_KEYBOARD_OPEN_THRESHOLD = 80;
const SUGGESTION_ROW_MIN_HEIGHT = 52;
/** ~5 rows visible before the list scrolls (Apple Maps–style). */
const SUGGESTIONS_REST_MAX_HEIGHT = SUGGESTION_ROW_MIN_HEIGHT * 5.5;

type SheetMode = 'rest' | 'search';

function keyboardBottomInset(screenHeight: number, keyboardScreenY: number): number {
  return Math.max(0, screenHeight - keyboardScreenY);
}

function expandedSheetHeight(keyboardScreenY: number, topInset: number): number {
  return Math.max(320, keyboardScreenY - topInset - EDIT_SHEET_SEARCH_TOP_GAP);
}

export type EditSavedFieldErrors = {
  label?: string;
  address?: string;
};

export type EditSavedLocationSheetProps = {
  location: SavedLocation;
  label: string;
  address: string;
  fieldErrors?: EditSavedFieldErrors;
  suggestions: GeocodeSuggestion[];
  searchLoading: boolean;
  showAddressSuggestions: boolean;
  onLabelChange: (text: string) => void;
  onAddressChange: (text: string) => void;
  onLabelFocus?: () => void;
  onAddressFocus?: () => void;
  onClearAddress: () => void;
  onSelectSuggestion: (suggestion: GeocodeSuggestion) => void;
  onUseTypedAddress: () => void;
  onSave: () => void;
  onDelete: () => void;
  onUseGps: () => void;
  onClose: () => void;
};

export function EditSavedLocationSheet({
  location,
  label,
  address,
  fieldErrors,
  suggestions,
  searchLoading,
  showAddressSuggestions,
  onLabelChange,
  onAddressChange,
  onLabelFocus,
  onAddressFocus,
  onClearAddress,
  onSelectSuggestion,
  onUseTypedAddress,
  onSave,
  onDelete,
  onUseGps,
  onClose,
}: EditSavedLocationSheetProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topInset = insets.top + 8;

  const [mode, setMode] = useState<SheetMode>('rest');
  const [sheetHeight, setSheetHeight] = useState(0);
  const [measuredHeight, setMeasuredHeight] = useState(280);

  const closeRef = useRef<CloseButtonHandle>(null);
  const closeSheetRef = useRef<() => void>(() => {});
  const keyboardOpenRef = useRef(false);
  const labelInputRef = useRef<TextInput>(null);
  const addressInputRef = useRef<TextInput>(null);

  const dragAnim = useRef(new Animated.Value(0)).current;
  const dragStart = useRef(0);
  const sheetHeightRef = useRef(280);
  const keyboardLiftAnim = useRef(new Animated.Value(0)).current;

  const sheetSurface = useMemo(() => ({ backgroundColor: colors.card }), [colors.card]);

  const backdropOpacity = useMemo(
    () =>
      dragAnim.interpolate({
        inputRange: [0, Math.max(measuredHeight, 1)],
        outputRange: [1, 0],
        extrapolate: 'clamp',
      }),
    [dragAnim, measuredHeight],
  );

  const resetSheet = useCallback(() => {
    keyboardOpenRef.current = false;
    keyboardLiftAnim.setValue(0);
    setMode('rest');
    setSheetHeight(0);
    Keyboard.dismiss();
  }, [keyboardLiftAnim]);

  const closeSheet = useCallback(() => {
    resetSheet();
    onClose();
  }, [onClose, resetSheet]);

  closeSheetRef.current = closeSheet;

  const updateCloseSpinForDrag = useCallback((offset: number) => {
    const max = sheetHeightRef.current;
    if (max <= 0) return;
    closeRef.current?.setSpinProgress(1 - Math.min(1, offset / max));
  }, []);

  const snapOpen = useCallback(() => {
    closeRef.current?.spinOpen();
    Animated.spring(dragAnim, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 4,
      speed: 18,
    }).start();
  }, [dragAnim]);

  const dismissAnimated = useCallback(
    (onAnimateStart?: () => void, releaseVelocity = 0) => {
      onAnimateStart?.();
      const max = sheetHeightRef.current;
      Animated.spring(dragAnim, {
        toValue: max,
        velocity: Math.max(releaseVelocity, 0),
        useNativeDriver: true,
        bounciness: 0,
        speed: 22,
      }).start(() => closeSheetRef.current());
    },
    [dragAnim],
  );

  const dismissSheet = useCallback(
    () => dismissAnimated(() => closeRef.current?.spinShut()),
    [dismissAnimated],
  );

  const dismissKeyboard = useCallback(() => {
    if (!keyboardOpenRef.current) return;
    Keyboard.dismiss();
  }, []);

  const applyKeyboardFrame = useCallback(
    (keyboardScreenY: number, duration = 250) => {
      const bottomInset = keyboardBottomInset(SCREEN_HEIGHT, keyboardScreenY);
      const keyboardOpen = bottomInset > EDIT_SHEET_KEYBOARD_OPEN_THRESHOLD;
      keyboardOpenRef.current = keyboardOpen;

      if (keyboardOpen) {
        setMode('search');
        setSheetHeight(expandedSheetHeight(keyboardScreenY, topInset));
      } else {
        setMode('rest');
        setSheetHeight(0);
      }

      const anim =
        Platform.OS === 'ios'
          ? Animated.timing(keyboardLiftAnim, {
              toValue: bottomInset,
              duration,
              useNativeDriver: true,
            })
          : Animated.spring(keyboardLiftAnim, {
              toValue: bottomInset,
              damping: 24,
              stiffness: 260,
              mass: 0.85,
              useNativeDriver: true,
            });

      anim.start();
    },
    [keyboardLiftAnim, topInset],
  );

  const shouldBeginSheetDrag = useCallback(
    (gestureDy: number, gestureDx: number) =>
      gestureDy > 4 && gestureDy > Math.abs(gestureDx),
    [],
  );

  /** Sheet dismiss drag — handle/header only; never on the suggestions list. */
  const chromePanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, g) => {
          if (!shouldBeginSheetDrag(g.dy, g.dx)) return false;
          return true;
        },
        onMoveShouldSetPanResponderCapture: () => false,
        onPanResponderGrant: () => {
          if (keyboardOpenRef.current) {
            dismissKeyboard();
            return;
          }
          dragAnim.stopAnimation(value => {
            dragStart.current = value;
          });
        },
        onPanResponderMove: (_, g) => {
          if (keyboardOpenRef.current) return;
          const max = sheetHeightRef.current;
          const next = Math.max(0, Math.min(max, dragStart.current + g.dy));
          dragAnim.setValue(next);
          updateCloseSpinForDrag(next);
        },
        onPanResponderRelease: (_, g) => {
          if (keyboardOpenRef.current) return;
          const max = sheetHeightRef.current;
          const current = Math.max(0, Math.min(max, dragStart.current + g.dy));
          const shouldClose = current > max * 0.28 || g.vy > 0.65;
          if (shouldClose) {
            dismissAnimated(() => closeRef.current?.spinShut(), g.vy);
          } else if (Math.abs(g.dy) > 8) {
            snapOpen();
          } else {
            closeRef.current?.setSpinProgress(1);
          }
        },
        onPanResponderTerminationRequest: () => false,
      }),
    [
      dismissAnimated,
      dismissKeyboard,
      dragAnim,
      shouldBeginSheetDrag,
      snapOpen,
      updateCloseSpinForDrag,
    ],
  );

  useEffect(() => {
    if (Platform.OS === 'ios') {
      const sub = Keyboard.addListener('keyboardWillChangeFrame', event => {
        applyKeyboardFrame(event.endCoordinates.screenY, event.duration ?? 250);
      });
      return () => sub.remove();
    }

    const showSub = Keyboard.addListener('keyboardDidShow', event => {
      applyKeyboardFrame(event.endCoordinates.screenY, event.duration ?? 220);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', event => {
      applyKeyboardFrame(SCREEN_HEIGHT, event.duration ?? 180);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [applyKeyboardFrame]);

  useEffect(() => {
    keyboardLiftAnim.setValue(0);
    setMode('rest');
    setSheetHeight(0);
    const enterFrom = Math.min(sheetHeightRef.current, SCREEN_HEIGHT * 0.45);
    dragAnim.setValue(enterFrom);
    closeRef.current?.setSpinProgress(0);
    Animated.spring(dragAnim, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 5,
      speed: 16,
    }).start(() => {
      closeRef.current?.spinOpen();
    });
  }, [dragAnim, keyboardLiftAnim, location.id]);

  const renderSuggestionRows = () => {
    if (searchLoading && suggestions.length === 0) {
      return (
        <View style={styles.suggestionsLoading}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      );
    }

    return (
      <>
        <TouchableOpacity
          style={[styles.suggestionRow, { borderBottomColor: colors.border }]}
          onPress={onUseTypedAddress}
          activeOpacity={0.75}
        >
          <View style={styles.suggestionIcon}>
            <Feather name="edit-3" size={16} color={colors.foreground} />
          </View>
          <View style={styles.suggestionText}>
            <Text style={[styles.suggestionTitle, { color: colors.foreground }]} numberOfLines={1}>
              Use &quot;{address.trim()}&quot;
            </Text>
            <Text style={[styles.suggestionSub, { color: colors.mutedForeground }]} numberOfLines={1}>
              Keep this text as the address
            </Text>
          </View>
        </TouchableOpacity>

        {suggestions.map(suggestion => (
          <TouchableOpacity
            key={suggestion.id}
            style={[styles.suggestionRow, { borderBottomColor: colors.border }]}
            onPress={() => onSelectSuggestion(suggestion)}
            activeOpacity={0.75}
          >
            <View style={styles.suggestionIcon}>
              <MaterialCommunityIcons name="map-marker-outline" size={18} color={colors.foreground} />
            </View>
            <View style={styles.suggestionText}>
              <Text style={[styles.suggestionTitle, { color: colors.foreground }]} numberOfLines={1}>
                {suggestion.title}
              </Text>
              <Text style={[styles.suggestionSub, { color: colors.mutedForeground }]} numberOfLines={2}>
                {suggestion.subtitle ?? suggestion.place_name}
              </Text>
            </View>
          </TouchableOpacity>
        ))}

        {!searchLoading && suggestions.length === 0 && (
          <Text style={[styles.suggestionsEmpty, { color: colors.mutedForeground }]}>
            No matches yet. Try the full name (e.g. Serena Hotel) or a grid address with ST/AV.
          </Text>
        )}
      </>
    );
  };

  const isSearchMode = mode === 'search';

  const renderSuggestionsList = () => {
    if (!showAddressSuggestions) return null;

    return (
      <View
        style={[
          styles.suggestionsListWrap,
          isSearchMode ? styles.suggestionsListWrapExpanded : styles.suggestionsListWrapRest,
        ]}
      >
        <ScrollView
          style={styles.suggestionsScroll}
          contentContainerStyle={styles.suggestionsScrollContent}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="none"
          nestedScrollEnabled
          showsVerticalScrollIndicator
          bounces
        >
          {renderSuggestionRows()}
        </ScrollView>
      </View>
    );
  };

  return (
    <>
      <SheetBackdrop onPress={dismissSheet} animatedOpacity={backdropOpacity} blurIntensity={18} lightScrimOpacity={0.2} darkScrimOpacity={0.42} />

      <Animated.View
        onLayout={event => {
          const height = event.nativeEvent.layout.height;
          sheetHeightRef.current = height;
          setMeasuredHeight(height);
        }}
        style={[
          styles.sheet,
          styles.sheetRaised,
          sheetSurface,
          isSearchMode && styles.sheetSearch,
          sheetHeight > 0 ? { height: sheetHeight } : null,
          {
            paddingBottom: isSearchMode ? 12 : insets.bottom + EDIT_SAVED_FORM_TAB_BAR_PADDING,
            transform: [
              {
                translateY: Animated.add(dragAnim, Animated.multiply(keyboardLiftAnim, -1)),
              },
            ],
          },
        ]}
      >
        <View style={styles.closeAnchor} pointerEvents="box-none">
          <CloseButton
            ref={closeRef}
            shutOnPress={false}
            onPress={dismissSheet}
            accessibilityLabel="Close edit location"
          />
        </View>

        <View style={[styles.body, isSearchMode && styles.bodySearch]}>
          <View style={styles.chromeTapZone} {...chromePanResponder.panHandlers}>
            <View style={styles.dragZone}>
              <View style={styles.handleTouch}>
                <View style={styles.handle} />
              </View>
            </View>
            <Pressable
              onPress={dismissKeyboard}
              style={styles.headerPressable}
              accessibilityRole="button"
              accessibilityLabel="Dismiss keyboard"
            >
              <View style={styles.header}>
                <Text style={[styles.title, { color: colors.foreground }]}>Edit saved location</Text>
              </View>
              {!isSearchMode && (
                <View style={styles.subheader}>
                  <Text style={[styles.subtitle, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {location.address ?? 'Saved location'}
                  </Text>
                  <Text style={[styles.hint, { color: colors.mutedForeground }]}>
                    Rename, update, or delete this saved place.
                  </Text>
                </View>
              )}
            </Pressable>
          </View>

          <View style={[styles.formFields, isSearchMode && styles.formFieldsSearch]}>
            <View style={styles.content}>
              <View style={styles.fieldGroup}>
                <View
                  style={[
                    styles.inputWrap,
                    { backgroundColor: colors.muted, borderColor: colors.border },
                    fieldErrors?.label ? { borderColor: colors.destructive } : null,
                  ]}
                >
                  <Feather name="edit-3" size={16} color={colors.mutedForeground} />
                  <TextInput
                    ref={labelInputRef}
                    style={[styles.input, { color: colors.foreground }]}
                    value={label}
                    onChangeText={onLabelChange}
                    showSoftInputOnFocus
                    onFocus={onLabelFocus}
                    placeholder="Location name"
                    placeholderTextColor={colors.mutedForeground}
                    returnKeyType="next"
                    onSubmitEditing={() => addressInputRef.current?.focus()}
                    accessibilityLabel="Location name"
                  />
                </View>
                {fieldErrors?.label ? (
                  <Text style={[styles.fieldError, { color: colors.destructive }]} accessibilityLiveRegion="polite">
                    {fieldErrors.label}
                  </Text>
                ) : null}
              </View>

              <View style={styles.fieldGroup}>
                <View
                  style={[
                    styles.inputWrap,
                    { backgroundColor: colors.muted, borderColor: colors.border },
                    fieldErrors?.address ? { borderColor: colors.destructive } : null,
                  ]}
                >
                  <MaterialCommunityIcons name="map-marker-outline" size={18} color={colors.mutedForeground} />
                  <TextInput
                    ref={addressInputRef}
                    style={[styles.input, { color: colors.foreground }]}
                    value={address}
                    onChangeText={onAddressChange}
                    showSoftInputOnFocus
                    onFocus={onAddressFocus}
                    placeholder="Address"
                    placeholderTextColor={colors.mutedForeground}
                    returnKeyType="search"
                    accessibilityLabel="Address"
                  />
                {searchLoading && showAddressSuggestions && (
                  <ActivityIndicator size="small" color={colors.primary} />
                )}
                {address.length > 0 && !(searchLoading && showAddressSuggestions) && (
                  <TouchableOpacity
                    style={styles.clearButton}
                    onPress={onClearAddress}
                    activeOpacity={0.7}
                    accessibilityLabel="Clear address"
                  >
                    <Feather name="x" size={16} color={colors.mutedForeground} />
                  </TouchableOpacity>
                )}
                </View>
                {fieldErrors?.address ? (
                  <Text style={[styles.fieldError, { color: colors.destructive }]} accessibilityLiveRegion="polite">
                    {fieldErrors.address}
                  </Text>
                ) : null}
              </View>
            </View>

            {renderSuggestionsList()}

            <View style={styles.content}>
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.actionPrimary, { backgroundColor: colors.primary }]}
                  onPress={onSave}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel="Save changes"
                  accessibilityHint="Saves the location name and address"
                >
                  <Feather name="check" size={16} color={colors.primaryForeground} />
                  <Text style={[styles.actionText, { color: colors.primaryForeground }]}>Save changes</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionSecondary, { backgroundColor: colors.muted, borderColor: colors.border }]}
                  onPress={onUseGps}
                  activeOpacity={0.85}
                >
                  <MaterialCommunityIcons name="crosshairs-gps" size={16} color={colors.foreground} />
                  <Text style={[styles.actionText, { color: colors.foreground }]}>Use GPS</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.delete, { backgroundColor: colors.destructiveHex + '14', borderColor: colors.destructiveHex + '40' }]}
                onPress={onDelete}
                activeOpacity={0.85}
              >
                <Feather name="trash-2" size={16} color={colors.destructive} />
                <Text style={[styles.deleteText, { color: colors.destructive }]}>Delete saved location</Text>
              </TouchableOpacity>
            </View>
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
    borderRadius: FLOATING_PANEL_TOP_RADIUS,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderWidth: StyleSheet.hairlineWidth,
    borderTopWidth: 0,
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
  sheetSearch: {
    overflow: 'hidden',
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
  bodySearch: {
    flex: 1,
    minHeight: 0,
  },
  chromeTapZone: {
    alignSelf: 'stretch',
  },
  headerPressable: {
    alignSelf: 'stretch',
  },
  dragZone: {
    paddingTop: 0,
    paddingBottom: 0,
  },
  handleTouch: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingTop: 6,
    paddingBottom: 4,
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
  title: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
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
  formFields: {
    gap: 10,
    paddingBottom: 8,
  },
  formFieldsSearch: {
    flex: 1,
    minHeight: 0,
  },
  content: {
    marginHorizontal: GREETING_LEFT_INSET,
    gap: 10,
  },
  fieldGroup: {
    gap: 4,
  },
  fieldError: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    lineHeight: 16,
    paddingLeft: 4,
  },
  suggestionsListWrap: {
    marginHorizontal: GREETING_LEFT_INSET,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(128,128,128,0.25)',
    overflow: 'hidden',
  },
  suggestionsListWrapRest: {
    maxHeight: SUGGESTIONS_REST_MAX_HEIGHT,
  },
  suggestionsListWrapExpanded: {
    flex: 1,
    minHeight: 0,
  },
  suggestionsScroll: {
    flex: 1,
  },
  suggestionsScrollContent: {
    flexGrow: 0,
  },
  inputWrap: {
    minHeight: 48,
    borderRadius: buttonCornerRadius(48),
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
    paddingVertical: 10,
  },
  clearButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionsLoading: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  suggestionIcon: {
    width: 28,
    alignItems: 'center',
  },
  suggestionText: {
    flex: 1,
    gap: 2,
  },
  suggestionTitle: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  suggestionSub: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  suggestionsEmpty: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    lineHeight: 20,
    padding: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionPrimary: {
    flex: 1,
    minHeight: 44,
    borderRadius: buttonCornerRadius(44),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionSecondary: {
    flex: 1,
    minHeight: 44,
    borderRadius: buttonCornerRadius(44),
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  delete: {
    minHeight: 44,
    borderRadius: buttonCornerRadius(44),
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  deleteText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
});
