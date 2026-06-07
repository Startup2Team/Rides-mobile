import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import type { RideLocation, VehicleType } from '@/types';
import {
  arePickupAndDropoffSame,
  isPickupFarFromUserGps,
} from '@/utils/locationUtils';
import type { LocationSearchTarget } from './useLocationSearch';

export function useHomeBooking({
  createRide,
  locLoading,
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
  locLoading: boolean;
  onBeforeCreate: () => void;
  openLocationSearch: (target: LocationSearchTarget) => void;
  userLocation: RideLocation;
}) {
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleType>('moto');
  const [pickup, setPickup] = useState<RideLocation>({ ...userLocation, address: '' });
  const [destText, setDestText] = useState('');
  const [destination, setDestination] = useState<RideLocation | null>(null);
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

    const finalDestination: RideLocation = destination
      ? { ...destination, locationType: destination.locationType ?? 'precise' }
      : {
          latitude: userLocation.latitude + 0.02,
          longitude: userLocation.longitude + 0.02,
          address: destText.trim(),
          locationType: 'generic',
        };

    if (!locLoading && isPickupFarFromUserGps(pickup, userLocation)) {
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
    locLoading,
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

  return {
    bookLoading,
    destText,
    destination,
    distance,
    handleBook,
    pickup,
    selectedVehicle,
    setDestText,
    setDestination,
    setPickup,
    setSelectedVehicle,
  };
}
