import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { type ReactNode, type RefObject } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { GlassHeader, useGlassHeaderMetrics } from '@/components/GlassHeader';
import { GlassScrollView } from '@/components/GlassScrollView';
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
            paddingTop: headerMetrics.contentTop - 8,
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
            <Feather name="search" size={18} color={colors.mutedForeground} />
            <TextInput
              ref={inputRef}
              style={[styles.locationSearchInput, { color: colors.foreground }]}
              value={text}
              onChangeText={onTextChange}
              placeholder="Address, hotel, or 1 KG 185 ST"
              placeholderTextColor={colors.mutedForeground}
              returnKeyType="search"
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
                <Feather name="x" size={16} color={colors.mutedForeground} />
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
                <MaterialCommunityIcons name="crosshairs-gps" size={16} color={colors.primary} />
              </View>
              <View style={styles.locationQuickText}>
                <Text style={[styles.locationQuickTitle, { color: colors.foreground }]} numberOfLines={1}>Use current location</Text>
                <Text style={[styles.locationQuickSub, { color: colors.mutedForeground }]} numberOfLines={1}>GPS precise</Text>
              </View>
            </TouchableOpacity> : null}

            <TouchableOpacity
              style={[styles.locationQuickCard, { backgroundColor: colors.card }]}
              onPress={onChooseMap}
              activeOpacity={0.85}
            >
              <View style={[styles.locationQuickIcon, { backgroundColor: colors.primaryHex + '18' }]}>
                <MaterialCommunityIcons name="map-outline" size={16} color={colors.primary} />
              </View>
              <View style={styles.locationQuickText}>
                <Text style={[styles.locationQuickTitle, { color: colors.foreground }]} numberOfLines={1}>Choose on map</Text>
                <Text style={[styles.locationQuickSub, { color: colors.mutedForeground }]} numberOfLines={1}>Drag map</Text>
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
                <Text style={[
                  styles.locationTabText,
                  { color: listTab === tab ? colors.primaryForeground : colors.mutedForeground },
                ]}>
                  {tab === 'saved' ? 'Saved locations' : 'Previous rides'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <GlassScrollView
          style={styles.locationSearchScroll}
          indicatorTop={8}
          indicatorBottom={bottomInset + 20}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onScrollBeginDrag={Keyboard.dismiss}
          contentContainerStyle={[
            styles.locationSearchList,
            { paddingHorizontal: 20, paddingBottom: bottomInset + 20 },
          ]}
        >
          {hasSearchResults && (
            <>
              <Text style={[styles.locationSectionTitle, { color: colors.mutedForeground }]}>Search results</Text>
              {text.trim().length >= 2 && (
                <TouchableOpacity
                  style={[styles.locationOption, { borderBottomColor: colors.border }]}
                  onPress={() => onApplyLocation(target, buildTypedLocation())}
                >
                  <View style={styles.locationOptionIcon}>
                    <Feather name="edit-3" size={16} color={colors.foreground} />
                  </View>
                  <View style={styles.locationOptionText}>
                    <Text style={[styles.locationOptionTitle, { color: colors.foreground }]} numberOfLines={1}>
                      Use "{text.trim()}"
                    </Text>
                    <Text style={[styles.locationOptionSub, { color: colors.mutedForeground }]}>Confirm exact details in chat</Text>
                  </View>
                </TouchableOpacity>
              )}

              {text.trim().length >= 2 && !loading && suggestions.length === 0 && (
                <Text style={[styles.locationSearchEmpty, { color: colors.mutedForeground }]}>
                  No matches yet. Try the full name (e.g. Serena Hotel) or a grid address with ST/AV, or pin on the map.
                </Text>
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
                      <MaterialCommunityIcons name="map-marker-outline" size={18} color={colors.foreground} />
                    </View>
                    <View style={styles.locationOptionText}>
                      <Text style={[styles.locationOptionTitle, { color: colors.foreground }]} numberOfLines={1}>
                        {suggestion.title}
                      </Text>
                      <Text style={[styles.locationOptionSub, { color: colors.mutedForeground }]} numberOfLines={2}>
                        {suggestion.subtitle ?? suggestion.place_name}
                      </Text>
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
