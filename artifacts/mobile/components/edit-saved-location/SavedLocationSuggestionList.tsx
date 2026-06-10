import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Feather } from '@expo/vector-icons';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import type { GeocodeSuggestion } from '@/services/geocoding';
import { styles } from './editSavedLocationSheetStyles';

type Props = {
  address: string;
  suggestions: GeocodeSuggestion[];
  searchLoading: boolean;
  showAddressSuggestions: boolean;
  isSearchMode: boolean;
  onSelectSuggestion: (suggestion: GeocodeSuggestion) => void;
  onUseTypedAddress: () => void;
};

export function SavedLocationSuggestionList({
  address,
  suggestions,
  searchLoading,
  showAddressSuggestions,
  isSearchMode,
  onSelectSuggestion,
  onUseTypedAddress,
}: Props) {
  const colors = useColors();

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
        {searchLoading && suggestions.length === 0 ? (
          <View style={styles.suggestionsLoading}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : (
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
        )}
      </ScrollView>
    </View>
  );
}
