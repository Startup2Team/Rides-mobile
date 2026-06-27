import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { RideLocation } from '@/types';

export type MapPickerBookingTarget = 'pickup' | 'dropoff';

export type MapPickerSavedPlaceMode = 'saved-place-add' | 'saved-place-edit';

export type MapPickerSelection =
  | {
      flow: 'booking';
      target: MapPickerBookingTarget;
      location: RideLocation;
    }
  | {
      flow: 'saved-place';
      mode: MapPickerSavedPlaceMode;
      savedPlaceId?: string;
      label?: string;
      location: RideLocation;
    };

interface MapPickerContextValue {
  selection: MapPickerSelection | null;
  setBookingSelection: (selection: Extract<MapPickerSelection, { flow: 'booking' }>) => void;
  setSavedPlaceSelection: (selection: Extract<MapPickerSelection, { flow: 'saved-place' }>) => void;
  consumeSelection: () => MapPickerSelection | null;
  clearSelection: () => void;
}

const MapPickerContext = createContext<MapPickerContextValue | null>(null);

export function MapPickerProvider({ children }: { children: React.ReactNode }) {
  const [selection, setSelection] = useState<MapPickerSelection | null>(null);
  const selectionRef = useRef<MapPickerSelection | null>(null);

  selectionRef.current = selection;

  const setBookingSelection = useCallback((next: Extract<MapPickerSelection, { flow: 'booking' }>) => {
    selectionRef.current = next;
    setSelection(next);
  }, []);

  const setSavedPlaceSelection = useCallback((next: Extract<MapPickerSelection, { flow: 'saved-place' }>) => {
    selectionRef.current = next;
    setSelection(next);
  }, []);

  const consumeSelection = useCallback(() => {
    const current = selectionRef.current;
    setSelection(null);
    selectionRef.current = null;
    return current;
  }, []);

  const clearSelection = useCallback(() => {
    setSelection(null);
    selectionRef.current = null;
  }, []);

  const value = useMemo(
    () => ({
      selection,
      setBookingSelection,
      setSavedPlaceSelection,
      consumeSelection,
      clearSelection,
    }),
    [clearSelection, consumeSelection, selection, setBookingSelection, setSavedPlaceSelection],
  );

  return <MapPickerContext.Provider value={value}>{children}</MapPickerContext.Provider>;
}

export function useMapPicker() {
  const context = useContext(MapPickerContext);
  if (!context) {
    throw new Error('useMapPicker must be used within a MapPickerProvider');
  }
  return context;
}
