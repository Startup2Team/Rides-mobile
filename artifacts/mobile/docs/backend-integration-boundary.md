# Backend Integration Boundary

Phase 12A adds a backend-ready repository boundary without changing runtime
behavior.

## Repository Resolver

The repository resolver can choose one of four modes:

- `LOCAL`
- `REMOTE`
- `HYBRID`
- `SHADOW_REMOTE`

The default remains `LOCAL`, so existing screens continue to use the same
local-first behavior they already have.

## Remote Layer

The remote layer introduces stub repository implementations for every existing
repository contract. These stubs currently return typed failures such as
`BackendUnavailableError` or `NotImplementedError`.

## Shadow Remote

Shadow remote mode runs the local repository first, then executes the remote
path for diagnostics only. The remote result is ignored. Telemetry records
latency, result, fallback, and response shape without affecting the UI.

Phase 12C makes saved locations the first real remote repository prototype.
Its shadow execution is still diagnostics-only, and the app continues to read
the local repository result as authoritative.

Phase 12D adds the same prototype path for the shared profile repository.
The remote profile path can now be exercised in `SHADOW_REMOTE` mode for
diagnostics, but the local profile result still wins and the app behavior stays
unchanged.

Phase 12E adds the same prototype path for notifications.
The remote notification feed and read-state path can now be exercised in
`SHADOW_REMOTE` mode for diagnostics, but local notification state remains
authoritative and the current UI behavior stays unchanged.

Phase 12F adds the same prototype path for driver vehicles.
The remote vehicle list, detail, add, update, delete, and primary-selection
paths can now be exercised in `SHADOW_REMOTE` mode for diagnostics, but local
driver profile state remains authoritative and the current UI behavior stays
unchanged.

Phase 12G adds the same prototype path for packages and entitlements.
The remote package catalog, campaigns, available offers, entitlement,
purchases, activation, and credit-deduction paths can now be exercised in
`SHADOW_REMOTE` mode for diagnostics, but local package economics, credit
state, and purchase history remain authoritative and the current UI behavior
stays unchanged. Because this domain touches driver credits and payment-linked
flows, the package rollout path stays more conservative than the other
repositories.

Phase 12H adds the same prototype path for payment methods and billing
preferences.
The remote payment method list, default method, billing profile, create,
update, delete, and default-selection paths can now be exercised in
`SHADOW_REMOTE` mode for diagnostics, but local payment methods remain
authoritative and the current UI behavior stays unchanged. Payment execution,
capture, settlement, refunds, wallet balance, and transaction truth remain out
of scope for this phase and must stay separate from the prototype.

Phase 12I adds the first ride remote repository prototype as read-only.
The remote active ride, ride history, and ride detail paths can now be exercised
in `SHADOW_REMOTE` mode for diagnostics, but local/live-provider ride lifecycle
state remains authoritative and the current UI behavior stays unchanged. Ride
request, cancel, accept, decline, start, complete, matching, negotiation,
payment, package credit deduction, and realtime ride events remain out of scope
for this phase.

Phase 12J adds the remote driver onboarding and driver application prototype.
The remote driver application/profile, application status, submit/update,
document metadata/reference, clarification list, and clarification response
paths can now be exercised in `SHADOW_REMOTE` mode for diagnostics, but local
driver onboarding state remains authoritative. Remote review status never
changes role switching, driver capability, go-online eligibility, package
eligibility, vehicle behavior, or ride lifecycle behavior.

Driver approval authority remains backend/admin-owned in the future model.
Mobile repositories must not expose approve-driver, reject-driver, or
force-verification operations. Telemetry for driver shadow comparisons is
sanitized to safe semantic categories only and must not contain national ID,
DOB, license number, MoMo pay code, phone number, document contents, raw
document URLs, or signed URLs.

Phase 12K adds the remote auth repository prototype.
OTP dry-run, OTP verification, session refresh, logout, and current-session
paths can now be exercised in `SHADOW_REMOTE` diagnostics mode, but local
auth/session behavior remains authoritative. Shadow auth must never trigger a
real SMS-producing OTP endpoint. Remote `requestOtp` diagnostics must use a
backend non-delivery dry-run endpoint or fail closed as unavailable/not
implemented. Remote tokens and session responses are ignored and never mutate
`AuthContext` or token persistence.

