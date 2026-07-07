// EAS-build post-install hook.
//
// In this pnpm monorepo (node-linker=hoisted), `@expo/metro-config` ends up in
// the workspace-root node_modules while `expo` (a direct dep of this package)
// stays in artifacts/mobile/node_modules. The Metro transformer's moduleMapper
// does `require.resolve('expo/package.json')` from the root, which then fails
// with "Cannot find module 'expo/package.json'" and breaks the JS bundle phase.
//
// Bridging a symlink `<root>/node_modules/expo -> artifacts/mobile/node_modules/expo`
// makes expo resolvable from the root, exactly as it works locally. Idempotent
// and best-effort so it never fails the build.
const fs = require('fs');
const path = require('path');

try {
  const mobileDir = path.resolve(__dirname, '..'); // artifacts/mobile
  const workspaceRoot = path.resolve(mobileDir, '..', '..'); // repo root
  const rootExpo = path.join(workspaceRoot, 'node_modules', 'expo');
  const mobileExpo = path.join(mobileDir, 'node_modules', 'expo');

  if (fs.existsSync(rootExpo)) {
    console.log('[eas-link-expo] root expo already resolvable — no link needed');
  } else if (fs.existsSync(mobileExpo)) {
    fs.mkdirSync(path.dirname(rootExpo), { recursive: true });
    fs.symlinkSync(mobileExpo, rootExpo, 'dir');
    console.log('[eas-link-expo] linked', rootExpo, '->', mobileExpo);
  } else {
    console.log('[eas-link-expo] expo not found in mobile node_modules — skipping');
  }
} catch (error) {
  console.warn('[eas-link-expo] non-fatal:', error.message);
}
