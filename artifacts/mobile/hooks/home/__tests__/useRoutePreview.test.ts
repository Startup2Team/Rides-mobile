import { renderHook } from '@testing-library/react-native';
import { useRoutePreview } from '../useRoutePreview';
import type { RideLocation } from '@/types';

// Keep this test focused on useRoutePreview's own backend-route-preference
// logic — stub the Mapbox route fetch and the RN bits the hook only uses for
// scheduling/inset math, none of which this test exercises meaningfully.
let mockUseRouteResult: any = { route: null, routeKey: null, loading: false, error: null, source: null };
jest.mock('@/hooks/useRoute', () => ({
  useRoute: () => mockUseRouteResult,
  getRouteKey: () => 'ROUTE_KEY',
}));

jest.mock('react-native', () => ({
  InteractionManager: {
    runAfterInteractions: (cb: () => void) => {
      cb();
      return { cancel: () => {} };
    },
  },
  Platform: { OS: 'ios', select: (o: { ios?: unknown; default?: unknown }) => o.ios ?? o.default },
}));

const pickup: RideLocation = { latitude: -1.95, longitude: 30.05, address: 'Pickup', locationType: 'precise' };
const destination: RideLocation = { latitude: -1.96, longitude: 30.08, address: 'Destination', locationType: 'precise' };
const midCoord = { latitude: -1.955, longitude: 30.065 };

type RoutePreviewProps = Parameters<typeof useRoutePreview>[0];

const baseProps = {
  pickup,
  destination,
  showBooking: true,
  isMapReady: false,
  mapRef: { current: null },
  bookingPanelMapInset: 100,
  topInset: 0,
  bottomInset: 0,
  routeRecenterRequest: 0,
  vehicleType: 'moto' as const,
};

describe('useRoutePreview — backend (OSRM) route preference', () => {
  beforeEach(() => {
    mockUseRouteResult = { route: null, routeKey: null, loading: false, error: null, source: null };
  });

  it('without a backend route, falls back to the loaded Mapbox route exactly as before', () => {
    const mapboxRoute = {
      coordinates: [pickup, midCoord, destination],
      distanceMeters: 4200,
      durationSeconds: 780,
    };
    mockUseRouteResult = { route: mapboxRoute, routeKey: 'ROUTE_KEY', loading: false, error: null, source: 'mapbox' };

    const { result } = renderHook((props: RoutePreviewProps) => useRoutePreview(props), { initialProps: baseProps });

    expect(result.current.route).toEqual(mapboxRoute);
    expect(result.current.routeLoading).toBe(false);
    expect(result.current.routeLineCoords.length).toBeGreaterThan(1);
  });

  it('prefers a present backend route over Mapbox — including while Mapbox is still loading', () => {
    const backendRoute = {
      coordinates: [pickup, midCoord, destination],
      distanceMeters: 4300,
      durationSeconds: 700,
    };
    // Mapbox has not answered yet — the real ETA should not wait on it.
    mockUseRouteResult = { route: null, routeKey: null, loading: true, error: null, source: null };

    const { result } = renderHook(
      (props: RoutePreviewProps) => useRoutePreview(props),
      { initialProps: { ...baseProps, backendRoute } },
    );

    expect(result.current.route).toEqual(backendRoute);
    expect(result.current.routeLoading).toBe(false);
    expect(result.current.routeLineCoords[0]).toEqual({ latitude: pickup.latitude, longitude: pickup.longitude });
    expect(result.current.routeLineCoords[result.current.routeLineCoords.length - 1]).toEqual({
      latitude: destination.latitude,
      longitude: destination.longitude,
    });
  });

  it('absent backend route fields (null) fall back to Mapbox / empty, never crash', () => {
    mockUseRouteResult = { route: null, routeKey: null, loading: false, error: null, source: null };

    const { result } = renderHook(
      (props: RoutePreviewProps) => useRoutePreview(props),
      { initialProps: { ...baseProps, backendRoute: null } },
    );

    expect(result.current.route).toBeNull();
    expect(result.current.routeLineCoords).toEqual([]);
    expect(result.current.shouldShowBookingRoute).toBe(false);
  });

  it('ignores a backend route for an imprecise (generic) destination, same as it ignores Mapbox', () => {
    const backendRoute = {
      coordinates: [pickup, midCoord, destination],
      distanceMeters: 4300,
      durationSeconds: 700,
    };
    const genericDestination: RideLocation = { ...destination, locationType: 'generic' };

    const { result } = renderHook(
      (props: RoutePreviewProps) => useRoutePreview(props),
      { initialProps: { ...baseProps, destination: genericDestination, backendRoute } },
    );

    expect(result.current.route).not.toEqual(backendRoute);
    expect(result.current.routeLineCoords).toEqual([]);
  });
});
