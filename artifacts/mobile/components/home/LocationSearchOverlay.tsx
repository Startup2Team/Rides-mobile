import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { type ReactNode, type RefObject } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { AppText } from '@/components/AppText';
import { GlassHeader, useGlassHeaderMetrics } from '@/components/GlassHeader';
import { GlassScrollView } from '@/components/GlassScrollView';
import { icons } from '@/constants/icons';
import { spacing, semanticSpacing } from '@/constants/spacing';
import type { useColors } from '@/hooks/useColors';
import type { LocationListTab, LocationSearchTarget } from '@/hooks/home/useLocationSearch';
import type { GeocodeSuggestion } from '@/services/geocoding';
import type { RideLocation, SavedLocation } from '@/types';
import { SavedLocationsSection } from './SavedLocationsSection';
import { styles } from './homeStyles';

export function LocationSearchOverlay({
  bottomInset,
  buildTypedLocation,
  children,
  colors,
  inputRef,
  listTab,
  loading,
  onApplyLocation,
  onAddSavedLocation,
  onChooseMap,
  onClear,
  onClose,
  onSaveCandidate,
  onSetListTab,
  onShowSavedLocationActions,
  onTextChange,
  recentLocations,
  savedLocations,
  suggestions,
  target,
  text,
  userLocation,
  gpsLocation,
}: {
  bottomInset: number;
  buildTypedLocation: () => RideLocation;
  children?: ReactNode;
  colors: ReturnType<typeof useColors>;
  inputRef: RefObject<TextInput | null>;
  listTab: LocationListTab;
  loading: boolean;
  onApplyLocation: (target: LocationSearchTarget, location: RideLocation) => void;
  onAddSavedLocation: () => void;
  onChooseMap: () => void;
  onClear: () => void;
  onClose: () => void;
  onSaveCandidate: (location: RideLocation) => void;
  onSetListTab: (tab: LocationListTab) => void;
  onShowSavedLocationActions: (location: SavedLocation) => void;
  onTextChange: (text: string) => void;
  recentLocations: RideLocation[];
  savedLocations: SavedLocation[];
  suggestions: GeocodeSuggestion[];
  target: LocationSearchTarget;
  text: string;
  userLocation: RideLocation;
  gpsLocation: RideLocation | null;
}) {
  const headerMetrics = useGlassHeaderMetrics();
  const hasSearchResults = text.trim().length >= 2 || suggestions.length > 0;

  return (
    <View style={[styles.locationSearchScreen, { backgroundColor: colors.background }]}>
      <GlassHeader
        title={target === 'pickup' ? 'Pickup Location' : 'Drop off Location'}
        onBackPress={onClose}
      />

      <View
        style={[
          styles.locationSearchBody,
          {
            paddingTop: headerMetrics.contentTop - spacing[8],
            paddingBottom: bottomInset,
          },
        ]}
      >
        <View style={styles.locationSearchFixed}>
          <TouchableOpacity
            style={[styles.locationSearchInputWrap, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => inputRef.current?.focus()}
            activeOpacity={1}
          >
            <Feather name="search" size={icons.semantic.row} color={colors.mutedForeground} />
            <TextInput
              ref={inputRef}
              style={[styles.locationSearchInput, { color: colors.foreground }]}
              value={text}
              onChangeText={onTextChange}
              placeholder="Address, hotel, or 1 KG 185 ST"
              placeholderTextColor={colors.mutedForeground}
              returnKeyType="search"
              autoFocus
            />
            {loading ? (
              <View style={styles.locationSearchClear}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : text.length > 0 && (
              <TouchableOpacity
                style={[styles.locationSearchClear, { backgroundColor: colors.muted, borderColor: colors.border }]}
                onPress={event => {
                  event.stopPropagation();
                  onClear();
                  inputRef.current?.focus();
                }}
                activeOpacity={0.75}
              >
                <Feather name="x" size={icons.semantic.button} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
          </TouchableOpacity>

          <View style={styles.locationQuickRow}>
            {gpsLocation ? <TouchableOpacity
              style={[styles.locationQuickCard, { backgroundColor: colors.card }]}
              onPress={() => onApplyLocation(target, {
                ...gpsLocation,
                address: 'Current Location',
                locationType: 'precise',
              })}
              activeOpacity={0.85}
            >
              <View style={[styles.locationQuickIcon, { backgroundColor: colors.primaryHex + '18' }]}>
                <MaterialCommunityIcons name="crosshairs-gps" size={icons.semantic.button} color={colors.primary} />
              </View>
              <View style={styles.locationQuickText}>
                <AppText variant="caption" style={[styles.locationQuickTitle, { color: colors.foreground }]} numberOfLines={1}>Use current location</AppText>
                <AppText variant="tiny" style={[styles.locationQuickSub, { color: colors.mutedForeground }]} numberOfLines={1}>GPS precise</AppText>
              </View>
            </TouchableOpacity> : null}

            <TouchableOpacity
              style={[styles.locationQuickCard, { backgroundColor: colors.card }]}
              onPress={onChooseMap}
              activeOpacity={0.85}
            >
              <View style={[styles.locationQuickIcon, { backgroundColor: colors.primaryHex + '18' }]}>
                <MaterialCommunityIcons name="map-outline" size={icons.semantic.button} color={colors.primary} />
              </View>
              <View style={styles.locationQuickText}>
                <AppText variant="caption" style={[styles.locationQuickTitle, { color: colors.foreground }]} numberOfLines={1}>Choose on map</AppText>
                <AppText variant="tiny" style={[styles.locationQuickSub, { color: colors.mutedForeground }]} numberOfLines={1}>Drag map</AppText>
              </View>
            </TouchableOpacity>
          </View>

          <View style={[styles.locationTabs, { backgroundColor: colors.muted }]}>
            {(['saved', 'previous'] as const).map(tab => (
              <TouchableOpacity
                key={tab}
                style={[
                  styles.locationTab,
                  listTab === tab && { backgroundColor: colors.primary },
                ]}
                onPress={() => onSetListTab(tab)}
                activeOpacity={0.85}
              >
                <AppText variant="label" style={[
                  styles.locationTabText,
                  { color: listTab === tab ? colors.primaryForeground : colors.mutedForeground },
                ]}>
                  {tab === 'saved' ? 'Saved locations' : 'Previous rides'}
                </AppText>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <GlassScrollView
          style={styles.locationSearchScroll}
          indicatorTop={spacing[8]}
          indicatorBottom={bottomInset + spacing[20]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onScrollBeginDrag={Keyboard.dismiss}
          contentContainerStyle={[
            styles.locationSearchList,
            { paddingHorizontal: semanticSpacing.screenPadding, paddingBottom: bottomInset + spacing[20] },
          ]}
        >
          {hasSearchResults && (
            <>
              <AppText variant="tiny" style={[styles.locationSectionTitle, { color: colors.mutedForeground }]}>Search results</AppText>
              {text.trim().length >= 2 && (
                <TouchableOpacity
                  style={[styles.locationOption, { borderBottomColor: colors.border }]}
                  onPress={() => onApplyLocation(target, buildTypedLocation())}
                >
                  <View style={styles.locationOptionIcon}>
                    <Feather name="edit-2" size={icons.semantic.button} color={colors.foreground} />
                  </View>
                  <View style={styles.locationOptionText}>
                    <AppText variant="bodySmall" style={[styles.locationOptionTitle, { color: colors.foreground }]} numberOfLines={1}>
                      Use "{text.trim()}"
                    </AppText>
                    <AppText variant="caption" style={[styles.locationOptionSub, { color: colors.mutedForeground }]}>Confirm exact details in chat</AppText>
                  </View>
                </TouchableOpacity>
              )}

              {text.trim().length >= 2 && !loading && suggestions.length === 0 && (
                <AppText variant="bodySmall" style={[styles.locationSearchEmpty, { color: colors.mutedForeground }]}>
                  No matches yet. Try the full name (e.g. Serena Hotel) or a grid address with ST/AV, or pin on the map.
                </AppText>
              )}

              {suggestions.map(suggestion => {
                const location: RideLocation = {
                  ...suggestion.coords,
                  address: suggestion.place_name,
                  locationType: 'precise',
                };
                return (
                  <TouchableOpacity
                    key={suggestion.id}
                    style={[styles.locationOption, { borderBottomColor: colors.border }]}
                    onPress={() => onApplyLocation(target, location)}
                  >
                    <View style={styles.locationOptionIcon}>
                      <MaterialCommunityIcons name="map-marker-outline" size={icons.semantic.row} color={colors.foreground} />
                    </View>
                    <View style={styles.locationOptionText}>
                      <AppText variant="bodySmall" style={[styles.locationOptionTitle, { color: colors.foreground }]} numberOfLines={1}>
                        {suggestion.title}
                      </AppText>
                      <AppText variant="caption" style={[styles.locationOptionSub, { color: colors.mutedForeground }]} numberOfLines={2}>
                        {suggestion.subtitle ?? suggestion.place_name}
                      </AppText>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </>
          )}

          <SavedLocationsSection
            tab={listTab}
            colors={colors}
            hasSearchResults={hasSearchResults}
            savedLocations={savedLocations}
            recentLocations={recentLocations}
            onSelect={location => onApplyLocation(target, location)}
            onShowActions={onShowSavedLocationActions}
            onAddSavedLocation={onAddSavedLocation}
          />
        </GlassScrollView>
      </View>
      {children}
    </View>
  );
}
