# Staging Backend Connection Checklist

Phase 13I introduces the formal machine-readable gate for deciding whether the
mobile app is safe to begin diagnostics-only `SHADOW_REMOTE` calls against the
real Rides Go staging backend.

This gate does not contact the backend. It evaluates checked-in evidence,
transport architecture facts, contract expectations, privacy and resilience
rules, and rollout rollback semantics.

## What It Answers

The gate answers a narrow question:

> Is the staging backend and the mobile integration contract-compatible enough
> to start real staging shadow calls for `savedLocations` and `profile`?

That is not the same as HYBRID readiness, remote authority, or production
readiness.

## Checklist Categories

- environment
- transport
- authentication
- contracts
- dataIsolation
- privacy
- observability
- resilience
- rateLimits
- rollback
- domainReadiness

Each category contains status-bearing items such as `passed`, `pending`,
`blocked`, `failed`, or `not_applicable`.

## Connection Readiness

The overall connection status is one of:

- `not_configured`
- `pending_evidence`
- `blocked`
- `ready_for_staging_shadow`

Default state stays conservative. Missing staging configuration normally stays
`not_configured` rather than failing the app.

## Contract Manifest

The mobile expectation lives in:

- `docs/contracts/staging-backend-contract-manifest.json`

That file is a contract expectation, not backend proof. It documents the HTTP
methods, paths, DTOs, idempotency expectations, and correlation expectations
the mobile app is prepared to use.

## Evidence File

The backend/infrastructure evidence lives in:

- `docs/staging/staging-connection-evidence.json`

It is sanitized and defaults to conservative unknown values. It may later be
updated when the backend team confirms:

- auth requirements and auth strategy
- staging/production isolation
- rate-limit policy
- endpoint contract confirmation

The evidence file must not contain real URLs, tokens, credentials, phone
numbers, customer data, or private names.

## CLI

Run the report with:

```bash
pnpm.cmd --dir artifacts/mobile run check:staging-connection
```

Useful flags:

- `--json`
- `--strict`
- `--evidence <path>`
- `--manifest <path>`

The CLI prints a readable report by default and exits safely when the staging
environment is not configured.

## Before Connecting The Real Staging URL

Before the real URL is wired in, the team should have:

- explicit staging environment configuration
- valid HTTPS base URL evidence
- approved auth strategy evidence when auth is required
- isolation evidence for staging vs production
- privacy evidence for telemetry and semantic comparison sanitization
- rate-limit evidence
- rollback semantics confirmed
- contract expectations reviewed against backend implementation

Only after that should the app begin diagnostics-only staging calls. Even then,
LOCAL remains authoritative.
