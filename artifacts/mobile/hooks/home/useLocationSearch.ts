import { useCallback, useEffect, useRef, useState } from 'react';
import type { RideLocation } from '@/types';
import { geocodeAddress, type GeocodeSuggestion } from '@/services/geocoding';
import { isAbortedNetworkRequest } from '@/services/networkRequest';

export type LocationSearchTarget = 'pickup' | 'dropoff';
export type LocationListTab = 'saved' | 'previous';

export function useLocationSearch(userLocation: RideLocation) {
  const [target, setTarget] = useState<LocationSearchTarget | null>(null);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [listTab, setListTab] = useState<LocationListTab>('saved');
  const [suggestions, setSuggestions] = useState<GeocodeSuggestion[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestId = useRef(0);
  const abortController = useRef<AbortController | null>(null);

  const cancelPendingSearch = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    abortController.current?.abort();
    abortController.current = null;
    requestId.current += 1;
  }, []);

  useEffect(() => cancelPendingSearch, [cancelPendingSearch]);

  const resetResults = useCallback(() => {
    cancelPendingSearch();
    setLoading(false);
    setSuggestions([]);
  }, [cancelPendingSearch]);

  const close = useCallback(() => {
    resetResults();
    setTarget(null);
    setText('');
  }, [resetResults]);

  const open = useCallback((
    nextTarget: LocationSearchTarget,
    initialText: string,
  ) => {
    setTarget(nextTarget);
    setText(initialText);
    setListTab('saved');
    setSuggestions([]);
  }, []);

  const scheduleSearch = useCallback(
    (searchText: string) => {
      cancelPendingSearch();
      const trimmed = searchText.trim();
      if (trimmed.length < 2) {
        setSuggestions([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      const nextRequestId = requestId.current + 1;
      requestId.current = nextRequestId;
      timer.current = setTimeout(async () => {
        timer.current = null;
        const controller = new AbortController();
        abortController.current = controller;
        try {
          const results = await geocodeAddress(searchText, userLocation, {
            signal: controller.signal,
          });
          if (requestId.current === nextRequestId) setSuggestions(results);
        } catch (error) {
          if (!isAbortedNetworkRequest(error) && requestId.current === nextRequestId) {
            setSuggestions([]);
          }
        } finally {
          if (abortController.current === controller) abortController.current = null;
          if (requestId.current === nextRequestId) setLoading(false);
        }
      }, 350);
    },
    [cancelPendingSearch, userLocation],
  );

  const handleTextChange = useCallback((nextText: string) => {
    setText(nextText);
    scheduleSearch(nextText);
  }, [scheduleSearch]);

  const clearText = useCallback(() => {
    setText('');
    resetResults();
  }, [resetResults]);

  const buildTypedLocation = useCallback((address = text): RideLocation => ({
    latitude: userLocation.latitude + 0.02,
    longitude: userLocation.longitude + 0.02,
    address: address.trim(),
    locationType: 'generic',
  }), [text, userLocation.latitude, userLocation.longitude]);

  return {
    buildTypedLocation,
    cancelPendingSearch,
    clearText,
    close,
    handleTextChange,
    listTab,
    loading,
    open,
    resetResults,
    scheduleSearch,
    setListTab,
    setLoading,
    setSuggestions,
    setTarget,
    setText,
    suggestions,
    target,
    text,
  };
}
