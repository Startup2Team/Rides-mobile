import { router } from 'expo-router';
import { useRide } from '@/context/RideContext';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { calcFare } from '@/context/ride/rideFare';
import { estimateFare } from '@/services/fare';
import type { RideLocation, VehicleType } from '@/types';
import {
  arePickupAndDropoffSame,
  hasUsablePickup,
  isPickupFarFromUserGps,
} from '@/utils/locationUtils';
import type { LocationSearchTarget } from './useLocationSearch';

export function useHomeBooking({
  createRide,
  gpsLocation,
  onBeforeCreate,
  openLocationSearch,
  userLocation,
}: {
  createRide: (
    pickup: RideLocation,
    destination: RideLocation,
    vehicleType: VehicleType,
    destinationText?: string,
  ) => Promise<void>;
  gpsLocation: RideLocation | null;
  onBeforeCreate: () => void;
  openLocationSearch: (target: LocationSearchTarget) => void;
  userLocation: RideLocation;
}) {
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleType>('moto');
  const {
    pickup,
    setPickup,
    destination,
    setDestination,
    destText,
    setDestText,
  } = useRide();
  const [bookLoading, setBookLoading] = useState(false);

  const proceedWithBooking = useCallback(async (finalDestination: RideLocation) => {
    const dropoffDisplayText = destination?.address?.trim() || destText.trim();
    onBeforeCreate();
    setBookLoading(true);
    try {
      await createRide(pickup, finalDestination, selectedVehicle, dropoffDisplayText);
      router.push('/searching');
    } finally {
      setBookLoading(false);
    }
  }, [createRide, destText, destination?.address, onBeforeCreate, pickup, selectedVehicle]);

  const confirmAndProceedWithBooking = useCallback((finalDestination: RideLocation) => {
    if (arePickupAndDropoffSame(pickup, finalDestination)) {
      Alert.alert(
        'Same location',
        'Pickup and drop off locations are the same. Are you sure you want to continue?',
        [
          { text: 'Change pickup', onPress: () => openLocationSearch('pickup') },
          { text: 'Change drop off', onPress: () => openLocationSearch('dropoff') },
          { text: 'Continue anyway', onPress: () => { void proceedWithBooking(finalDestination); } },
        ],
      );
      return;
    }

    void proceedWithBooking(finalDestination);
  }, [openLocationSearch, pickup, proceedWithBooking]);

  const handleBook = useCallback(() => {
    if (!destination && !destText.trim()) return;
    if (!hasUsablePickup(pickup)) {
      Alert.alert(
        'Select pickup location',
        'Your pickup location is required before finding a driver.',
        [{ text: 'Select pickup manually', onPress: () => openLocationSearch('pickup') }],
      );
      return;
    }

    const finalDestination: RideLocation = destination
      ? { ...destination, locationType: destination.locationType ?? 'precise' }
      : {
          latitude: userLocation.latitude + 0.02,
          longitude: userLocation.longitude + 0.02,
          address: destText.trim(),
          locationType: 'generic',
        };

    if (gpsLocation && isPickupFarFromUserGps(pickup, gpsLocation)) {
      Alert.alert(
        'Pickup seems far away',
        'Your pickup location seems far from your GPS location. Are you sure you want to continue?',
        [
          { text: 'Change pickup', onPress: () => openLocationSearch('pickup') },
          { text: 'Continue', onPress: () => confirmAndProceedWithBooking(finalDestination) },
        ],
      );
      return;
    }

    confirmAndProceedWithBooking(finalDestination);
  }, [
    confirmAndProceedWithBooking,
    destination,
    destText,
    gpsLocation,
    openLocationSearch,
    pickup,
    userLocation,
  ]);

  const distance = useMemo(() => destination
    ? Math.sqrt(
        Math.pow((destination.latitude - pickup.latitude) * 111, 2) +
        Math.pow((destination.longitude - pickup.longitude) * 111, 2),
      )
    : 0, [destination, pickup.latitude, pickup.longitude]);

  // Displayed fare quote — server-authoritative via GET /v1/customer/fare-estimate
  // so it cannot be tampered with client-side. calcFare stays only as the offline
  // fallback once the request settles without data.
  const fareEnabled = destination !== null && hasUsablePickup(pickup);
  const fareQuery = useQuery({
    queryKey: [
      'fareEstimate',
      selectedVehicle,
      pickup.latitude,
      pickup.longitude,
      destination?.latitude ?? null,
      destination?.longitude ?? null,
    ],
    enabled: fareEnabled,
    queryFn: () => estimateFare({
      vehicleType: selectedVehicle,
      pickupLat: pickup.latitude,
      pickupLng: pickup.longitude,
      destLat: destination!.latitude,
      destLng: destination!.longitude,
    }),
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
  });

  const estimatedFare = useMemo(() => {
    if (!fareEnabled) return null;
    // Fares are whole RWF — round so the UI never renders a decimal quote
    // (the backend fare is integer; the estimate can carry float noise).
    if (fareQuery.data) return Math.round(fareQuery.data.totalFareRwf);
    if (fareQuery.isLoading) return null;
    return Math.round(calcFare(selectedVehicle, distance));
  }, [distance, fareEnabled, fareQuery.data, fareQuery.isLoading, selectedVehicle]);
  const estimatedFareLoading = fareEnabled && fareQuery.isLoading;

  return {
    bookLoading,
    destText,
    destination,
    distance,
    estimatedFare,
    estimatedFareLoading,
    handleBook,
    pickup,
    selectedVehicle,
    setDestText,
    setDestination,
    setPickup,
    setSelectedVehicle,
  };
}
