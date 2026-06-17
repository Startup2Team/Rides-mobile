import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import type { RideLocation } from '@/types';
import { KIGALI_CENTER } from '@/types';
import {
  acquireBestHomeLocation,
  requestHomeLocationPermission,
  startHomeLocationWatch,
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
  const locationWatchRef = useRef<(() => void) | null>(null);
  const locationWatchRequestRef = useRef(0);
  const watchReverseGeocodeRef = useRef(0);
  const gpsLocationRef = useRef<RideLocation | null>(null);
  gpsLocationRef.current = gpsLocation;

  const stopHereLocationWatch = useCallback(() => {
    locationWatchRequestRef.current += 1;
    watchReverseGeocodeRef.current += 1;
    locationWatchRef.current?.();
    locationWatchRef.current = null;
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

  const startHereLocationWatch = useCallback(async () => {
    if (Platform.OS === 'web') return;

    stopHereLocationWatch();
    const watchRequestId = locationWatchRequestRef.current;
    try {
      const granted = await requestHomeLocationPermission({
        getPermission: Location.getForegroundPermissionsAsync,
        requestPermission: Location.requestForegroundPermissionsAsync,
      });
      if (!granted || watchRequestId !== locationWatchRequestRef.current) return;

      const stop = await startHomeLocationWatch({
        isActive: () => watchRequestId === locationWatchRequestRef.current,
        watchPosition: callback =>
          Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.High,
              distanceInterval: 5,
              timeInterval: 3_000,
            },
            callback,
          ),
        onLocation: loc => {
          const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
          applyCoords(coords);
          setLocationError(null);

          const geocodeRequestId = ++watchReverseGeocodeRef.current;
          void Location.reverseGeocodeAsync(coords)
            .then(([geo]) => {
              if (
                watchRequestId !== locationWatchRequestRef.current
                || geocodeRequestId !== watchReverseGeocodeRef.current
              ) {
                return;
              }
              const selectedAddress = selectCurrentLocationAddress(
                geo,
                loc.coords.accuracy,
                CURRENT_LOCATION_FALLBACK,
              );
              logLocationSession(loc.coords, geo, selectedAddress);
              applyHereFromCoords(coords, loc.coords.accuracy, geo);
            })
            .catch(() => {
              // Keep the GPS pin update and neutral address when reverse geocoding fails.
            });
        },
      });

      if (watchRequestId !== locationWatchRequestRef.current) {
        stop();
        return;
      }
      locationWatchRef.current = stop;
    } catch (error) {
      if (watchRequestId === locationWatchRequestRef.current) setLocationError(error);
    }
  }, [applyCoords, applyHereFromCoords, stopHereLocationWatch]);

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

    // Safety net: never trap the user on "Finding your pickup point". If GPS
    // hasn't resolved within this window, drop the full-screen loader and render
    // the map on the current (fallback) location; resolveLocation and the live
    // watch keep running and refine the pickup pin the moment a fix arrives.
    const fallbackTimer = setTimeout(() => {
      if (mounted) {
        setLocationStatus(previous => (previous === 'loading' ? 'available' : previous));
      }
    }, 4_500);

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
      clearTimeout(fallbackTimer);
      locationRequestRef.current += 1;
      stopHereLocationWatch();
    };
  }, [
    acquireLocation,
    applyCoords,
    applyHereFromCoords,
    applyInitialPickup,
    preserveInitialPickup,
    stopHereLocationWatch,
  ]);

  return {
    currentLocationAddress,
    gpsLocation,
    locLoading: locationStatus === 'loading',
    locationError,
    locationStatus,
    refreshHereLocation,
    startHereLocationWatch,
    stopHereLocationWatch,
    userLocation,
  };
}
