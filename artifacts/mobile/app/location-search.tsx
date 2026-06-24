import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Alert, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useRide } from '@/context/RideContext';
import { useSavedLocations } from '@/hooks/useSavedLocations';
import { useToast } from '@/context/ToastContext';
import { useLocationSearch } from '@/hooks/home/useLocationSearch';
import { LocationSearchOverlay } from '@/components/home/LocationSearchOverlay';
import type { RideLocation } from '@/types';

export default function LocationSearchScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { showToast } = useToast();

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

  const applyLocation = useCallback((targetField: 'pickup' | 'dropoff', location: RideLocation) => {
    if (targetField === 'pickup') {
      setPickup(location);
    } else {
      setDestText(location.address ?? '');
      setDestination(location);
    }
    router.back();
  }, [setPickup, setDestination, setDestText]);

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
    router.replace({
      pathname: '/(tabs)',
      params: {
        triggerMapPicker: target,
        mapPickerLat: gpsLatitude || userLatitude,
        mapPickerLng: gpsLongitude || userLongitude,
      },
    });
  }, [target, gpsLatitude, userLatitude, gpsLongitude, userLongitude]);

  const savedLocations = useMemo(() => savedPlaces, [savedPlaces]);

  const recentLocations = useMemo<RideLocation[]>(() => {
    const seen = new Set<string>();
    return rideHistory
      .flatMap(ride => [ride.pickup, ride.destination])
      .filter(location => {
        const key = location.address ?? `${location.latitude},${location.longitude}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 5);
  }, [rideHistory]);

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
        onSaveCandidate={handleSaveCandidate}
        onSetListTab={setLocationListTab}
        onShowSavedLocationActions={showSavedLocationActions}
        onTextChange={handleLocationSearchText}
        recentLocations={recentLocations}
        savedLocations={savedLocations}
        suggestions={suggestions}
        target={target}
        text={locationSearchText}
        userLocation={userLocation}
        gpsLocation={gpsLocation}
      />
    </View>
  );
}
