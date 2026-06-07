import { useCallback, useMemo, useState } from 'react';
import { Alert, Keyboard } from 'react-native';
import type { GeocodeSuggestion } from '@/services/geocoding';
import type { RideLocation, SavedLocation } from '@/types';

export function useSavedLocationEditor({
  onLocationSaved,
  persistSavedPlaces,
  resetSearchResults,
  saveLocation,
  savedPlaces,
  schedulePlaceSearch,
  setSearchLoading,
  setSuggestions,
  showToast,
  userLocation,
}: {
  onLocationSaved: () => void;
  persistSavedPlaces: (locations: SavedLocation[]) => Promise<void>;
  resetSearchResults: () => void;
  saveLocation: (location: RideLocation, label: string) => Promise<unknown>;
  savedPlaces: SavedLocation[];
  schedulePlaceSearch: (text: string) => void;
  setSearchLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setSuggestions: React.Dispatch<React.SetStateAction<GeocodeSuggestion[]>>;
  showToast: (message: string, type?: 'error' | 'info' | 'success') => void;
  userLocation: RideLocation;
}) {
  const [pendingSaveLocation, setPendingSaveLocation] = useState<RideLocation | null>(null);
  const [isCustomSaveLabel, setIsCustomSaveLabel] = useState(false);
  const [customSaveLabel, setCustomSaveLabel] = useState('');
  const [editingSavedLocation, setEditingSavedLocation] = useState<SavedLocation | null>(null);
  const [editingSavedLabel, setEditingSavedLabel] = useState('');
  const [editingSavedAddress, setEditingSavedAddress] = useState('');
  const [editingSavedFocusedField, setEditingSavedFocusedField] = useState<'label' | 'address' | null>(null);
  const [editSavedFieldErrors, setEditSavedFieldErrors] = useState<{
    label?: string;
    address?: string;
  }>({});

  const closePendingSaveLocation = useCallback(() => {
    setPendingSaveLocation(null);
    setIsCustomSaveLabel(false);
    setCustomSaveLabel('');
    Keyboard.dismiss();
  }, []);

  const closeEditSavedLocation = useCallback(() => {
    setEditingSavedLocation(null);
    setEditingSavedLabel('');
    setEditingSavedAddress('');
    setEditSavedFieldErrors({});
    resetSearchResults();
    setEditingSavedFocusedField(null);
    Keyboard.dismiss();
  }, [resetSearchResults]);

  const resetEditor = useCallback(() => {
    closePendingSaveLocation();
    closeEditSavedLocation();
  }, [closeEditSavedLocation, closePendingSaveLocation]);

  const saveLocationAs = useCallback(async (label: string) => {
    if (!pendingSaveLocation) return;
    const cleanLabel = label.trim();
    if (!cleanLabel) return;
    await saveLocation(pendingSaveLocation, cleanLabel);
    showToast(`Saved as ${cleanLabel}`);
    closePendingSaveLocation();
    onLocationSaved();
  }, [closePendingSaveLocation, onLocationSaved, pendingSaveLocation, saveLocation, showToast]);

  const handleSaveLocationLabelPress = useCallback((label: string) => {
    if (label === 'Other') {
      setIsCustomSaveLabel(true);
      setCustomSaveLabel('');
      return;
    }
    void saveLocationAs(label);
  }, [saveLocationAs]);

  const openSavedLocationMenu = useCallback((location: SavedLocation) => {
    setEditingSavedLocation(location);
    setEditingSavedLabel(location.label);
    setEditingSavedAddress(location.address ?? '');
    setEditSavedFieldErrors({});
    resetSearchResults();
    setEditingSavedFocusedField(null);
    closePendingSaveLocation();
    Keyboard.dismiss();
  }, [closePendingSaveLocation, resetSearchResults]);

  const performDeleteSavedLocation = useCallback(async (location: SavedLocation) => {
    const next = savedPlaces.filter(place => place.id !== location.id);
    await persistSavedPlaces(next);
    showToast('Location removed', 'error');
    if (editingSavedLocation?.id === location.id) closeEditSavedLocation();
  }, [
    closeEditSavedLocation,
    editingSavedLocation?.id,
    persistSavedPlaces,
    savedPlaces,
    showToast,
  ]);

  const confirmDeleteSavedLocation = useCallback((location: SavedLocation) => {
    Alert.alert(
      `Delete "${location.label}"?`,
      'This saved place will be removed from your list. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void performDeleteSavedLocation(location);
          },
        },
      ],
    );
  }, [performDeleteSavedLocation]);

  const showSavedLocationActions = useCallback((location: SavedLocation) => {
    Alert.alert(location.label, location.address ?? '', [
      { text: 'Edit', onPress: () => openSavedLocationMenu(location) },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => confirmDeleteSavedLocation(location),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [confirmDeleteSavedLocation, openSavedLocationMenu]);

  const handleEditSavedAddressText = useCallback((text: string) => {
    setEditingSavedAddress(text);
    schedulePlaceSearch(text);
  }, [schedulePlaceSearch]);

  const applyEditSavedAddressSuggestion = useCallback((suggestion: GeocodeSuggestion) => {
    setEditSavedFieldErrors(previous => ({ ...previous, address: undefined }));
    setEditingSavedAddress(suggestion.place_name);
    setEditingSavedLocation(previous =>
      previous
        ? {
            ...previous,
            ...suggestion.coords,
            address: suggestion.place_name,
            locationType: 'precise',
          }
        : previous,
    );
    setSuggestions([]);
    setSearchLoading(false);
    setEditingSavedFocusedField(null);
    Keyboard.dismiss();
  }, [setSearchLoading, setSuggestions]);

  const applyEditTypedAddress = useCallback(() => {
    const address = editingSavedAddress.trim();
    if (!editingSavedLocation || address.length < 2) return;
    setEditSavedFieldErrors(previous => ({ ...previous, address: undefined }));
    setEditingSavedLocation({
      ...editingSavedLocation,
      latitude: userLocation.latitude + 0.02,
      longitude: userLocation.longitude + 0.02,
      address,
      locationType: 'generic',
    });
    resetSearchResults();
    setEditingSavedFocusedField(null);
    Keyboard.dismiss();
  }, [editingSavedAddress, editingSavedLocation, resetSearchResults, userLocation]);

  const renameSavedLocation = useCallback(async () => {
    if (!editingSavedLocation) return;

    const label = editingSavedLabel.trim();
    const address = editingSavedAddress.trim();
    const errors: { label?: string; address?: string } = {};
    if (label.length === 0) errors.label = 'Enter a name for this saved place';
    if (address.length < 2) errors.address = 'Enter an address or pick one from the suggestions';

    if (errors.label || errors.address) {
      setEditSavedFieldErrors(errors);
      showToast(
        errors.label && errors.address
          ? 'Add a name and address before saving'
          : (errors.label ?? errors.address)!,
        'error',
      );
      return;
    }

    const next = savedPlaces.map(place =>
      place.id === editingSavedLocation.id
        ? { ...editingSavedLocation, label, address }
        : place,
    );
    await persistSavedPlaces(next);
    showToast('Location updated', 'info');
    closeEditSavedLocation();
  }, [
    closeEditSavedLocation,
    editingSavedAddress,
    editingSavedLabel,
    editingSavedLocation,
    persistSavedPlaces,
    savedPlaces,
    showToast,
  ]);

  const showEditAddressSuggestions = useMemo(
    () => editingSavedFocusedField === 'address' && editingSavedAddress.trim().length >= 2,
    [editingSavedAddress, editingSavedFocusedField],
  );

  return {
    applyEditSavedAddressSuggestion,
    applyEditTypedAddress,
    closeEditSavedLocation,
    closePendingSaveLocation,
    confirmDeleteSavedLocation,
    customSaveLabel,
    editSavedFieldErrors,
    editingSavedAddress,
    editingSavedFocusedField,
    editingSavedLabel,
    editingSavedLocation,
    handleEditSavedAddressText,
    handleSaveLocationLabelPress,
    isCustomSaveLabel,
    pendingSaveLocation,
    renameSavedLocation,
    resetEditor,
    saveLocationAs,
    setCustomSaveLabel,
    setEditSavedFieldErrors,
    setEditingSavedAddress,
    setEditingSavedFocusedField,
    setEditingSavedLabel,
    setEditingSavedLocation,
    setPendingSaveLocation,
    showEditAddressSuggestions,
    showSavedLocationActions,
  };
}
