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
import { FORM_BOTTOM_PADDING } from '@/constants/tabBar';
import { useSavedLocations } from '@/context/SavedLocationsContext';
import { useColors } from '@/hooks/useColors';
import { useLocationSearch } from '@/hooks/home/useLocationSearch';
import { KIGALI_CENTER, type RideLocation, type SavedLocation } from '@/types';
import { formatReverseGeocodeAddress } from '@/utils/locationUtils';

type SavedPlaceLabel = 'Home' | 'Work' | 'School' | 'Church' | 'Other';
const MAP_TYPES = ['standard', 'satellite', 'hybrid'] as const;
type AppMapType = typeof MAP_TYPES[number];
const MAP_LOCATION_DELTA = 0.012;

export default function SavedPlaceSelectorScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const headerMetrics = useGlassHeaderMetrics();

  const {
    mode = 'add',
    label: rawLabel,
    savedPlaceId,
    initialAddress,
    initialLatitude,
    initialLongitude,
  } = useLocalSearchParams<{
    mode?: 'add' | 'edit';
    label?: string;
    savedPlaceId?: string;
    initialAddress?: string;
    initialLatitude?: string;
    initialLongitude?: string;
  }>();

  const { savedPlaces, persistSavedPlaces } = useSavedLocations();

  const existing = useMemo(() => {
    if (mode === 'edit' && savedPlaceId) {
      return savedPlaces.find(place => place.id === savedPlaceId);
    }
    if (mode === 'add' && rawLabel && rawLabel !== 'Other') {
      return savedPlaces.find(place => place.label.toLowerCase() === rawLabel.toLowerCase());
    }
    return undefined;
  }, [mode, savedPlaceId, rawLabel, savedPlaces]);

  const label = useMemo(() => {
    if (mode === 'edit' && existing) {
      return existing.label;
    }
    return rawLabel || 'Home';
  }, [mode, existing, rawLabel]);

  const displayLabel = useMemo(() => {
    return normalizeLabel(label);
  }, [label]);

  const initialCoords = useMemo(() => {
    if (initialLatitude && initialLongitude) {
      const lat = parseFloat(initialLatitude);
      const lng = parseFloat(initialLongitude);
      if (!isNaN(lat) && !isNaN(lng)) {
        return { latitude: lat, longitude: lng };
      }
    }
    if (existing) {
      return { latitude: existing.latitude, longitude: existing.longitude };
    }
    return KIGALI_CENTER;
  }, [initialLatitude, initialLongitude, existing]);

  const initialAddressStr = useMemo(() => {
    if (initialAddress) {
      return initialAddress;
    }
    if (existing) {
      return existing.address ?? '';
    }
    return '';
  }, [initialAddress, existing]);

  const [uiMode, setUiMode] = useState<'search' | 'map'>('search');
  const [mapCoords, setMapCoords] = useState(initialCoords);
  const [mapAddress, setMapAddress] = useState(initialAddressStr);
  const [isDragging, setIsDragging] = useState(false);
  const [mapType, setMapType] = useState<AppMapType>('standard');

  const [customLabel, setCustomLabel] = useState(() => {
    if (displayLabel === 'Other') {
      return label;
    }
    return '';
  });

  const mapRef = useRef<MapView>(null);
  const inputRef = useRef<TextInput>(null);
  const search = useLocationSearch(initialCoords);

  useEffect(() => {
    if (initialCoords && initialCoords !== KIGALI_CENTER) {
      setMapCoords(initialCoords);
    }
  }, [initialCoords]);

  useEffect(() => {
    if (initialAddressStr) {
      setMapAddress(initialAddressStr);
      search.setText(initialAddressStr);
    }
  }, [initialAddressStr, search.setText]);

  useEffect(() => {
    if (displayLabel === 'Other' && label && label !== 'Other') {
      setCustomLabel(label);
    }
  }, [displayLabel, label]);

  const savePlace = async (place: RideLocation) => {
    const finalLabel = displayLabel === 'Other' ? customLabel.trim() : label;
    if (!finalLabel) {
      Alert.alert('Name this place', 'Enter a label before saving this location.');
      return;
    }
    const saved: SavedLocation = {
      ...place,
      id: (mode === 'edit' && existing) ? existing.id : `settings-${finalLabel.toLowerCase()}-${Date.now()}`,
      label: finalLabel,
    };
    const next = [
      saved,
      ...savedPlaces.filter(item => {
        const isCurrentItem = (mode === 'edit' && existing) ? item.id === existing.id : false;
        const isSameLabel = item.label.toLowerCase() === finalLabel.toLowerCase();
        const isSameId = item.id === saved.id;
        return !isCurrentItem && !isSameLabel && !isSameId;
      }),
    ];
    await persistSavedPlaces(next);
    router.back();
  };

  const deletePlace = () => {
    if (!existing) return;
    Alert.alert(
      `Delete "${existing.label}"?`,
      'This saved place will be removed from your list. This cannot be undone.',
      [
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const next = savedPlaces.filter(place => place.id !== existing.id);
            await persistSavedPlaces(next);
            router.back();
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  };

  const openMap = async () => {
    let coords: { latitude: number; longitude: number } = initialCoords;
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
    } catch {}
    setMapCoords(coords);
    setMapAddress(initialAddressStr);
    setUiMode('map');
    Keyboard.dismiss();
    requestAnimationFrame(() => {
      mapRef.current?.animateToRegion(
        { ...coords, latitudeDelta: MAP_LOCATION_DELTA, longitudeDelta: MAP_LOCATION_DELTA },
        300,
      );
    });
  };

  const syncMapAddress = async (coords: typeof KIGALI_CENTER) => {
    const [geo] = await Location.reverseGeocodeAsync(coords).catch(() => [null]);
    setMapAddress(formatReverseGeocodeAddress(geo, 'Selected location'));
  };

  if (uiMode === 'map') {
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
          onClose={() => setUiMode('search')}
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
      <GlassHeader
        title={displayLabel === 'Other' ? (mode === 'edit' ? 'Edit Place' : 'Add Place') : `${mode === 'edit' ? 'Edit' : 'Add'} ${label}`}
      />
      <View style={[styles.searchBody, { paddingTop: headerMetrics.contentTop - 4 }]}>
        {displayLabel === 'Other' ? (
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
            autoFocus={displayLabel !== 'Other'}
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
          contentContainerStyle={{ paddingBottom: insets.bottom + FORM_BOTTOM_PADDING }}
        >
          {hasQuery ? (
            <TouchableOpacity
              style={[styles.resultRow, { borderBottomColor: colors.border }]}
              onPress={() => savePlace(search.buildTypedLocation())}
            >
              <Feather name="edit-2" size={17} color={colors.foreground} />
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

          {mode === 'edit' && existing ? (
            <TouchableOpacity
              style={[styles.deleteButton, { borderColor: colors.border }]}
              onPress={deletePlace}
              activeOpacity={0.7}
            >
              <Feather name="trash-2" size={16} color={colors.destructive} />
              <Text style={[styles.deleteButtonText, { color: colors.destructive }]}>
                Delete Saved Place
              </Text>
            </TouchableOpacity>
          ) : null}
        </GlassScrollView>
      </View>
    </View>
  );
}

function normalizeLabel(value?: string): SavedPlaceLabel {
  if (value === 'Home' || value === 'Work' || value === 'School' || value === 'Church' || value === 'Other') return value;
  if (value && value.trim().length > 0) return 'Other';
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
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: buttonCornerRadius(50),
    borderWidth: 1,
    marginTop: 20,
    marginHorizontal: 16,
  },
  deleteButtonText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
});
