import {
  clearSearchSession,
  getInitialSearchState,
  getSearchState,
  openSearchSession,
  resetSearchStore,
  setSelectedSearchSuggestion,
  updateSearchQuery,
  toSearchLocation,
} from '../searchStore';

describe('searchStore', () => {
  afterEach(() => {
    resetSearchStore();
  });

  test('tracks search sessions and resets cleanly', () => {
    openSearchSession('pickup', 'Kigali', 'session-1');
    updateSearchQuery('Kimironko');
    setSelectedSearchSuggestion({
      id: 'suggestion-1',
      place_name: 'Kimironko Market, Kigali',
      title: 'Kimironko Market',
      coords: { latitude: -1.9, longitude: 30.1 },
      source: 'mapbox',
    });

    expect(getSearchState().target).toBe('pickup');
    expect(getSearchState().recentSessionId).toBe('session-1');

    const location = toSearchLocation(getSearchState().selectedSuggestion!, 'Fallback');
    expect(location.address).toBe('Kimironko Market, Kigali');

    clearSearchSession();
    expect(getSearchState()).toEqual(getInitialSearchState());
  });
});
