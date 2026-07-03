# Remote Readiness Matrix

Phase 12M adds a centralized diagnostics-only readiness matrix for the
existing remote repository prototypes.

The matrix does not change runtime behavior, repository source selection, or
local authority. It evaluates remote prototype maturity so the team can choose
future staging targets without inferring production readiness from runtime
state.

## Included Domains

- auth
- profile
- savedLocations
- notifications
- vehicles
- packages
- paymentMethods
- rideReads
- driverOnboarding
- search
- map

Optional placeholders remain tracked for future work:

- rideCommands
- realtimeEvents
- paymentTransactions
- wallet
- adminReview

## Evaluation Categories

Each domain records:

- contract readiness
- shadow readiness
- safety readiness
- risk category
- rollout recommendation

## Risk Categories

- low
- medium
- high
- financial
- lifecycle
- identity/security

## Rollout Recommendations

- `not_ready`
- `shadow_only`
- `staging_shadow_candidate`
- `hybrid_candidate`
- `remote_candidate`

The current recommended rollout order starts with:

1. savedLocations
2. profile
3. paymentMethods
4. notifications
5. vehicles
6. rideReads
7. driverOnboarding
8. search
9. map
10. auth
11. packages

## Phase 13 Strategy

Phase 13 should use this matrix to choose the first real backend staging
integrations. The matrix is informational only until the backend authority and
token/session, financial, lifecycle, and privacy gates are explicitly signed
off.

## Phase 13A Update

Saved locations is the first real staging shadow integration.

- readiness remains `staging_shadow_candidate`, not remote authority
- `LOCAL` is still the default and authoritative runtime source
- staging shadow requires explicit saved-location repository mode and backend
  staging configuration
- read shadow can be enabled without write shadow
- write shadow defaults off and is disabled in production
- production cannot accidentally use staging configuration

This does not promote saved locations, profile, or any other domain to
`HYBRID` or `REMOTE`.

## Phase 13B Update

Profile is the second real staging shadow integration.

- readiness remains `staging_shadow_candidate`, not remote authority
- `LOCAL` is still the default and authoritative runtime source
- profile shadow requires explicit repository mode and backend staging
  configuration
- read shadow can be enabled without write shadow
- write shadow defaults off and is disabled in production
- production cannot accidentally use staging configuration
- the one-account customer/driver model remains unchanged

## Phase 13C Update

The staging shadow health report is the diagnostics surface for deciding when a
domain may become a future HYBRID candidate.

- the report aggregates saved locations and profile events in memory
- health status comes from actual shadow attempts, success, failure, timeout,
  skip, and mismatch events
- `collect_data` means there are no shadow attempts yet
- `continue_shadow` means the domain has data but not enough healthy sample
  size for promotion
- `ready_for_hybrid_candidate` means the domain has enough healthy staging
  data to review for a future HYBRID rollout
- production guard blocks keep the report `blocked` for that domain

## Phase 13D Update

The staging health snapshot is the developer and CI surface for reading the
same readiness data in a reviewable form.

- `scripts/report-staging-shadow-health.js` does not contact the backend
- JSON export and output-file writing are available for CI capture
- strict mode only fails on blocked or failing snapshot status
- the default command is safe when no staging data exists
- this snapshot helps the team decide when a domain is ready for HYBRID
  candidate review
