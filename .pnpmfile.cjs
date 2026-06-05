/**
 * pnpm hook file — modifies package manifests before pnpm processes them.
 *
 * WHY THIS EXISTS:
 * @sentry/node ≥8.x ships a `bin.node` entry (a profiling helper script).
 * @types/node also declares a fake `bin.node`.  When pnpm's `_linkBins` step
 * tries to deduplicate these two `node` bin entries across workspaces it calls
 * `semver.compare(a.pkgVersion, b.pkgVersion)` — but both entries carry an
 * empty pkgVersion in pnpm's internal registry, causing `new SemVer("")` to
 * throw "Invalid Version" and abort the entire install before the root-level
 * hoisting step completes.
 *
 * Strip `bin.node` from @sentry/node so pnpm only sees one `node` binary and
 * the comparison is never attempted.  The Sentry profiling binary is a
 * development/debug helper not needed at runtime.
 *
 * @see https://github.com/pnpm/pnpm/issues/8951
 */
function readPackage(pkg) {
  if (pkg.name === '@sentry/node' && pkg.bin?.node) {
    const { node: _removed, ...rest } = pkg.bin;
    pkg.bin = rest;
    // If bin is now empty, remove the field entirely so pnpm skips it.
    if (Object.keys(pkg.bin).length === 0) delete pkg.bin;
  }
  return pkg;
}

module.exports = { hooks: { readPackage } };
