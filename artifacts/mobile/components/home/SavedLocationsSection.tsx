import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import type { useColors } from '@/hooks/useColors';
import type { RideLocation, SavedLocation } from '@/types';
import { styles } from './homeStyles';

export function SavedLocationsSection({
  tab,
  colors,
  hasSearchResults,
  savedLocations,
  recentLocations,
  onSelect,
  onShowActions,
}: {
  tab: 'saved' | 'previous';
  colors: ReturnType<typeof useColors>;
  hasSearchResults: boolean;
  savedLocations: SavedLocation[];
  recentLocations: RideLocation[];
  onSelect: (location: RideLocation) => void;
  onShowActions: (location: SavedLocation) => void;
}) {
  if (tab === 'saved') {
    return (
      <>
        <Text style={[styles.locationSectionTitle, { color: colors.mutedForeground }, hasSearchResults && styles.locationSectionTitleAfterSearch]}>
          Saved locations
        </Text>
        {savedLocations.length === 0 && (
          <View style={[styles.locationEmptyState, { backgroundColor: colors.card }]}>
            <Feather name="bookmark" size={18} color={colors.mutedForeground} />
            <Text style={[styles.locationEmptyText, { color: colors.mutedForeground }]}>
              No saved places yet. Tap "Save" on any search result.
            </Text>
          </View>
        )}
        {savedLocations.map((location, index) => (
          <View key={location.id ?? `${location.address}-${index}`} style={[styles.locationOption, { borderBottomColor: colors.border }]}>
            <TouchableOpacity
              style={styles.locationOptionMain}
              onPress={() => onSelect(location)}
              onLongPress={() => onShowActions(location)}
              delayLongPress={400}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={`${location.label}, ${location.address ?? 'saved place'}`}
            >
              <View style={styles.locationOptionIcon}>
                <Feather name="bookmark" size={16} color={colors.primary} />
              </View>
              <View style={styles.locationOptionText}>
                <Text style={[styles.locationOptionTitle, { color: colors.foreground }]} numberOfLines={1}>{location.label}</Text>
                <Text style={[styles.locationOptionSub, { color: colors.mutedForeground }]} numberOfLines={1}>{location.address}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.savedLocationMenuButton}
              onPress={() => onShowActions(location)}
              activeOpacity={0.8}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              accessibilityRole="button"
              accessibilityLabel={`More options for ${location.label}`}
            >
              <Feather name="more-horizontal" size={18} color={colors.foreground} />
            </TouchableOpacity>
          </View>
        ))}
      </>
    );
  }

  return (
    <>
      <Text style={[styles.locationSectionTitle, { color: colors.mutedForeground }, hasSearchResults && styles.locationSectionTitleAfterSearch]}>
        Previous rides
      </Text>
      {recentLocations.length === 0 && (
        <View style={[styles.locationEmptyState, { backgroundColor: colors.card }]}>
          <Feather name="clock" size={18} color={colors.mutedForeground} />
          <Text style={[styles.locationEmptyText, { color: colors.mutedForeground }]}>
            Previous ride locations will appear here.
          </Text>
        </View>
      )}
      {recentLocations.map((location, index) => (
        <TouchableOpacity
          key={`${location.address}-${index}-recent`}
          style={[styles.locationOption, { borderBottomColor: colors.border }]}
          onPress={() => onSelect(location)}
        >
          <View style={styles.locationOptionText}>
            <Text style={[styles.locationOptionTitle, { color: colors.foreground }]} numberOfLines={1}>
              {location.address ?? 'Recent location'}
            </Text>
            <Text style={[styles.locationOptionSub, { color: colors.mutedForeground }]}>Previous ride</Text>
          </View>
        </TouchableOpacity>
      ))}
    </>
  );
}
