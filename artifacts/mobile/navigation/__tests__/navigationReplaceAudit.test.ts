import { readFileSync, readdirSync, statSync } from 'fs';
import path from 'path';

function collectFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(entry => {
    const fullPath = path.join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) return collectFiles(fullPath);
    return /\.(ts|tsx)$/.test(entry) ? [fullPath] : [];
  });
}

describe('navigation replace audit', () => {
  test('raw replace calls live only in the central navigation policy module', () => {
    const root = path.join(__dirname, '..', '..');
    const scanRoots = ['app', 'components', 'hooks', 'navigation'].map(segment => path.join(root, segment));
    const allowedFile = path.normalize(path.join(root, 'navigation', 'navigationPolicy.ts'));
    const violations: string[] = [];

    scanRoots
      .flatMap(dir => collectFiles(dir))
      .forEach(file => {
        if (file.includes(`${path.sep}__tests__${path.sep}`)) return;
        const source = readFileSync(file, 'utf8');
        if (!source.includes('router.replace(')) return;
        if (path.normalize(file) === allowedFile) return;
        violations.push(path.relative(root, file));
      });

    expect(violations).toEqual([]);
  });
});
