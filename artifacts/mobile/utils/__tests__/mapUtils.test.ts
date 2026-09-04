import { decodeRoutePolyline, homeRoutePolyline, markerPositionKey } from '@/utils/mapUtils';

const pickup = { latitude: -1.95, longitude: 30.05 };
const destination = { latitude: -1.96, longitude: 30.08 };

describe('decodeRoutePolyline', () => {
  it('decodes a precision-5 encoded polyline (OSRM route_geometry) into coordinates', () => {
    // Encoded (precision 5) form of [[-1.95,30.05],[-1.955,30.06],[-1.96,30.08]].
    const encoded = 'nz{JoclvDf^o}@f^_|B';
    expect(decodeRoutePolyline(encoded)).toEqual([
      { latitude: -1.95, longitude: 30.05 },
      { latitude: -1.955, longitude: 30.06 },
      { latitude: -1.96, longitude: 30.08 },
    ]);
  });
});

describe('homeRoutePolyline', () => {
  it('does not create a straight fallback line without routing geometry', () => {
    expect(homeRoutePolyline([], pickup, destination)).toEqual([]);
    expect(homeRoutePolyline([pickup], pickup, destination)).toEqual([]);
  });

  it('draws loaded routing geometry through the pickup and destination pins', () => {
    const geometry = [
      { latitude: -1.951, longitude: 30.051 },
      { latitude: -1.955, longitude: 30.06 },
      { latitude: -1.959, longitude: 30.079 },
    ];

    expect(homeRoutePolyline(geometry, pickup, destination)).toEqual([
      pickup,
      geometry[1],
      destination,
    ]);
  });
});

describe('markerPositionKey', () => {
  it('changes when the coordinate genuinely moves', () => {
    const a = markerPositionKey({ latitude: -1.95, longitude: 30.05 });
    const b = markerPositionKey({ latitude: -1.9501, longitude: 30.0501 });
    expect(a).not.toEqual(b);
  });

  it('is stable (does not remount) across sub-precision GPS jitter', () => {
    const a = markerPositionKey({ latitude: -1.950001, longitude: 30.050001 });
    const b = markerPositionKey({ latitude: -1.9500012, longitude: 30.0500009 });
    expect(a).toEqual(b);
  });

  it('is deterministic for the same coordinate', () => {
    const coord = { latitude: -1.95123, longitude: 30.05123 };
    expect(markerPositionKey(coord)).toEqual(markerPositionKey({ ...coord }));
  });
});
