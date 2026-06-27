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

export const MAP_PICKER_RESULT_TTL_MS = 5 * 60 * 1000;

export function createMapPickerSessionId() {
  return `map-picker-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

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

export type MapPickerSavedPlaceResult = {
  sessionId: string;
  mode: MapPickerSavedPlaceMode;
  savedPlaceId?: string;
  address: string;
  latitude: number;
  longitude: number;
  createdAt: number;
  target?: 'saved-place';
};

interface MapPickerContextValue {
  selection: MapPickerSelection | null;
  setBookingSelection: (selection: Extract<MapPickerSelection, { flow: 'booking' }>) => void;
  setSavedPlaceSelection: (selection: Extract<MapPickerSelection, { flow: 'saved-place' }>) => void;
  consumeSelection: () => MapPickerSelection | null;
  clearSelection: () => void;
  result: MapPickerSavedPlaceResult | null;
  setResult: (result: MapPickerSavedPlaceResult) => void;
  consumeResult: (sessionId: string) => MapPickerSavedPlaceResult | null;
  clearResult: (sessionId?: string) => void;
  clearAll: () => void;
}

const MapPickerContext = createContext<MapPickerContextValue | null>(null);

export function MapPickerProvider({ children }: { children: React.ReactNode }) {
  const [selection, setSelection] = useState<MapPickerSelection | null>(null);
  const [result, setResultState] = useState<MapPickerSavedPlaceResult | null>(null);
  const selectionRef = useRef<MapPickerSelection | null>(null);
  const resultRef = useRef<MapPickerSavedPlaceResult | null>(null);

  selectionRef.current = selection;
  resultRef.current = result;

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

  const setResult = useCallback((next: MapPickerSavedPlaceResult) => {
    resultRef.current = next;
    setResultState(next);
  }, []);

  const clearResult = useCallback((sessionId?: string) => {
    const current = resultRef.current;
    if (!current) return;
    if (sessionId && current.sessionId !== sessionId) return;
    resultRef.current = null;
    setResultState(null);
  }, []);

  const consumeResult = useCallback((sessionId: string) => {
    const current = resultRef.current;
    if (!current) return null;

    const isFresh = Date.now() - current.createdAt <= MAP_PICKER_RESULT_TTL_MS;
    if (!isFresh || current.sessionId !== sessionId) {
      resultRef.current = null;
      setResultState(null);
      return null;
    }

    resultRef.current = null;
    setResultState(null);
    return current;
  }, []);

  const clearAll = useCallback(() => {
    clearSelection();
    clearResult();
  }, [clearResult, clearSelection]);

  const value = useMemo(
    () => ({
      selection,
      setBookingSelection,
      setSavedPlaceSelection,
      consumeSelection,
      clearSelection,
      result,
      setResult,
      consumeResult,
      clearResult,
      clearAll,
    }),
    [
      clearAll,
      clearResult,
      consumeResult,
      clearSelection,
      consumeSelection,
      result,
      selection,
      setBookingSelection,
      setResult,
      setSavedPlaceSelection,
    ],
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
