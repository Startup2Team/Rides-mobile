import { readFileSync } from 'fs';
import { resolve } from 'path';

const SCREEN_FILES = [
  'app/saved-place-selector.tsx',
  'app/location-search.tsx',
  'app/map-picker.tsx',
  'components/home/CustomerHome.tsx',
  'components/home/LocationSearchOverlay.tsx',
  'components/home/SavedLocationsSection.tsx',
];

function readProjectFile(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8');
}

describe('saved-locations screen imports', () => {
  test('screens do not import persistence or secure storage directly', () => {
    for (const file of SCREEN_FILES) {
      const content = readProjectFile(file);
      expect(content).not.toMatch(/AsyncStorage|SecureStore/);
      expect(content).not.toContain("from '@/persistence/savedLocationsPersistence'");
      expect(content).not.toContain("from '@/data/sources/localDataSources'");
    }
  });
});