Auth telemetry is sanitized. It may identify the repository operation, latency,
response shape, mismatch category, and masked phone suffix, but it must not
contain OTP codes, raw access tokens, raw refresh tokens, full phone numbers,
session secrets, or device secrets.

## Driver Statistics

The driver Statistics Phase 1 work adds only a local view model in
`domains/driver-statistics`. It does not add a backend statistics endpoint,
remote repository, DTO, mapper, or persistence source.

Current statistics remain local prototype data:

- period earnings and completed trips from local ride history;
- all-time totals and acceptance/decline values from the local driver profile;
- rating from local rating storage;
- package balance and purchase history from local entitlement state.

The view model uses source/confidence metadata and local device timezone
bucketing. Future backend integration must provide authoritative driver
analytics before the UI can claim server-backed trends, comparisons, or
Rwanda-timezone business boundaries.

Statistics Phase 2 turns that local model into the driver-facing Summary UI.
The screen now emphasizes earnings, completed trips, earnings efficiency,
rating/performance, truthful insights, and supporting profile totals. Package
history, Mobile Money details, and package balances are no longer primary
Statistics content. The mini visualizations are direct views of the Phase 1
buckets, and the circular summary visual is not an earnings goal or completion
progress indicator.

Phase 12L adds remote search and map repository prototypes.
Remote place search, autocomplete, place detail, reverse geocoding, route
estimate/preview, distance/duration estimate, and fare-preview paths can now be
exercised in `SHADOW_REMOTE` diagnostics mode. The current local/Mapbox path
remains authoritative. Remote search results never replace visible search
results, remote routes never replace visible Mapbox routes, and fare-preview
responses never become final pricing truth.

Search and map comparisons are tolerance-based. Search diagnostics compare safe
semantic fields such as result count, normalized names, categories, and
approximate coordinate parity. Map diagnostics compare route availability,
distance and duration deltas, coordinate parity, transport type, and fare
preview deltas within explicit tolerances. Small expected routing differences
must not be treated as critical mismatches.

Search/map telemetry is sanitized. It may include query length, result count,
operation, latency, distance/duration buckets, coarse coordinate buckets, and
mismatch category. It must not include exact home/saved-location addresses, raw
search query text, full route geometry, precise movement history, Mapbox
tokens, access tokens, or backend secrets.

Phase 12M adds the remote prototype readiness matrix.

- `data/remote/readiness/remoteReadinessMatrix.ts` centralizes the remote
  prototype maturity snapshot across auth, profile, saved locations,
  notifications, vehicles, packages, payment methods, ride reads, driver
  onboarding, search, and map
- the matrix is diagnostics-only and does not change repository resolution,
  UI, or local authority
- production and test defaults remain `LOCAL`; `SHADOW_REMOTE` still requires
  explicit resolver configuration
- the matrix separates contract readiness, shadow readiness, and safety
  readiness so the team can choose future staging candidates without promoting
  runtime authority too early
- financial, lifecycle, and identity/security domains retain extra gates
  before any future remote-authority rollout

Phase 13A introduces the first real staging backend transport boundary.

- `HttpBackendTransport` is the real API transport under `BackendClient`
- `FakeBackendTransport` remains automated-test-only
- saved locations can opt into real Go staging traffic in `SHADOW_REMOTE`
  diagnostics mode
- local saved locations remain authoritative and staging results are ignored
- staging read and write shadowing are independently controlled
- saved-location shadow writes default off because staging writes can create
  real staging data
- production does not automatically enable staging, `SHADOW_REMOTE`, `REMOTE`,
  or `HYBRID`
- timeout, retry, response mapping, and telemetry policy live in the transport
  layer rather than in screens or hooks

Phase 13B adds profile as the second real staging shadow integration.

- `RemoteProfileRepository` can now run against the real Go staging API through
  the profile staging factory
- local profile behavior remains authoritative
- profile shadow writes default off
- the one-account customer/driver identity model does not change
- `AuthContext`, session persistence, and profile screens remain unchanged
- staging failure, timeout, and mismatch behavior is diagnostics-only

