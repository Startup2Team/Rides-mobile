import { Feather } from '@expo/vector-icons';
import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { AppText } from '@/components/AppText';
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
  onAddSavedLocation,
}: {
  tab: 'saved' | 'previous';
  colors: ReturnType<typeof useColors>;
  hasSearchResults: boolean;
  savedLocations: SavedLocation[];
  recentLocations: RideLocation[];
  onSelect: (location: RideLocation) => void;
  onShowActions: (location: SavedLocation) => void;
  onAddSavedLocation: () => void;
}) {
  if (tab === 'saved') {
    return (
      <>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: hasSearchResults ? 18 : 4, marginBottom: 6 }}>
          <AppText variant="tiny" style={[styles.locationSectionTitle, { color: colors.mutedForeground, marginTop: 0, marginBottom: 0 }]}>
            Saved locations
          </AppText>
          {savedLocations.length > 0 && (
            <TouchableOpacity
              onPress={onAddSavedLocation}
              activeOpacity={0.8}
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
              }}
              accessibilityRole="button"
              accessibilityLabel="Add saved place"
            >
              <Feather name="plus" size={16} color={colors.primaryForeground} />
            </TouchableOpacity>
          )}
        </View>
        {savedLocations.length === 0 && (
          <View style={styles.locationEmptyState}>
            <Feather name="bookmark" size={18} color={colors.mutedForeground} />
            <AppText variant="label" style={[styles.locationEmptyText, { color: colors.mutedForeground }]}>
              Save places you use often for quicker ride requests.
            </AppText>
            <TouchableOpacity
              style={[styles.locationEmptyAction, { backgroundColor: colors.primary }]}
              onPress={onAddSavedLocation}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Add saved place"
            >
              <Feather name="plus" size={20} color={colors.primaryForeground} />
            </TouchableOpacity>
            <AppText variant="label" style={[styles.locationEmptyActionText, { color: colors.foreground }]}>Add place</AppText>
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
                <AppText variant="bodySmall" style={[styles.locationOptionTitle, { color: colors.foreground }]} numberOfLines={1}>{location.label}</AppText>
                <AppText variant="caption" style={[styles.locationOptionSub, { color: colors.mutedForeground }]} numberOfLines={1}>{location.address}</AppText>
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
      <AppText variant="tiny" style={[styles.locationSectionTitle, { color: colors.mutedForeground }, hasSearchResults && styles.locationSectionTitleAfterSearch]}>
        Previous rides
      </AppText>
      {recentLocations.length === 0 && (
        <View style={[styles.locationEmptyState, { backgroundColor: colors.card }]}>
          <Feather name="clock" size={18} color={colors.mutedForeground} />
          <AppText variant="label" style={[styles.locationEmptyText, { color: colors.mutedForeground }]}>
            Previous ride locations will appear here.
          </AppText>
        </View>
      )}
      {recentLocations.map((location, index) => (
        <TouchableOpacity
          key={`${location.address}-${index}-recent`}
          style={[styles.locationOption, { borderBottomColor: colors.border }]}
          onPress={() => onSelect(location)}
        >
          <View style={styles.locationOptionText}>
            <AppText variant="bodySmall" style={[styles.locationOptionTitle, { color: colors.foreground }]} numberOfLines={1}>
              {location.address ?? 'Recent location'}
            </AppText>
            <AppText variant="caption" style={[styles.locationOptionSub, { color: colors.mutedForeground }]}>Previous ride</AppText>
          </View>
        </TouchableOpacity>
      ))}
    </>
  );
}
