# Saved Locations Staging Shadow

Phase 13A makes saved locations the first repository capable of talking to the
real Rides Go staging API in `SHADOW_REMOTE` mode.

This is diagnostics-only. Local saved locations remain authoritative, and
remote staging results never replace UI results.

Phase 13C adds the centralized staging shadow health report for this domain.
Saved locations now records local-operation, shadow-attempt, success, failure,
timeout, skip, and mismatch events into the in-memory report while remaining
local-authoritative.

## Source Selection

Saved locations are selected in one controlled repository factory:

- `data/repositories/savedLocationsRepositoryFactory.ts`
- `data/remote/staging/createSavedLocationsStagingShadow.ts`

Screens, hooks, and providers continue importing the domain repository. They do
not read environment variables and do not create backend clients.

## Opt-In

Required for staging read shadow:

```
EXPO_PUBLIC_BACKEND_ENV=STAGING
EXPO_PUBLIC_BACKEND_BASE_URL=https://placeholder-staging.example
EXPO_PUBLIC_SAVED_LOCATIONS_REPOSITORY_MODE=SHADOW_REMOTE
```

Missing, malformed, invalid, production, or non-staging configuration falls
back to `LOCAL`.

`REMOTE` and `HYBRID` are not enabled through environment configuration in
Phase 13A.

## Read Shadow

Read flow:

1. Local repository reads complete first.
2. The local result is returned to the app.
3. Staging is queried for diagnostics.
4. Staging success, failure, timeout, and semantic mismatch are recorded as
   telemetry only.

Staging outages, slow responses, malformed responses, and mismatches do not
block customers or drivers.

## Write Shadow

Saved-location writes can create real staging data, so write shadowing is
disabled by default.

```
EXPO_PUBLIC_SAVED_LOCATIONS_SHADOW_WRITES_ENABLED=false
```

When false, local writes run normally and staging writes are skipped with
sanitized telemetry. When explicitly true in non-production staging shadow,
local writes run first, staging writes run second, and staging results are
ignored.

Production disables saved-location shadow writes.

## Parity

The staging comparison records safe semantic categories:

- result count
- normalized labels/types where available
- primary/default semantics when the domain supports them
- ordering semantics when required

Local IDs may differ from backend IDs, so ID differences are not critical
unless a future contract requires shared IDs.

Telemetry must not include raw addresses, exact coordinates, notes, phone
numbers, auth tokens, backend secrets, or credentials.

The health report stays memory only and is the place to decide whether saved
locations is ready to become a future HYBRID candidate.

## Rollback

Rollback is configuration-only:

```
EXPO_PUBLIC_SAVED_LOCATIONS_REPOSITORY_MODE=LOCAL
EXPO_PUBLIC_BACKEND_ENV=DISABLED
```

Because local remains authoritative, rollback does not require data migration
or UI changes.
