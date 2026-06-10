import React, { useMemo } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CloseButton } from '@/components/BackButton';
import {
  EditSavedLocationForm,
  type EditSavedFieldErrors,
} from '@/components/edit-saved-location/EditSavedLocationForm';
import {
  EDIT_SAVED_FORM_TAB_BAR_PADDING,
  styles,
} from '@/components/edit-saved-location/editSavedLocationSheetStyles';
import { SheetBackdrop } from '@/components/SheetBackdrop';
import { useColors } from '@/hooks/useColors';
import { useEditSavedLocationKeyboard } from '@/hooks/edit-saved-location/useEditSavedLocationKeyboard';
import { useEditSavedLocationSheetAnimation } from '@/hooks/edit-saved-location/useEditSavedLocationSheetAnimation';
import type { GeocodeSuggestion } from '@/services/geocoding';
import type { SavedLocation } from '@/types';

export type { EditSavedFieldErrors } from '@/components/edit-saved-location/EditSavedLocationForm';

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
  const {
    mode,
    sheetHeight,
    keyboardOpenRef,
    keyboardLiftAnim,
    dismissKeyboard,
    resetKeyboard,
    resetForEntrance,
  } = useEditSavedLocationKeyboard(topInset);
  const {
    closeRef,
    backdropOpacity,
    chromePanResponder,
    dismissSheet,
    onSheetLayout,
    translateY,
  } = useEditSavedLocationSheetAnimation({
    locationId: location.id,
    onClose,
    keyboardOpenRef,
    keyboardLiftAnim,
    dismissKeyboard,
    resetKeyboard,
    resetForEntrance,
  });

  const sheetSurface = useMemo(() => ({ backgroundColor: colors.card }), [colors.card]);
  const isSearchMode = mode === 'search';

  return (
    <>
      <SheetBackdrop
        onPress={dismissSheet}
        animatedOpacity={backdropOpacity}
        blurIntensity={18}
        lightScrimOpacity={0.2}
        darkScrimOpacity={0.42}
      />

      <Animated.View
        onLayout={onSheetLayout}
        style={[
          styles.sheet,
          styles.sheetRaised,
          sheetSurface,
          isSearchMode && styles.sheetSearch,
          sheetHeight > 0 ? { height: sheetHeight } : null,
          {
            paddingBottom: isSearchMode ? 12 : insets.bottom + EDIT_SAVED_FORM_TAB_BAR_PADDING,
            transform: [{ translateY }],
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

          <EditSavedLocationForm
            label={label}
            address={address}
            fieldErrors={fieldErrors}
            suggestions={suggestions}
            searchLoading={searchLoading}
            showAddressSuggestions={showAddressSuggestions}
            isSearchMode={isSearchMode}
            onLabelChange={onLabelChange}
            onAddressChange={onAddressChange}
            onLabelFocus={onLabelFocus}
            onAddressFocus={onAddressFocus}
            onClearAddress={onClearAddress}
            onSelectSuggestion={onSelectSuggestion}
            onUseTypedAddress={onUseTypedAddress}
            onSave={onSave}
            onDelete={onDelete}
            onUseGps={onUseGps}
          />
        </View>
      </Animated.View>
    </>
  );
}
