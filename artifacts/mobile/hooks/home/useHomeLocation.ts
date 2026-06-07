import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import type { RideLocation } from '@/types';
import { KIGALI_CENTER } from '@/types';
import { formatReverseGeocodeAddress } from '@/utils/locationUtils';

export function useHomeLocation({
  applyInitialPickup,
  preserveInitialPickup,
}: {
  applyInitialPickup: (location: RideLocation) => void;
  preserveInitialPickup: () => boolean;
}) {
  const [userLocation, setUserLocation] = useState(KIGALI_CENTER);
  const [currentLocationAddress, setCurrentLocationAddress] = useState('');
  const [locLoading, setLocLoading] = useState(true);
  const [locationError, setLocationError] = useState<unknown>(null);

  const applyHereFromCoords = useCallback(
    (coords: typeof KIGALI_CENTER, geo?: Location.LocationGeocodedAddress | null) => {
      setUserLocation(coords);
      setCurrentLocationAddress(formatReverseGeocodeAddress(geo, ''));
    },
    [],
  );

  const refreshHereLocation = useCallback(async () => {
    try {
      const permission = await Location.getForegroundPermissionsAsync();
      const granted = permission.granted
        || (permission.canAskAgain && (await Location.requestForegroundPermissionsAsync()).granted);
      if (!granted) return;

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      const [geo] = await Location.reverseGeocodeAsync(coords).catch(() => [null]);
      applyHereFromCoords(coords, geo);
      setLocationError(null);
    } catch (error) {
      setLocationError(error);
    }
  }, [applyHereFromCoords]);

  useEffect(() => {
    let mounted = true;

    const updateInitialPickup = (
      coords: typeof KIGALI_CENTER,
      geo?: Location.LocationGeocodedAddress | null,
    ) => {
      if (preserveInitialPickup()) return;
      applyInitialPickup({
        ...coords,
        address: formatReverseGeocodeAddress(geo, ''),
        locationType: 'precise',
      });
    };

    const resolveLocation = async () => {
      const permission = await Location.getForegroundPermissionsAsync();
      const finalPermission = permission.granted
        ? permission
        : permission.canAskAgain
          ? await Location.requestForegroundPermissionsAsync()
          : permission;

      if (!finalPermission.granted) return false;

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      const [geo] = await Location.reverseGeocodeAsync(loc.coords).catch(() => [null]);
      if (!mounted) return true;

      applyHereFromCoords(coords, geo);
      updateInitialPickup(coords, geo);
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
              if (!mounted) return;
              try {
                const [geo] = await Location.reverseGeocodeAsync(coords);
                if (!mounted) return;
                applyHereFromCoords(coords, geo);
                updateInitialPickup(coords, geo);
              } catch (error) {
                if (!mounted) return;
                setLocationError(error);
                applyHereFromCoords(coords, null);
                if (!preserveInitialPickup()) {
                  applyInitialPickup({ ...coords, locationType: 'precise' });
                }
              }
              setLocLoading(false);
            },
            error => {
              if (!mounted) return;
              setLocationError(error);
              setLocLoading(false);
            },
          );
        } else {
          await resolveLocation();
          await requestNotificationPermission();
          if (mounted) setLocLoading(false);
        }
      } catch (error) {
        if (mounted) {
          setLocationError(error);
          setLocLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [applyHereFromCoords, applyInitialPickup, preserveInitialPickup]);

  return {
    currentLocationAddress,
    locLoading,
    locationError,
    refreshHereLocation,
    userLocation,
  };
}
