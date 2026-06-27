import { readFileSync } from 'fs';
import { resolve } from 'path';

const PROFILE_SCREEN_FILES = [
  'app/(tabs)/profile.tsx',
  'app/(driver)/profile.tsx',
  'app/(driver)/index.tsx',
  'app/edit-profile.tsx',
  'app/change-phone-number.tsx',
  'app/driver-onboarding.tsx',
  'components/HomeTopHeader.tsx',
  'components/ProfileAvatarCircle.tsx',
];

describe('profile screen imports', () => {
  test('profile-facing files do not import profile persistence directly', () => {
    for (const file of PROFILE_SCREEN_FILES) {
      const content = readFileSync(resolve(process.cwd(), file), 'utf8');
      expect(content).not.toContain("from '@/persistence/profilePersistence'");
      expect(content).not.toContain("from '@/persistence/profilePersistence';");
    }
  });

  test('profile domain stays isolated from the driver domain', () => {
    const profileDomain = readFileSync(resolve(process.cwd(), 'domains/profile/hooks.ts'), 'utf8');
    expect(profileDomain).not.toContain("@/domains/driver");
    expect(profileDomain).not.toContain("@/domain/driver");
    expect(profileDomain).not.toContain("@/persistence/profilePersistence");
  });
});
