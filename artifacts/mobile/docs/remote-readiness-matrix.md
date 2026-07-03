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

