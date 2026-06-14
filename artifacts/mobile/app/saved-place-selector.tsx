import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { type Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassHeader, useGlassHeaderMetrics } from '@/components/GlassHeader';
import { GlassScrollView } from '@/components/GlassScrollView';
import { MapPickerOverlay } from '@/components/home/MapPickerOverlay';
import { buttonCornerRadius } from '@/constants/buttons';
import { useSavedLocations } from '@/context/SavedLocationsContext';
import { useColors } from '@/hooks/useColors';
import { useLocationSearch } from '@/hooks/home/useLocationSearch';
import { KIGALI_CENTER, type RideLocation, type SavedLocation } from '@/types';
import { formatReverseGeocodeAddress } from '@/utils/locationUtils';

type SavedPlaceLabel = 'Home' | 'Work' | 'School' | 'Other';
const MAP_TYPES = ['standard', 'satellite', 'hybrid'] as const;
type AppMapType = typeof MAP_TYPES[number];
const MAP_LOCATION_DELTA = 0.012;

export default function SavedPlaceSelectorScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const headerMetrics = useGlassHeaderMetrics();
  const { label: rawLabel } = useLocalSearchParams<{ label?: string }>();
  const label = normalizeLabel(rawLabel);
  const { savedPlaces, persistSavedPlaces } = useSavedLocations();
  const existing = useMemo(
    () => savedPlaces.find(place => place.label.toLowerCase() === label.toLowerCase()),
    [label, savedPlaces],
  );
  const [mode, setMode] = useState<'search' | 'map'>('search');
  const [mapCoords, setMapCoords] = useState(existing ?? KIGALI_CENTER);
  const [mapAddress, setMapAddress] = useState(existing?.address ?? '');
  const [isDragging, setIsDragging] = useState(false);
  const [mapType, setMapType] = useState<AppMapType>('standard');
  const [customLabel, setCustomLabel] = useState('');
  const mapRef = useRef<MapView>(null);
  const inputRef = useRef<TextInput>(null);
  const search = useLocationSearch(existing ?? KIGALI_CENTER);

  useEffect(() => {
    search.setText(existing?.address ?? '');
  }, [existing?.address, search.setText]);

  const savePlace = async (place: RideLocation) => {
    const finalLabel = label === 'Other' ? customLabel.trim() : label;
    if (!finalLabel) {
      Alert.alert('Name this place', 'Enter a label before saving this location.');
      return;
    }
    const saved: SavedLocation = {
      ...place,
      id: existing?.id ?? `settings-${finalLabel.toLowerCase()}-${Date.now()}`,
      label: finalLabel,
    };
    const next = [saved, ...savedPlaces.filter(item =>
      item.id !== existing?.id && item.label.toLowerCase() !== finalLabel.toLowerCase()
    )];
    await persistSavedPlaces(next);
    router.back();
  };

  const openMap = () => {
    const initial = existing ?? KIGALI_CENTER;
    setMapCoords({ latitude: initial.latitude, longitude: initial.longitude });
    setMapAddress(existing?.address ?? '');
    setMode('map');
    Keyboard.dismiss();
  };

  const syncMapAddress = async (coords: typeof KIGALI_CENTER) => {
    const [geo] = await Location.reverseGeocodeAsync(coords).catch(() => [null]);
    setMapAddress(formatReverseGeocodeAddress(geo, 'Selected location'));
  };

  if (mode === 'map') {
    return (
      <MapPickerOverlay
          target="savedLocation"
          mapRef={mapRef}
          pinCoords={mapCoords}
          mapType={mapType}
          colors={colors}
          topInset={insets.top}
          bottomInset={insets.bottom}
          isDragging={isDragging}
          onLayout={() => {}}
          onDragStart={() => setIsDragging(true)}
          onRegionChangeComplete={(region: Region) => {
            const coords = { latitude: region.latitude, longitude: region.longitude };
            setIsDragging(false);
            setMapCoords(coords);
            void syncMapAddress(coords);
          }}
          onClose={() => setMode('search')}
          onCycleMapType={() => setMapType(previous => MAP_TYPES[(MAP_TYPES.indexOf(previous) + 1) % MAP_TYPES.length])}
          onCenterUser={() => mapRef.current?.animateToRegion({
            ...mapCoords,
            latitudeDelta: MAP_LOCATION_DELTA,
            longitudeDelta: MAP_LOCATION_DELTA,
          }, 600)}
          onConfirm={() => savePlace({
            ...mapCoords,
            address: mapAddress || 'Selected location',
            locationType: 'precise',
          })}
          savedLocationHint={`Drag the map to set your ${label.toLowerCase()} location`}
          savedLocationConfirmTitle={`Confirm ${label} Location`}
        />
    );
  }

  const hasQuery = search.text.trim().length >= 2;
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <GlassHeader title={label === 'Other' ? 'Add Place' : `${existing ? 'Edit' : 'Add'} ${label}`} />
      <View style={[styles.searchBody, { paddingTop: headerMetrics.contentTop - 4 }]}>
        {label === 'Other' ? (
          <View style={[styles.labelInputWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="bookmark" size={18} color={colors.mutedForeground} />
            <TextInput
              autoFocus
              value={customLabel}
              onChangeText={setCustomLabel}
              style={[styles.searchInput, { color: colors.foreground }]}
              placeholder="Place name"
              placeholderTextColor={colors.mutedForeground}
              returnKeyType="next"
              accessibilityLabel="Place name"
              onSubmitEditing={() => inputRef.current?.focus()}
            />
          </View>
        ) : null}
        <View style={[styles.searchInputWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="search" size={18} color={colors.mutedForeground} />
          <TextInput
            ref={inputRef}
            autoFocus={label !== 'Other'}
            value={search.text}
            onChangeText={search.handleTextChange}
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder={`Search ${label.toLowerCase()} address`}
            placeholderTextColor={colors.mutedForeground}
            returnKeyType="search"
          />
          {search.loading ? (
            <View style={styles.searchClear}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : null}
          {!search.loading && search.text.length > 0 ? (
            <TouchableOpacity
              style={[styles.searchClear, { backgroundColor: colors.muted, borderColor: colors.border }]}
              onPress={search.clearText}
              accessibilityLabel="Clear address search"
            >
              <Feather name="x" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          ) : null}
        </View>

        <TouchableOpacity style={styles.mapOption} onPress={openMap} activeOpacity={0.65}>
          <View style={[styles.mapOptionIcon, { backgroundColor: colors.muted }]}>
            <MaterialCommunityIcons name="map-marker-radius-outline" size={22} color={colors.foreground} />
          </View>
          <Text style={[styles.mapOptionText, { color: colors.foreground }]}>Set location on map</Text>
        </TouchableOpacity>

        <GlassScrollView
          style={styles.results}
          indicatorTop={8}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        >
          {hasQuery ? (
            <TouchableOpacity
              style={[styles.resultRow, { borderBottomColor: colors.border }]}
              onPress={() => savePlace(search.buildTypedLocation())}
            >
              <Feather name="edit-3" size={17} color={colors.foreground} />
              <View style={styles.resultCopy}>
                <Text style={[styles.resultTitle, { color: colors.foreground }]} numberOfLines={1}>
                  Use "{search.text.trim()}"
                </Text>
                <Text style={[styles.resultSubtitle, { color: colors.mutedForeground }]}>Save the typed address</Text>
              </View>
            </TouchableOpacity>
          ) : null}

          {search.suggestions.map(suggestion => (
            <TouchableOpacity
              key={suggestion.id}
              style={[styles.resultRow, { borderBottomColor: colors.border }]}
              onPress={() => savePlace({
                ...suggestion.coords,
                address: suggestion.place_name,
                locationType: 'precise',
              })}
            >
              <MaterialCommunityIcons name="map-marker-outline" size={19} color={colors.foreground} />
              <View style={styles.resultCopy}>
                <Text style={[styles.resultTitle, { color: colors.foreground }]} numberOfLines={1}>{suggestion.title}</Text>
                <Text style={[styles.resultSubtitle, { color: colors.mutedForeground }]} numberOfLines={2}>
                  {suggestion.subtitle ?? suggestion.place_name}
                </Text>
              </View>
            </TouchableOpacity>
          ))}

          {hasQuery && !search.loading && search.suggestions.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              No matches yet. Try a full place name, street address, or set the location on the map.
            </Text>
          ) : null}
        </GlassScrollView>
      </View>
    </View>
  );
}

function normalizeLabel(value?: string): SavedPlaceLabel {
  if (value === 'Work' || value === 'School' || value === 'Other') return value;
  return 'Home';
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  searchBody: { flex: 1, paddingHorizontal: 16 },
  searchInputWrap: {
    height: 52,
    borderRadius: buttonCornerRadius(52),
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
  },
  labelInputWrap: {
    height: 52,
    borderRadius: buttonCornerRadius(52),
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  searchInput: { flex: 1, fontSize: 16, fontFamily: 'Inter_500Medium' },
  searchClear: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapOption: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 18 },
  mapOptionIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  mapOptionText: { flex: 1, fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  results: { flex: 1 },
  resultRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth },
  resultCopy: { flex: 1, gap: 3 },
  resultTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  resultSubtitle: { fontSize: 11, fontFamily: 'Inter_400Regular', lineHeight: 16 },
  emptyText: { paddingVertical: 22, fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 18 },
});
