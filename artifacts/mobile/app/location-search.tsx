import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Alert, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMapPicker } from '@/context/MapPickerContext';
import { useColors } from '@/hooks/useColors';
import { useRide } from '@/context/RideContext';
import { useSavedLocations } from '@/hooks/useSavedLocations';
import { useToast } from '@/context/ToastContext';
import { useLocationSearch } from '@/hooks/home/useLocationSearch';
import { AreaRefineRow } from '@/components/home/AreaRefineRow';
import { LocationSearchOverlay } from '@/components/home/LocationSearchOverlay';
import type { RecentPlace } from '@/components/home/SavedLocationsSection';
import {
  useDeleteRecentLocationMutation,
  useLandmarksQuery,
  useLocationSuggestionsQuery,
  useRecentLocationsQuery,
  useRecordRecentLocationMutation,
} from '@/query/hooks';
import { adminUnitSearchText, filterLandmarks, landmarkToSuggestion, type AdminUnit } from '@/services/locations';
import type { GeocodeSuggestion } from '@/services/geocoding';
import type { RideLocation } from '@/types';

/** How many previous destinations the "Previous rides" tab shows. */
const MAX_RECENT_DESTINATIONS = 8;

function addressKey(location: { address?: string; latitude: number; longitude: number }) {
  return location.address?.trim().toLowerCase()
    || `${location.latitude.toFixed(4)},${location.longitude.toFixed(4)}`;
}

