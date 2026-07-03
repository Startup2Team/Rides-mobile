# Profile Staging Shadow

Phase 13B makes profile the second repository capable of talking to the real
Rides Go staging API in `SHADOW_REMOTE` mode.

This is diagnostics-only. Local profile behavior remains authoritative and the
staging result never replaces app state.

Phase 13C adds the centralized staging shadow health report for profile.
Profile now records local-operation, shadow-attempt, success, failure,
timeout, skip, and mismatch events into the in-memory report while staying
local-authoritative.

## Source Selection

Profile repository source selection is centralized in:

- `data/repositories/profileRepositoryFactory.ts`
- `data/remote/staging/createProfileStagingShadow.ts`

The app keeps importing the profile domain entry point. Screens, hooks, and
contexts do not read environment variables or create backend clients.

## Opt-In

Required:

```
EXPO_PUBLIC_BACKEND_ENV=STAGING
EXPO_PUBLIC_BACKEND_BASE_URL=https://placeholder-staging.example
EXPO_PUBLIC_PROFILE_REPOSITORY_MODE=SHADOW_REMOTE
```

Missing, invalid, production, or non-staging configuration falls back to
`LOCAL`.

`REMOTE` and `HYBRID` are not enabled through environment configuration in
Phase 13B.

## Read Shadow

Read flow:

1. Local profile result is returned first.
2. Staging is queried for diagnostics.
3. Staging success, failure, timeout, and semantic mismatch are recorded.
4. The remote result is ignored for UI and state.

## Write Shadow

Profile shadow writes are disabled by default.

```
EXPO_PUBLIC_PROFILE_SHADOW_WRITES_ENABLED=false
```

When disabled, the repository keeps local behavior and skips the staging write
with sanitized telemetry. When explicitly enabled, staging writes happen after
the local operation and the remote result is ignored.

This must not mutate `AuthContext`, session persistence, or the one-account
customer/driver identity model.

## Semantic Comparison

Safe comparisons focus on:

- profile existence
- display-name presence/category
- language/preference category
- photo presence
- phone presence/category where supported

Telemetry must not expose raw profile values, email addresses, phone numbers,
signed photo URLs, auth tokens, or backend secrets.

The health report is the diagnostics-only place to decide whether profile is a
future HYBRID candidate.

## Rollback

Rollback is configuration-only:

```
EXPO_PUBLIC_PROFILE_REPOSITORY_MODE=LOCAL
EXPO_PUBLIC_BACKEND_ENV=DISABLED
```

Because local remains authoritative, rollback does not require UI changes or
session migration.
