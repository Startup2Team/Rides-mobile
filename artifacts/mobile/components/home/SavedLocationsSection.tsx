import { Feather } from '@expo/vector-icons';
import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { icons } from '@/constants/icons';
import { radius } from '@/constants/radius';
import { sizes } from '@/constants/sizes';
import { spacing } from '@/constants/spacing';
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
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: hasSearchResults ? 18 : spacing[4], marginBottom: spacing[6] }}>
          <AppText variant="tiny" style={[styles.locationSectionTitle, { color: colors.mutedForeground, marginTop: spacing[0], marginBottom: spacing[0] }]}>
            Saved locations
          </AppText>
          {savedLocations.length > 0 && (
            <TouchableOpacity
              onPress={onAddSavedLocation}
              activeOpacity={0.8}
              style={{
                width: sizes.avatar.xs,
                height: sizes.avatar.xs,
                borderRadius: radius.xl,
                backgroundColor: colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
              }}
              accessibilityRole="button"
              accessibilityLabel="Add saved place"
            >
              <Feather name="plus" size={icons.semantic.button} color={colors.primaryForeground} />
            </TouchableOpacity>
          )}
        </View>
        {savedLocations.length === 0 && (
          <View style={styles.locationEmptyState}>
            <Feather name="bookmark" size={icons.semantic.row} color={colors.mutedForeground} />
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
              <Feather name="plus" size={icons.size.lg} color={colors.primaryForeground} />
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
                <Feather name="bookmark" size={icons.semantic.button} color={colors.primary} />
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
              hitSlop={{ top: spacing[6], bottom: spacing[6], left: spacing[6], right: spacing[6] }}
              accessibilityRole="button"
              accessibilityLabel={`More options for ${location.label}`}
            >
              <Feather name="more-horizontal" size={icons.semantic.row} color={colors.foreground} />
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
          <Feather name="clock" size={icons.semantic.row} color={colors.mutedForeground} />
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
