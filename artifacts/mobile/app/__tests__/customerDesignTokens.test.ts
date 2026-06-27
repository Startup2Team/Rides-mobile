import { readFileSync } from 'fs';
import path from 'path';

function readSource(relativePath: string) {
  return readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

describe('customer design token migration', () => {
  test('customer home chrome uses design tokens', () => {
    const source = readFileSync(
      path.join(__dirname, '..', '..', 'components', 'home', 'CustomerHome.tsx'),
      'utf8',
    );

    expect(source).toContain("@/constants/motion");
    expect(source).toContain("@/constants/sizes");
    expect(source).toContain("@/constants/spacing");
    expect(source).toContain('duration.modal');
    expect(source).toContain('spacing[');
  });

  test.each([
    '(tabs)/history.tsx',
    '(tabs)/profile.tsx',
    'about.tsx',
    'edit-profile.tsx',
    'help-support.tsx',
    'notifications.tsx',
    'payment-methods.tsx',
    'privacy-security.tsx',
    'rating.tsx',
    'report-ride-issue.tsx',
    'ride-detail.tsx',
    'saved-place-selector.tsx',
    'settings.tsx',
    'searching.tsx',
  ])('%s imports design tokens for customer screen styles', relativePath => {
    const source = readSource(relativePath);

    expect(source).toMatch(/@\/constants\/(spacing|radius|sizes|icons|elevation|motion)/);
    expect(source).toContain('semanticSpacing');
  });

  test.each([
    'LocationSearchOverlay.tsx',
    'MapPickerOverlay.tsx',
  ])('%s imports design tokens for customer overlay chrome', filename => {
    const source = readFileSync(
      path.join(__dirname, '..', '..', 'components', 'home', filename),
      'utf8',
    );

    expect(source).toMatch(/@\/constants\/(spacing|icons|sizes|zIndex)/);
  });
});
