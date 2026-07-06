import { readFileSync } from 'fs';
import path from 'path';

function readSource(relativePath: string) {
  return readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

describe('navigation architecture regression', () => {
  test('CustomerHome is a shell without legacy overlay orchestration', () => {
    const source = readSource('../components/home/CustomerHome.tsx');

    expect(source).toContain("pathname: '/location-search'");
    expect(source).toContain("pathname: '/map-picker'");
    expect(source).not.toContain('MapPickerOverlay');
    expect(source).not.toContain('LocationSearchOverlay');
    expect(source).not.toContain('triggerMapPicker');
    expect(source).not.toContain('openLocationSearchRef');
    expect(source).not.toContain('requestLocationSearch');
    expect(source).not.toContain('isOverlaySuspended');
    expect(source).not.toContain('suspendOverlayAndNavigate');
  });

  test('location-search remains route-based and launches downstream routes with push/back', () => {
    const source = readSource('../app/location-search.tsx');

    expect(source).toContain("pathname: '/saved-place-selector'");
    expect(source).toContain("pathname: '/map-picker'");
    expect(source).toContain('router.back()');
    expect(source).not.toContain("router.replace('/(tabs)')");
  });

  test('map-picker remains a stack route and closes with back', () => {
    const source = readSource('../app/map-picker.tsx');

    expect(source).toContain('router.back()');
    expect(source).not.toContain("router.replace('/(tabs)')");
    expect(source).toContain('setBookingSelection');
    expect(source).toContain('setResult');
  });

  test('saved-place-selector owns the session-scoped handoff', () => {
    const source = readSource('../app/saved-place-selector.tsx');

    expect(source).toContain('createMapPickerSessionId');
    expect(source).toContain('consumeResult');
    expect(source).toContain("pathname: '/map-picker'");
    expect(source).toContain('router.back()');
  });

  test('map picker context exposes one-time result lifecycle APIs', () => {
    const source = readSource('../context/MapPickerContext.tsx');

    expect(source).toContain('MAP_PICKER_RESULT_TTL_MS');
    expect(source).toContain('setResult');
    expect(source).toContain('consumeResult');
    expect(source).toContain('clearResult');
    expect(source).toContain('clearAll');
  });
});
