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

## Migration Strategy

The boundary exists so future backend work can swap sources behind the
resolver without screens needing to know whether data is local, mock, remote,
or hybrid.

## Rollout

The app should continue to default to local repositories until backend
integration is explicitly enabled in a later phase.
