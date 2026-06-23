import { Feather } from '@expo/vector-icons';
import React, { type RefObject } from 'react';
import {
  Animated,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type PanResponderInstance,
} from 'react-native';
import { CloseButton, type CloseButtonHandle } from '@/components/BackButton';
import { SheetBackdrop } from '@/components/SheetBackdrop';
import { TAB_SCREEN_BOTTOM_PADDING } from '@/constants/tabBar';
import type { useColors } from '@/hooks/useColors';
import type { RideLocation } from '@/types';
import { styles } from './homeStyles';
import {
  SAVE_LABEL_WIDTHS,
  SAVE_LOCATION_LABELS,
} from './homeUtils';

export function SaveLocationSheet({
  animatedOpacity,
  bottomInset,
  bottomOffset = 0,
  colors,
  customLabel,
  dragAnimation,
  keyboardAnimation,
  onClose,
  onCustomLabelChange,
  onKeyboardLift,
  onLayoutHeight,
  onSave,
  onSelectLabel,
  panResponder,
  pendingLocation,
  showCustomLabel,
  closeButtonRef,
  estimatedKeyboardOffset,
  surfaceStyle,
}: {
  animatedOpacity: Animated.AnimatedInterpolation<string | number>;
  bottomInset: number;
  bottomOffset?: number;
  closeButtonRef: RefObject<CloseButtonHandle | null>;
  colors: ReturnType<typeof useColors>;
  customLabel: string;
  dragAnimation: Animated.Value;
  estimatedKeyboardOffset: number;
  keyboardAnimation: Animated.Value;
  onClose: () => void;
  onCustomLabelChange: (label: string) => void;
  onKeyboardLift: (offset: number, duration?: number) => void;
  onLayoutHeight: (height: number) => void;
  onSave: (label: string) => void;
  onSelectLabel: (label: string) => void;
  panResponder: PanResponderInstance;
  pendingLocation: RideLocation | null;
  showCustomLabel: boolean;
  surfaceStyle: { backgroundColor: string; shadowOpacity: number };
}) {
  if (!pendingLocation) return null;

  return (
    <>
      <SheetBackdrop onPress={onClose} animatedOpacity={animatedOpacity} />
      <Animated.View
        onLayout={event => onLayoutHeight(event.nativeEvent.layout.height)}
        style={[
          styles.overlayFormSheet,
          styles.formSheetSurface,
          styles.overlayFormSheetRaised,
          surfaceStyle,
          {
            bottom: bottomOffset,
            paddingBottom: bottomInset + TAB_SCREEN_BOTTOM_PADDING,
            transform: [{
              translateY: Animated.add(dragAnimation, Animated.multiply(keyboardAnimation, -1)),
            }],
          },
        ]}
        {...panResponder.panHandlers}
      >
        <View style={styles.formSheetCloseAnchor} pointerEvents="box-none">
          <CloseButton
            ref={closeButtonRef}
            shutOnPress={false}
            onPress={onClose}
            accessibilityLabel="Close save location"
          />
        </View>
        <View style={styles.formSheetBody}>
          <View style={[styles.sheetDragZone, styles.formSheetDragZone]}>
            <View style={[styles.sheetHandleTouch, styles.formSheetHandleTouch]}>
              <View style={styles.sheetHandle} />
            </View>
            <View style={styles.formSheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Save location as</Text>
            </View>
            <View style={styles.formSheetSubheader}>
              <Text style={[styles.formSheetSubtitle, { color: colors.mutedForeground }]} numberOfLines={2}>
                {pendingLocation.address ?? 'Selected location'}
              </Text>
              <Text style={[styles.formSheetHint, { color: colors.mutedForeground }]}>
                {showCustomLabel ? 'Type a custom label to finish saving.' : 'Choose one label to finish saving.'}
              </Text>
            </View>
          </View>
          <View style={styles.formSheetContent}>
            <View style={styles.saveAsLocationLabels}>
              {SAVE_LOCATION_LABELS.map(label => (
                <TouchableOpacity
                  key={label}
                  style={[
                    styles.saveAsLocationLabel,
                    { width: SAVE_LABEL_WIDTHS[label] },
                    { backgroundColor: colors.muted, borderColor: colors.border },
                  ]}
                  onPress={() => onSelectLabel(label)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.saveAsLocationLabelText, { color: colors.foreground }]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {showCustomLabel && (
              <View style={styles.saveAsCustomLabelSection}>
                <View style={[styles.saveAsLocationInputWrap, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                  <Feather name="tag" size={18} color={colors.mutedForeground} />
                  <TextInput
                    style={[styles.saveAsLocationInput, { color: colors.foreground }]}
                    value={customLabel}
                    onChangeText={onCustomLabelChange}
                    placeholder="Custom label"
                    placeholderTextColor={colors.mutedForeground}
                    autoFocus
                    returnKeyType="done"
                    onFocus={() => {
                      if (Platform.OS === 'web') onKeyboardLift(estimatedKeyboardOffset, 0);
                    }}
                    onBlur={() => {
                      if (Platform.OS === 'web') onKeyboardLift(0, 0);
                    }}
                    onSubmitEditing={() => onSave(customLabel)}
                  />
                </View>
                <TouchableOpacity
                  style={[
                    styles.saveAsCustomLabelButton,
                    {
                      backgroundColor: customLabel.trim() ? colors.primary : colors.muted,
                      opacity: customLabel.trim() ? 1 : 0.6,
                    },
                  ]}
                  onPress={() => onSave(customLabel)}
                  disabled={!customLabel.trim()}
                  activeOpacity={0.85}
                >
                  <Feather
                    name="check"
                    size={18}
                    color={customLabel.trim() ? colors.primaryForeground : colors.mutedForeground}
                  />
                  <Text
                    style={[
                      styles.saveAsCustomLabelButtonText,
                      { color: customLabel.trim() ? colors.primaryForeground : colors.mutedForeground },
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
