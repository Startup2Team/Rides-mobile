import { readFileSync } from 'fs';
import path from 'path';

function readSource(relativePath: string) {
  return readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

describe('driver design token migration', () => {
  test.each([
    '(driver)/index.tsx',
    '(driver)/profile.tsx',
    '(driver)/stats.tsx',
    'driver-add-vehicle.tsx',
    'driver-documents.tsx',
    'driver-navigate.tsx',
    'driver-negotiation.tsx',
    'driver-package-payment.tsx',
    'driver-packages.tsx',
    'driver-ride-complete.tsx',
    'driver-submission-confirmation.tsx',
    'driver-vehicle-details.tsx',
    'driver-vehicles.tsx',
  ])('%s imports design tokens for driver screen styles', relativePath => {
    const source = readSource(relativePath);

    expect(source).toMatch(/@\/constants\/(spacing|radius|sizes|icons|elevation|motion|zIndex)/);
  });
});