export default function LocationSearchScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { showToast } = useToast();
  const { consumeSelection } = useMapPicker();

  const {
    pickup,
    setPickup,
    destination,
    setDestination,
    destText,
    setDestText,
    rideHistory,
  } = useRide();

  const {
    savedPlaces,
    reload: reloadSavedPlaces,
    persistSavedPlaces,
  } = useSavedLocations();

  useFocusEffect(
    useCallback(() => {
      void reloadSavedPlaces();
      const timer = setTimeout(() => {
        locationSearchInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }, [reloadSavedPlaces])
  );

  useFocusEffect(
    useCallback(() => {
      const selection = consumeSelection();
      if (!selection || selection.flow !== 'booking') return undefined;
      router.back();
      return undefined;
    }, [consumeSelection]),
  );

  const {
    target: paramTarget,
    userLatitude,
    userLongitude,
    gpsLatitude,
    gpsLongitude,
    gpsAddress,
  } = useLocalSearchParams<{
    target: 'pickup' | 'dropoff';
    userLatitude: string;
    userLongitude: string;
    gpsLatitude?: string;
    gpsLongitude?: string;
    gpsAddress?: string;
  }>();

  const target = paramTarget || 'pickup';

  const userLocation = useMemo<RideLocation>(() => ({
    latitude: parseFloat(userLatitude || '-1.9441'),
    longitude: parseFloat(userLongitude || '30.0619'),
    address: 'Kigali',
    locationType: 'generic',
  }), [userLatitude, userLongitude]);

  const gpsLocation = useMemo<RideLocation | null>(() => {
    if (!gpsLatitude || !gpsLongitude) return null;
    return {
      latitude: parseFloat(gpsLatitude),
      longitude: parseFloat(gpsLongitude),
      address: gpsAddress || '',
      locationType: 'precise',
    };
  }, [gpsLatitude, gpsLongitude, gpsAddress]);

  const locationSearch = useLocationSearch(userLocation);

  const {
    buildTypedLocation,
    clearText: clearLocationSearchText,
    handleTextChange: handleLocationSearchText,
    listTab: locationListTab,
    loading: locationSearchLoading,
    setListTab: setLocationListTab,
    suggestions,
    text: locationSearchText,
  } = locationSearch;

  const locationSearchInputRef = useRef<TextInput>(null);

  // Initialize search input text and target on mount or target change
  useEffect(() => {
    const initialText = target === 'pickup' ? pickup.address ?? '' : destText;
    locationSearch.open(target, initialText);
  }, [target]);

  // Server-backed place data. Suggestions carry the rider's saved places,
  // recents and the landmark list in one authenticated call; the public
  // landmarks endpoint covers the signed-out / failed-call case.
  const suggestionsQuery = useLocationSuggestionsQuery();
  const landmarksQuery = useLandmarksQuery({ enabled: !suggestionsQuery.data });
  const recentsQuery = useRecentLocationsQuery();
  const recordRecent = useRecordRecentLocationMutation();
  const forgetRecent = useDeleteRecentLocationMutation();

  const landmarks = useMemo(
    () => suggestionsQuery.data?.landmarks ?? landmarksQuery.data ?? [],
    [landmarksQuery.data, suggestionsQuery.data],
  );

  const applyLocation = useCallback((targetField: 'pickup' | 'dropoff', location: RideLocation) => {
    if (targetField === 'pickup') {
      setPickup(location);
    } else {
      setDestText(location.address ?? '');
      setDestination(location);
      // Best-effort: the destination outlives this install once the server has
      // it, but a failure here must never get in the way of booking.
      const address = location.address?.trim();
      if (address) {
        recordRecent.mutate({
          address,
          latitude: location.latitude,
          longitude: location.longitude,
        });
      }
    }
    router.back();
  }, [recordRecent, setPickup, setDestination, setDestText]);

  const handleForgetRecent = useCallback((location: RecentPlace) => {
    const recentId = location.recentId;
    // Only server-owned recents can be forgotten; ride-history entries have no id.
    if (!recentId) return;
    Alert.alert(
      'Remove from recents?',
      location.address ?? 'This destination will stop appearing in your recent list.',
      [
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            forgetRecent.mutate(recentId, {
              onError: () => showToast('Could not remove that destination', 'error'),
            });
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  }, [forgetRecent, showToast]);

  const handleSelectArea = useCallback((unit: AdminUnit) => {
    handleLocationSearchText(adminUnitSearchText(unit));
  }, [handleLocationSearchText]);

  const handleClose = useCallback(() => {
    router.back();
  }, []);

  const openSavedPlaceSelector = useCallback(() => {
    Alert.alert('Add saved place', 'Choose the place you want to save.', [
      {
        text: 'Home',
        onPress: () => {
          router.push({ pathname: '/saved-place-selector', params: { mode: 'add', label: 'Home' } });
        }
      },
      {
        text: 'Work',
        onPress: () => {
          router.push({ pathname: '/saved-place-selector', params: { mode: 'add', label: 'Work' } });
        }
      },
      {
        text: 'School',
        onPress: () => {
          router.push({ pathname: '/saved-place-selector', params: { mode: 'add', label: 'School' } });
        }
      },
      {
        text: 'Church',
        onPress: () => {
          router.push({ pathname: '/saved-place-selector', params: { mode: 'add', label: 'Church' } });
        }
      },
      {
        text: 'Other',
        onPress: () => {
          router.push({ pathname: '/saved-place-selector', params: { mode: 'add', label: 'Other' } });
        }
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, []);

  const showSavedLocationActions = useCallback((location: any) => {
    Alert.alert(location.label, location.address ?? '', [
      {
        text: 'Edit',
        onPress: () => {
          router.push({
            pathname: '/saved-place-selector',
            params: { mode: 'edit', savedPlaceId: location.id },
          });
        },
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          Alert.alert(
            `Delete "${location.label}"?`,
            'This saved place will be removed from your list. This cannot be undone.',
            [
              {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                  const next = savedPlaces.filter(place => place.id !== location.id);
                  await persistSavedPlaces(next);
                  showToast('Location removed', 'error');
                },
              },
              { text: 'Cancel', style: 'cancel' },
            ]
          );
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [savedPlaces, persistSavedPlaces, showToast]);

  const handleSaveCandidate = useCallback((location: RideLocation) => {
    router.push({
      pathname: '/saved-place-selector',
      params: {
        mode: 'add',
        label: 'Other',
        initialAddress: location.address || '',
        initialLatitude: location.latitude.toString(),
        initialLongitude: location.longitude.toString(),
      },
    });
  }, []);

  const handleChooseOnMap = useCallback(() => {
    const baseLocation = target === 'dropoff'
      ? (destination ?? gpsLocation ?? userLocation)
      : (pickup.locationType !== 'generic' ? pickup : (gpsLocation ?? userLocation));
    router.push({
      pathname: '/map-picker',
      params: {
        target,
        mode: 'booking',
        initialLatitude: baseLocation.latitude.toString(),
        initialLongitude: baseLocation.longitude.toString(),
        initialAddress: baseLocation.address ?? '',
      },
    });
  }, [destination, gpsLocation, pickup, target, userLocation]);

  const savedLocations = useMemo(() => savedPlaces, [savedPlaces]);

  // On-device ride history — what the app had before the server owned recents.
  // Kept as the offline fallback rather than replaced.
  const localRecentLocations = useMemo<RecentPlace[]>(
    () => rideHistory.flatMap(ride => [ride.pickup, ride.destination]),
    [rideHistory],
  );

  const recentLocations = useMemo<RecentPlace[]>(() => {
    const serverRecents = recentsQuery.data ?? suggestionsQuery.data?.recentLocations ?? [];
    const rideDerived = suggestionsQuery.data?.recentDestinations ?? [];
    const merged: RecentPlace[] = [
      ...serverRecents.map(recent => ({
        latitude: recent.latitude,
        longitude: recent.longitude,
        address: recent.address,
        locationType: 'precise' as const,
        recentId: recent.id,
      })),
      ...rideDerived.map(destination => ({
        latitude: destination.latitude,
        longitude: destination.longitude,
        address: destination.address,
        locationType: 'precise' as const,
      })),
      ...localRecentLocations,
    ];

    const seen = new Set<string>();
    return merged
      .filter(location => {
        const key = addressKey(location);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, MAX_RECENT_DESTINATIONS);
  }, [localRecentLocations, recentsQuery.data, suggestionsQuery.data]);

  // Curated landmarks answer first — they are free, instant and available with
  // no network — then the Mapbox/OSM hits fill in whatever they missed.
  const mergedSuggestions = useMemo<GeocodeSuggestion[]>(() => {
    const landmarkHits = filterLandmarks(landmarks, locationSearchText).map(landmarkToSuggestion);
    if (landmarkHits.length === 0) return suggestions;
    const seen = new Set(landmarkHits.map(hit => hit.title.trim().toLowerCase()));
    return [
      ...landmarkHits,
      ...suggestions.filter(suggestion => !seen.has(suggestion.title.trim().toLowerCase())),
    ];
  }, [landmarks, locationSearchText, suggestions]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LocationSearchOverlay
        bottomInset={insets.bottom}
        buildTypedLocation={buildTypedLocation}
        colors={colors}
        inputRef={locationSearchInputRef}
        listTab={locationListTab}
        loading={locationSearchLoading}
        onApplyLocation={applyLocation}
        onAddSavedLocation={openSavedPlaceSelector}
        onChooseMap={handleChooseOnMap}
        onClear={clearLocationSearchText}
        onClose={handleClose}
        onForgetRecent={handleForgetRecent}
        onSaveCandidate={handleSaveCandidate}
        onSetListTab={setLocationListTab}
        onShowSavedLocationActions={showSavedLocationActions}
        onTextChange={handleLocationSearchText}
        recentLocations={recentLocations}
        resultsHeader={(
          <AreaRefineRow
            colors={colors}
            query={locationSearchText}
            onSelectArea={handleSelectArea}
          />
        )}
        savedLocations={savedLocations}
        suggestions={mergedSuggestions}
        target={target}
        text={locationSearchText}
        userLocation={userLocation}
        gpsLocation={gpsLocation}
      />
    </View>
  );
}
