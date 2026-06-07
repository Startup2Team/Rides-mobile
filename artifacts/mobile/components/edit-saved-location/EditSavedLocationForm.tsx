import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Feather } from '@expo/vector-icons';
import { useRef } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import type { GeocodeSuggestion } from '@/services/geocoding';
import { styles } from './editSavedLocationSheetStyles';
import { SavedLocationSuggestionList } from './SavedLocationSuggestionList';

export type EditSavedFieldErrors = {
  label?: string;
  address?: string;
};

type Props = {
  label: string;
  address: string;
  fieldErrors?: EditSavedFieldErrors;
  suggestions: GeocodeSuggestion[];
  searchLoading: boolean;
  showAddressSuggestions: boolean;
  isSearchMode: boolean;
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
};

export function EditSavedLocationForm({
  label,
  address,
  fieldErrors,
  suggestions,
  searchLoading,
  showAddressSuggestions,
  isSearchMode,
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
}: Props) {
  const colors = useColors();
  const labelInputRef = useRef<TextInput>(null);
  const addressInputRef = useRef<TextInput>(null);

  return (
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

      <SavedLocationSuggestionList
        address={address}
        suggestions={suggestions}
        searchLoading={searchLoading}
        showAddressSuggestions={showAddressSuggestions}
        isSearchMode={isSearchMode}
        onSelectSuggestion={onSelectSuggestion}
        onUseTypedAddress={onUseTypedAddress}
      />

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
          style={[
            styles.delete,
            {
              backgroundColor: colors.destructiveHex + '14',
              borderColor: colors.destructiveHex + '40',
            },
          ]}
          onPress={onDelete}
          activeOpacity={0.85}
        >
          <Feather name="trash-2" size={16} color={colors.destructive} />
          <Text style={[styles.deleteText, { color: colors.destructive }]}>Delete saved location</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
