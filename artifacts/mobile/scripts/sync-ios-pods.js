#!/usr/bin/env node

// Keeps the generated ios/ Pods tree in sync with the JS dependency graph.
//
// ios/ is gitignored, so a branch switch or pull can move pnpm-lock.yaml and
// package.json without CocoaPods ever following. The app still builds and
// installs when that happens — but every native module added since the last
// `pod install` is missing from the binary. JS imports it, finds nothing, and
// the app dies at launch. Git cannot see that drift, so we fingerprint the
// inputs ourselves and re-run `pod install` when they move.

const { execFileSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const mobileRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(mobileRoot, '..', '..');
const iosDir = path.join(mobileRoot, 'ios');
const stampFile = path.join(iosDir, '.pods-stamp');
const podfileLock = path.join(iosDir, 'Podfile.lock');

// Only the parts of these files that decide which pods the app needs. Hashing
// whole files would rebuild pods for an unrelated script or version edit.
const fingerprintSources = [
  { file: path.join(repoRoot, 'pnpm-lock.yaml') },
  { file: path.join(iosDir, 'Podfile') },
  {
    file: path.join(mobileRoot, 'package.json'),
    pick: json => [json.dependencies, json.devDependencies],
  },
  {
    // Config plugins generate native code; the rest of app.json does not.
    file: path.join(mobileRoot, 'app.json'),
    pick: json => [json.expo && json.expo.plugins, json.expo && json.expo.sdkVersion],
  },
];

const args = process.argv.slice(2);
const isCheck = args.includes('--check');
const isForced = args.includes('--force');
// Records the current state as in-sync without running pod install — for after
// `expo run:ios`, which installs pods itself. Refuses if anything is missing.
const isSeed = args.includes('--seed');
const reasonIndex = args.indexOf('--reason');
const reason = reasonIndex === -1 ? null : args[reasonIndex + 1];

const label = '[ios-pods]';

function log(message) {
  console.log(`${label} ${message}`);
}

function fingerprint() {
  const hash = crypto.createHash('sha256');
  for (const { file, pick } of fingerprintSources) {
    hash.update(file);
    hash.update('\0');
    if (fs.existsSync(file)) {
      const raw = fs.readFileSync(file);
      hash.update(pick ? JSON.stringify(pick(JSON.parse(raw.toString('utf8')))) : raw);
    }
    hash.update('\0');
  }
  return hash.digest('hex');
}

function readStamp() {
  try {
    return fs.readFileSync(stampFile, 'utf8').trim();
  } catch {
    return null;
  }
}

// Every autolinked Expo module ships a podspec; its basename is the pod name
// CocoaPods writes into Podfile.lock. Comparing the two catches a pod install
// that silently missed a module, which a fingerprint alone would not.
function autolinkedPodNames() {
  const raw = execFileSync(
    'npx',
    ['expo-modules-autolinking', 'search', '-p', 'ios', '--json'],
    { cwd: mobileRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
  );

  const names = [];
  for (const module of Object.values(JSON.parse(raw))) {
    const declared = module.config && module.config.apple && module.config.apple.podspecPath;
    if (declared) {
      names.push(path.basename(declared, '.podspec'));
      continue;
    }
    for (const dir of ['ios', 'apple', '.']) {
      const candidate = path.join(module.path, dir);
      if (!fs.existsSync(candidate)) continue;
      const spec = fs.readdirSync(candidate).find(file => file.endsWith('.podspec'));
      if (spec) {
        names.push(path.basename(spec, '.podspec'));
        break;
      }
    }
  }
  return names;
}

function podsMissingFromLock() {
  if (!fs.existsSync(podfileLock)) return [];
  const lock = fs.readFileSync(podfileLock, 'utf8');
  const installed = new Set(
    Array.from(lock.matchAll(/^ {2}- ([^\s(/]+)/gm), match => match[1]),
  );
  return autolinkedPodNames().filter(name => !installed.has(name));
}

function runPodInstall() {
  const started = Date.now();
  log('running pod install (this takes a few minutes)...');
  execFileSync('npx', ['pod-install', 'ios'], { cwd: mobileRoot, stdio: 'inherit' });
  log(`pod install finished in ${Math.round((Date.now() - started) / 1000)}s`);
}

function skipReason() {
  if (process.platform !== 'darwin') return 'not macOS';
  if (process.env.CI) return 'CI';
  if (process.env.SKIP_POD_SYNC === '1') return 'SKIP_POD_SYNC=1';
  if (!fs.existsSync(iosDir)) return 'no ios/ directory';
  return null;
}

function main() {
  const skip = skipReason();
  if (skip) {
    if (isCheck || isForced || isSeed) log(`skipped (${skip})`);
    return 0;
  }

  if (isSeed) {
    const missing = podsMissingFromLock();
    if (missing.length > 0) {
      log(`refusing to seed — Podfile.lock is missing: ${missing.join(', ')}`);
      return 1;
    }
    fs.writeFileSync(stampFile, `${fingerprint()}\n`);
    log('recorded current pods as in sync.');
    return 0;
  }

  const current = fingerprint();
  const drifted = readStamp() !== current;

  if (!drifted && !isForced) {
    // Fingerprint matches, but confirm nothing slipped through a past install.
    let missing = [];
    try {
      missing = podsMissingFromLock();
    } catch {
      return 0; // Autolinking is a best-effort cross-check, never a blocker.
    }
    if (missing.length === 0) return 0;
    log(`Podfile.lock is missing autolinked module(s): ${missing.join(', ')}`);
  } else if (!isForced) {
    log(`native dependencies changed${reason ? ` after ${reason}` : ''}.`);
  }

  if (isCheck) {
    log('run `pnpm pods` in artifacts/mobile to resync.');
    return 1;
  }

  if (process.env.POD_SYNC_MODE === 'warn') {
    log('POD_SYNC_MODE=warn — run `pnpm pods` in artifacts/mobile before your next iOS build.');
    return 0;
  }

  try {
    runPodInstall();
  } catch (error) {
    log(`pod install failed: ${error.message}`);
    log('run `pnpm pods` in artifacts/mobile once the cause is fixed.');
    return 1;
  }

  try {
    const missing = podsMissingFromLock();
    if (missing.length > 0) {
      log(`WARNING: still missing after install: ${missing.join(', ')}`);
      return 1;
    }
  } catch {
    // Cross-check unavailable; the install itself succeeded.
  }

  fs.writeFileSync(stampFile, `${fingerprint()}\n`);
  log('iOS pods are in sync.');
  return 0;
}

process.exit(main());