Phase 13C adds the staging shadow health report.

- `data/remote/staging/health/` aggregates memory-only readiness metrics for
  saved locations and profile
- the report tracks local operations, shadow attempts, success/failure,
  timeout, skip, and mismatch outcomes
- the report does not change repository selection, UI behavior, or backend
  authority
- the report is the diagnostics surface used to decide when a staging-shadow
  domain may become a future HYBRID candidate

Phase 13D adds the developer and CI snapshot path.

- `data/remote/staging/health/stagingShadowHealthSnapshot.ts` wraps the
  in-memory report into a reviewable snapshot
- `scripts/report-staging-shadow-health.js` prints the snapshot without
  contacting the backend
- the CLI supports JSON export, output-file writing, and strict-mode failure
  gating for blocked or failing health only
- this remains diagnostics-only and does not alter runtime source selection or
  authority

Phase 13E adds CI artifact archiving.

- the mobile CI workflow uploads
  `artifacts/mobile/staging-health-report.json` as the GitHub Actions artifact
  named `staging-shadow-health-report`
- the archived JSON is sanitized and contains no backend calls or secrets
- the default `idle` / `collect_data` state is expected and is not a failure
- the artifact can be compared across runs to review readiness trendlines

Phase 13F adds baseline comparison.

- `scripts/compare-staging-health.js` compares the archived snapshot against
  the sanitized committed baseline
- non-strict mode warns on differences and exits `0`
- strict mode fails on regressions, new blockers, and large score drops
- the baseline is sanitized and only captures the expected safe default state
- this supports HYBRID review by making readiness drift visible before rollout
  posture changes
- score-drop sensitivity is configurable through
`STAGING_HEALTH_SCORE_DROP_THRESHOLD`

Phase 13G adds the HYBRID candidate review gate.

- `data/remote/readiness/hybridCandidateGate.ts` reads the same diagnostics
  data but does not change repository source selection
- `savedLocations` and `profile` can be reviewed as HYBRID candidates only
  after the metrics, docs, guardrail checks, and a human approval record all
  line up
- the checked-in approval file defaults both domains to unapproved
- HYBRID candidate status is not the same as enabling `HYBRID` mode in the
  resolver

Phase 13H adds the HYBRID rollout dry-run plan scaffold.

- `data/remote/readiness/hybridDryRunEvaluator.ts` evaluates the future
  HYBRID rollout path without changing runtime repository behavior
- `scripts/plan-hybrid-rollout.js` is a diagnostics-only CLI and does not
  contact the backend
- the dry-run plan is safe by default and recommends `disabled` until the
  evidence chain is complete
- the future runtime HYBRID switch must still be implemented in a separate PR

See [`hybrid-candidate-review.md`](./hybrid-candidate-review.md) for the
review workflow and approval semantics.

## Migration Strategy

The boundary exists so future backend work can swap sources behind the
resolver without screens needing to know whether data is local, mock, remote,
or hybrid.

## Rollout

The app should continue to default to local repositories until backend
integration is explicitly enabled in a later phase.

Phase 13I adds the staging backend connection checklist and contract gate.

- `data/remote/staging/connection/` validates backend connection evidence and
  the mobile contract expectation without calling the backend
- the gate covers `savedLocations` and `profile` and can expand to future
  staging-connected domains later
- `docs/staging/staging-connection-evidence.json` is the sanitized evidence
  record and `docs/contracts/staging-backend-contract-manifest.json` is the
  mobile-side contract expectation
- `ready_for_staging_shadow` means diagnostics-only staging calls may begin
  for a real backend URL, but it does not enable HYBRID or REMOTE authority

Phase 13J adds the backend staging evidence pack.

- `docs/backend-staging-evidence-pack.md` and
  `docs/backend-staging-questions.md` package the questions the Go backend
  team must answer before the first real staging probe
- `docs/contracts/saved-locations-staging-contract.md` and
  `docs/contracts/profile-staging-contract.md` spell out the mobile-side
  staging expectations for the two first connection-ready domains
- the evidence pack is documentation only and does not connect a URL, enable
  `SHADOW_REMOTE`, or alter repository source selection
