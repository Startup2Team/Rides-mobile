import fs from 'node:fs';
import path from 'node:path';
import { DOMAIN_NAMES, DOMAIN_OWNERSHIP } from '../domainOwnership';

function read(file: string) {
  return fs.readFileSync(path.join(process.cwd(), file), 'utf8');
}

describe('domain architecture scaffold', () => {
  test('domain ownership map includes all required domains', () => {
    expect(DOMAIN_NAMES).toEqual([
      'auth',
      'profile',
      'booking',
      'ride',
      'driver',
      'vehicle',
      'saved-locations',
      'packages',
      'notifications',
      'payments',
      'search',
      'map',
      'shared',
    ]);
  });

  test('no domain claims another domain canonical state as its own', () => {
    const canonicalRepositories = new Set(Object.values(DOMAIN_OWNERSHIP).map(domain => domain.canonicalRepository));
    expect(canonicalRepositories.size).toBe(Object.keys(DOMAIN_OWNERSHIP).length);

    const ownershipValues = Object.values(DOMAIN_OWNERSHIP);
    for (const domain of ownershipValues) {
      for (const owned of domain.owns) {
        const ownedByCanonical = ownershipValues.some(other =>
          other !== domain && (other.canonicalRepository === owned || other.canonicalStore === owned),
        );
        expect(ownedByCanonical).toBe(false);
      }
    }
  });

  test('shared app role model is documented', () => {
    const docs = read('docs/state-data-architecture.md');
    expect(docs).toContain('One App, Two Role Projections');
    expect(docs).toContain('one authenticated user');
    expect(docs).toContain('role projections over the same account');
    expect(docs).toContain('Shared Identity Ownership');
  });

  test('repository docs mention the domain-first direction', () => {
    const docs = read('docs/repositories.md');
    expect(docs).toContain('domain-first');
    expect(docs).toContain('Screen -> Store/Context -> Repository -> Data Source');
  });

  test('domain READMEs exist for every domain', () => {
    for (const domain of DOMAIN_NAMES) {
      const readme = path.join(process.cwd(), 'domains', domain, 'README.md');
      expect(fs.existsSync(readme)).toBe(true);
    }
  });
});
