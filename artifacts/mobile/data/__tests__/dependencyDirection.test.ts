import fs from 'node:fs';
import path from 'node:path';

function collectFiles(root: string, predicate: (file: string) => boolean, results: string[] = []) {
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      collectFiles(full, predicate, results);
      continue;
    }
    if (predicate(full)) results.push(full);
  }
  return results;
}

describe('data dependency direction', () => {
  test('data layer does not import screens or components', () => {
    const root = path.resolve(process.cwd(), 'data');
    const files = collectFiles(
      root,
      file => (file.endsWith('.ts') || file.endsWith('.tsx')) && !file.includes('__tests__'),
    );
    const violations = files.filter(file => {
      const contents = fs.readFileSync(file, 'utf8');
      return contents.includes('@/app') || contents.includes('@/components');
    });
    expect(violations).toEqual([]);
  });
});
