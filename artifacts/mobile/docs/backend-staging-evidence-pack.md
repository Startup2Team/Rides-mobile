# Backend Staging Evidence Pack

Phase 13J packages the questions and contract evidence the mobile team needs
from the Go backend team before the app is allowed to connect to the real
staging backend.

This is documentation only. It does not connect a backend URL, enable
`SHADOW_REMOTE`, or change runtime behavior.

## Purpose

The evidence pack answers one narrow question:

> Is the real Rides Go staging backend ready for diagnostics-only mobile
> shadow calls for `savedLocations` and `profile`?

That question is separate from HYBRID readiness, remote authority, and
production readiness.

## What The Backend Team Must Confirm

### Staging Base URL

- the staging base URL exists
- the URL is separate from production
- the URL uses HTTPS unless the backend team explicitly documents a localhost
  development exception
- the URL is suitable for diagnostics-only mobile traffic

### Authentication Strategy

The backend team must confirm one of the following:

- authentication is not required for the staging calls
- authentication is required and the mobile app may use an injected token
  provider
- authentication is required and the backend provides a service test identity

If authentication is required, the backend team should also confirm how the
mobile app is expected to receive approved auth metadata without owning token
persistence.

### Endpoint Confirmation

The backend team should confirm the staging endpoints for:

- saved locations list/create/update/delete
- current profile read/update
- profile photo upload/update
- phone update

The mobile-side expected contracts are documented in:

- `docs/contracts/saved-locations-staging-contract.md`
- `docs/contracts/profile-staging-contract.md`

### DTO Examples

The backend team should review the request and response shapes documented in
the contract pages and confirm that the staging implementation matches the
same field names, nesting, and error shape conventions.

### Error Response Format

The mobile transport expects typed backend failures for:

- validation failures
- unauthorized or forbidden responses
- conflicts
- rate limiting
- server failures
- malformed JSON or shape mismatches

The backend team should confirm the canonical error body shape, status codes,
and any field-level validation envelope that the app should map into typed
repository errors.

### Rate-Limit Policy

The backend team should confirm:

- whether rate limiting is enabled in staging
- which requests it applies to
- whether `Retry-After` is emitted
- whether per-user, per-IP, or global limits are expected
- whether the staging limits match production policy closely enough for
  diagnostics

### Data Isolation

The backend team should confirm that staging is isolated from production for:

- database storage
- object storage
- credentials or secrets
- logs, traces, and monitoring namespaces where applicable

### Logging And Privacy

The backend team should confirm that staging logging and diagnostics do not
expose:

- exact addresses
- phone numbers
- tokens or secrets
- signed URLs
- private profile data
- raw request or response bodies in production-facing telemetry

### Rollback Expectations

The backend team should confirm the rollback expectation for the mobile app:

- if staging config is missing or invalid, the app remains `LOCAL`
- if shadow calls fail, time out, or mismatch, local results stay authoritative
- disabling the environment flags restores local-only behavior

## What The Mobile Team Will Send

The mobile team will send:

- this evidence pack
- the saved-locations staging contract page
- the profile staging contract page
- the staging connection checklist
- the sanitized staging evidence file
- the mobile contract manifest

## What The Backend Team Should Return

The backend team should return:

- the confirmed staging base URL
- the supported auth strategy
- endpoint confirmation or corrections
- DTO corrections if needed
- error response format confirmation
- rate-limit policy confirmation
- staging/prod isolation confirmation
- privacy/logging confirmation
- rollback confirmation

No production secret, customer data, or backend credential should be placed in
this package.
