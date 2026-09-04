import { boundsFromCoordinates, circlePolygon, regionToZoomLevel } from '../geo';

describe('boundsFromCoordinates', () => {
  it('returns the min/max lat/lng as sw/ne corners', () => {
    const { ne, sw } = boundsFromCoordinates([
      { latitude: -1.95, longitude: 30.05 },
      { latitude: -1.90, longitude: 30.10 },
      { latitude: -2.00, longitude: 30.00 },
    ]);
    expect(ne).toEqual({ latitude: -1.90, longitude: 30.10 });
    expect(sw).toEqual({ latitude: -2.00, longitude: 30.00 });
  });

  it('collapses a single coordinate to a zero-area box', () => {
    const point = { latitude: -1.95, longitude: 30.05 };
    const { ne, sw } = boundsFromCoordinates([point]);
    expect(ne).toEqual(point);
    expect(sw).toEqual(point);
  });

  it('throws on an empty list rather than silently returning a bogus box', () => {
    expect(() => boundsFromCoordinates([])).toThrow();
  });
});

describe('regionToZoomLevel', () => {
  it('maps the full 360deg span to zoom 0', () => {
    expect(regionToZoomLevel(360)).toBeCloseTo(0, 5);
  });

  it('doubles zoom level for each halving of the visible span', () => {
    expect(regionToZoomLevel(180)).toBeCloseTo(1, 5);
    expect(regionToZoomLevel(90)).toBeCloseTo(2, 5);
  });

  it('never divides by zero for a degenerate delta', () => {
    expect(Number.isFinite(regionToZoomLevel(0))).toBe(true);
  });
});

describe('circlePolygon', () => {
  const center = { latitude: -1.9441, longitude: 30.0619 };

  it('returns a closed ring (first point === last point)', () => {
    const ring = circlePolygon(center, 140);
    expect(ring[0]).toEqual(ring[ring.length - 1]);
  });

  it('produces points at roughly the requested radius from the center', () => {
    const radiusMeters = 500;
    const ring = circlePolygon(center, radiusMeters, 8);
    // Rough haversine check on one ring point — within 1% of requested radius.
    const [lng, lat] = ring[0];
    const R = 6371000;
    const dLat = ((lat - center.latitude) * Math.PI) / 180;
    const dLng = ((lng - center.longitude) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((center.latitude * Math.PI) / 180) *
      Math.cos((lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
    const distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    expect(distance).toBeGreaterThan(radiusMeters * 0.99);
    expect(distance).toBeLessThan(radiusMeters * 1.01);
  });

  it('respects the requested point count', () => {
    const ring = circlePolygon(center, 100, 16);
    expect(ring).toHaveLength(17); // +1 to close the ring
  });
});
