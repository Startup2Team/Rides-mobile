import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import type { RideLocation } from '@/types';
import { KIGALI_CENTER } from '@/types';
import {
  acquireBestHomeLocation,
  requestHomeLocationPermission,
} from '@/services/homeLocationAcquisition';
import {
  isLatestLocationRequest,
  selectCurrentLocationAddress,
} from '@/utils/locationUtils';

const CURRENT_LOCATION_FALLBACK = 'Current location';
export type HomeLocationStatus = 'loading' | 'available' | 'unavailable';

function logLocationSession(
  coords: Location.LocationObjectCoords,
  geo: Location.LocationGeocodedAddress | null | undefined,
  selectedAddress: string,
) {
  if (!__DEV__) return;
  console.debug('[home-location] reverse geocode', {
    latitude: coords.latitude,
    longitude: coords.longitude,
    accuracy: coords.accuracy,
    reverseGeocodedStreet: geo?.street ?? null,
    reverseGeocodedName: geo?.name ?? null,
    selectedAddress,
    provider: 'expo-location',
    source: 'Location.reverseGeocodeAsync',
  });
}

export function useHomeLocation({
  applyInitialPickup,
  preserveInitialPickup,
}: {
  applyInitialPickup: (location: RideLocation) => void;
  preserveInitialPickup: () => boolean;
}) {
  const [userLocation, setUserLocation] = useState(KIGALI_CENTER);
  const [gpsLocation, setGpsLocation] = useState<RideLocation | null>(null);
  const [currentLocationAddress, setCurrentLocationAddress] = useState('');
  const [locationStatus, setLocationStatus] = useState<HomeLocationStatus>('loading');
  const [locationError, setLocationError] = useState<unknown>(null);
  const locationRequestRef = useRef(0);
  const gpsLocationRef = useRef<RideLocation | null>(null);
  gpsLocationRef.current = gpsLocation;

  const cancelHereLocationRefresh = useCallback(() => {
    locationRequestRef.current += 1;
  }, []);

  const acquireLocation = useCallback((requestId: number) => {
    return acquireBestHomeLocation({
      getCurrentPosition: () =>
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      isActive: () => isLatestLocationRequest(requestId, locationRequestRef.current),
    });
  }, []);

  const applyCoords = useCallback((coords: typeof KIGALI_CENTER) => {
    setUserLocation(coords);
    setCurrentLocationAddress(CURRENT_LOCATION_FALLBACK);
    setGpsLocation({ ...coords, address: CURRENT_LOCATION_FALLBACK, locationType: 'precise' });
    setLocationStatus('available');
  }, []);

  const applyHereFromCoords = useCallback(
    (
      coords: typeof KIGALI_CENTER,
      accuracy: number | null | undefined,
      geo?: Location.LocationGeocodedAddress | null,
    ) => {
      applyCoords(coords);
      const address = selectCurrentLocationAddress(geo, accuracy, CURRENT_LOCATION_FALLBACK);
      setCurrentLocationAddress(address);
      setGpsLocation({ ...coords, address, locationType: 'precise' });
      setLocationStatus('available');
    },
    [applyCoords],
  );

  const refreshHereLocation = useCallback(async () => {
    const requestId = ++locationRequestRef.current;
    if (!gpsLocationRef.current) setLocationStatus('loading');
    try {
      const granted = await requestHomeLocationPermission({
        getPermission: Location.getForegroundPermissionsAsync,
        requestPermission: Location.requestForegroundPermissionsAsync,
      });
      if (!granted) {
        if (!gpsLocationRef.current) setLocationStatus('unavailable');
        return;
      }

      const loc = await acquireLocation(requestId);
      if (!loc) {
        if (isLatestLocationRequest(requestId, locationRequestRef.current) && !gpsLocationRef.current) {
          setLocationStatus('unavailable');
        }
        return;
      }
      const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      if (!isLatestLocationRequest(requestId, locationRequestRef.current)) return;
      applyCoords(coords);

      const [geo] = await Location.reverseGeocodeAsync(coords).catch(() => [null]);
      if (!isLatestLocationRequest(requestId, locationRequestRef.current)) return;
      const selectedAddress = selectCurrentLocationAddress(
        geo,
        loc.coords.accuracy,
        CURRENT_LOCATION_FALLBACK,
      );
      logLocationSession(loc.coords, geo, selectedAddress);
      applyHereFromCoords(coords, loc.coords.accuracy, geo);
      setLocationError(null);
    } catch (error) {
      if (!isLatestLocationRequest(requestId, locationRequestRef.current)) return;
      setLocationError(error);
      if (!gpsLocationRef.current) setLocationStatus('unavailable');
    }
  }, [acquireLocation, applyCoords, applyHereFromCoords]);

  useEffect(() => {
    let mounted = true;

    const updateInitialPickup = (
      coords: typeof KIGALI_CENTER,
      accuracy: number | null | undefined,
      geo?: Location.LocationGeocodedAddress | null,
    ) => {
      if (preserveInitialPickup()) return;
      applyInitialPickup({
        ...coords,
        address: selectCurrentLocationAddress(geo, accuracy, CURRENT_LOCATION_FALLBACK),
        locationType: 'precise',
      });
    };

    const resolveLocation = async () => {
      const requestId = ++locationRequestRef.current;
      const granted = await requestHomeLocationPermission({
        getPermission: Location.getForegroundPermissionsAsync,
        requestPermission: Location.requestForegroundPermissionsAsync,
      });
      if (!granted) return false;

      const loc = await acquireLocation(requestId);
      if (!loc) return false;
      const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      if (!mounted || !isLatestLocationRequest(requestId, locationRequestRef.current)) return true;
      applyCoords(coords);

      const [geo] = await Location.reverseGeocodeAsync(loc.coords).catch(() => [null]);
      if (!mounted || !isLatestLocationRequest(requestId, locationRequestRef.current)) return true;

      const selectedAddress = selectCurrentLocationAddress(
        geo,
        loc.coords.accuracy,
        CURRENT_LOCATION_FALLBACK,
      );
      logLocationSession(loc.coords, geo, selectedAddress);
      applyHereFromCoords(coords, loc.coords.accuracy, geo);
      updateInitialPickup(coords, loc.coords.accuracy, geo);
      return true;
    };

    const requestNotificationPermission = async () => {
      const permission = await Notifications.getPermissionsAsync();
      if (permission.granted || !permission.canAskAgain) return;
      await Notifications.requestPermissionsAsync();
    };

    (async () => {
      try {
        if (Platform.OS === 'web') {
          navigator.geolocation?.getCurrentPosition(
            async position => {
              const coords = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
              };
              const accuracy = position.coords.accuracy;
              if (!mounted) return;
              try {
                const [geo] = await Location.reverseGeocodeAsync(coords);
                if (!mounted) return;
                const selectedAddress = selectCurrentLocationAddress(
                  geo,
                  accuracy,
                  CURRENT_LOCATION_FALLBACK,
                );
                if (__DEV__) {
                  console.debug('[home-location] reverse geocode', {
                    latitude: coords.latitude,
                    longitude: coords.longitude,
                    accuracy,
                    reverseGeocodedStreet: geo?.street ?? null,
                    reverseGeocodedName: geo?.name ?? null,
                    selectedAddress,
                    provider: 'expo-location',
                    source: 'Location.reverseGeocodeAsync',
                  });
                }
                applyHereFromCoords(coords, accuracy, geo);
                updateInitialPickup(coords, accuracy, geo);
              } catch (error) {
                if (!mounted) return;
                setLocationError(error);
                applyHereFromCoords(coords, accuracy, null);
                if (!preserveInitialPickup()) {
                  applyInitialPickup({
                    ...coords,
                    address: CURRENT_LOCATION_FALLBACK,
                    locationType: 'precise',
                  });
                }
              }
              setLocationStatus('available');
            },
            error => {
              if (!mounted) return;
              setLocationError(error);
              setLocationStatus('unavailable');
            },
          );
        } else {
          const resolved = await resolveLocation();
          await requestNotificationPermission();
          if (mounted && !resolved) setLocationStatus('unavailable');
        }
      } catch (error) {
        if (mounted) {
          setLocationError(error);
          setLocationStatus('unavailable');
        }
      }
    })();

    return () => {
      mounted = false;
      locationRequestRef.current += 1;
    };
  }, [acquireLocation, applyCoords, applyHereFromCoords, applyInitialPickup, preserveInitialPickup]);

  return {
    cancelHereLocationRefresh,
    currentLocationAddress,
    gpsLocation,
    locLoading: locationStatus === 'loading',
    locationError,
    locationStatus,
    refreshHereLocation,
    userLocation,
  };
}
