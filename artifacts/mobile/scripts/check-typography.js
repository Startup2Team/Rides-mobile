#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const scanRoots = ['app', 'components', 'context', 'hooks', 'constants', 'utils']
  .map(dir => path.join(root, dir))
  .filter(dir => fs.existsSync(dir));

const allowedFiles = new Set([
  path.join(root, 'constants', 'fonts.ts'),
  path.join(root, 'constants', 'typography.ts'),
  path.join(root, 'components', 'AppText.tsx'),
  path.join(root, 'app', '_layout.tsx'),
]);

const ignoredPathParts = [
  `${path.sep}__tests__${path.sep}`,
  `${path.sep}__mocks__${path.sep}`,
  `${path.sep}generated${path.sep}`,
  `${path.sep}mocks${path.sep}`,
];

const violations = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.expo') continue;
      walk(fullPath);
      continue;
    }
    if (!/\.(ts|tsx)$/.test(entry.name)) continue;
    if (ignoredPathParts.some(part => fullPath.includes(part))) continue;
    scanFile(fullPath);
  }
}

function isAllowedException(file, lines, index, line) {
  const normalized = file.replace(/\\/g, '/');
  const previous = index > 0 ? lines[index - 1] : '';
  const exceptionComment = line.includes('typography-exception') || previous.includes('typography-exception');

  if (exceptionComment) return true;
  if (normalized.endsWith('/components/ErrorFallback.tsx') && line.includes('monoFont')) return true;
  if (line.includes('fontSize: size * 0.4')) return true;

  return false;
}

function addViolation(file, lineNumber, pattern, guidance) {
  violations.push({
    file: path.relative(root, file).replace(/\\/g, '/'),
    lineNumber,
    pattern,
    guidance,
  });
}

function scanFile(file) {
  if (allowedFiles.has(file)) return;

  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split(/\r?\n/);

  lines.forEach((line, index) => {
    if (isAllowedException(file, lines, index, line)) return;

    if (/fontFamily\s*:\s*['"]Inter_[^'"]+['"]/.test(line)) {
      addViolation(
        file,
        index + 1,
        'fontFamily: Inter_*',
        'Use AppText or typography token styles instead of raw Inter font families.',
      );
    }

    if (/fontWeight\s*:\s*['"][^'"]+['"]/.test(line)) {
      addViolation(
        file,
        index + 1,
        'fontWeight',
        'Use a typography variant or token fontFamily override instead of fontWeight.',
      );
    }

    if (/fontSize\s*:\s*\d/.test(line)) {
      addViolation(
        file,
        index + 1,
        'fontSize: <number>',
        'Use AppText variants or spread a typography token for TextInput and technical text.',
      );
    }
  });
}

scanRoots.forEach(walk);

if (violations.length) {
  console.error('Raw typography usage found:\n');
  violations.forEach(v => {
    console.error(`${v.file}:${v.lineNumber} ${v.pattern}`);
    console.error(`  ${v.guidance}`);
  });
  process.exit(1);
}

console.log('Typography check passed. No raw fontSize, fontWeight, or Inter fontFamily usage found.');
