# Backend API Contracts

This document defines the production backend API blueprint for the mobile app.
It is a contract-only phase. No network behavior changes and no repository source
selection changes are introduced here.

## Endpoint Blueprint

### Auth

- `POST /v1/auth/otp/request`
- `POST /v1/auth/otp/request-dry-run`
- `POST /v1/auth/otp/verify`
- `POST /v1/auth/session/refresh`
- `GET /v1/auth/session/current`
- `POST /v1/auth/logout`

Phase 12K treats auth as a remote repository prototype in `SHADOW_REMOTE`.
The current local session and `AuthContext` remain authoritative. Shadow OTP
requests must use the non-delivery dry-run diagnostics endpoint only. The
mobile app must not call the real SMS-producing OTP request endpoint as a
shadow side effect.

### Profile

- `GET /v1/profile/me`
- `PATCH /v1/profile/me`
- `POST /v1/profile/me/photo`
- `PATCH /v1/profile/me/phone`

Phase 13J expands the profile staging review into:

- `docs/contracts/profile-staging-contract.md`

That page is the mobile-side expectation for diagnostics-only staging
connection review. It is not proof of backend implementation.

### Driver

- `POST /v1/driver/applications`
- `GET /v1/driver/applications/current`
- `PATCH /v1/driver/applications/{applicationId}`
- `GET /v1/driver/applications/{applicationId}/status`
- `GET /v1/driver/applications/{applicationId}/documents`
- `POST /v1/driver/applications/{applicationId}/documents`
- `GET /v1/driver/applications/{applicationId}/clarifications`
- `GET /v1/driver/applications/{applicationId}`
- `PATCH /v1/driver/applications/{applicationId}/clarifications/{clarificationId}`
- approval and rejection remain backend-admin actions

Phase 12J treats driver onboarding and driver applications as the next remote
repository prototype. The mobile app may validate application reads/writes,
document metadata references, review status reads, and clarification responses
in `SHADOW_REMOTE`, but it cannot approve, reject, force verification, or grant
driver capability. Backend review truth remains future authority.

### Vehicles

- `GET /v1/vehicles`
- `GET /v1/vehicles/{vehicleId}`
- `POST /v1/vehicles`
- `PATCH /v1/vehicles/{vehicleId}`
- `DELETE /v1/vehicles/{vehicleId}`
- `PATCH /v1/vehicles/{vehicleId}/primary`
- `POST /v1/vehicles/primary`

### Saved Locations

- `GET /v1/saved-locations`
- `POST /v1/saved-locations`
- `PATCH /v1/saved-locations/{locationId}`
- `DELETE /v1/saved-locations/{locationId}`

Phase 13J expands the saved-locations staging review into:

- `docs/contracts/saved-locations-staging-contract.md`

That page is the mobile-side expectation for diagnostics-only staging
connection review. It is not proof of backend implementation.

### Rides

- `POST /v1/rides/request`
- `POST /v1/rides/{rideId}/cancel`
- `POST /v1/rides/{rideId}/accept`
- `POST /v1/rides/{rideId}/decline`
- `POST /v1/rides/{rideId}/start`
- `POST /v1/rides/{rideId}/complete`
- `GET /v1/rides/active`
- `GET /v1/rides/history`
- `GET /v1/rides/{rideId}`

Phase 12I treats rides as a read-only remote repository prototype. Only active
ride, ride history, and ride detail reads are exercised in `SHADOW_REMOTE`.
Ride request, cancel, accept, decline, start, complete, payment, matching,
negotiation, package credit deduction, and realtime ride events remain future
work and stay on the existing local/live-provider path.

### Packages

- `GET /v1/packages/catalog`
- `GET /v1/packages/campaigns`
- `GET /v1/packages/offer-source`
- `GET /v1/packages/offers`
- `GET /v1/packages/entitlements`
- `GET /v1/packages/purchases`
- `POST /v1/packages/purchases`
- `PATCH /v1/packages/purchases/{transactionId}/status`
- `POST /v1/packages/purchases/{purchaseId}/activate`
- `POST /v1/packages/credits/deduct`

### Payments

- `GET /v1/payments/methods`
- `GET /v1/payments/methods/default`
- `GET /v1/payments/billing-profile`
- `POST /v1/payments/methods`
- `PATCH /v1/payments/methods/{methodId}`
- `DELETE /v1/payments/methods/{methodId}`
- `PATCH /v1/payments/methods/{methodId}/default`
- `POST /v1/payments/authorize`
- `POST /v1/payments/capture`
- `POST /v1/payments/refunds` in a future phase

Phase 12H treats payment methods and billing preferences as the sixth remote
repository prototype. Only the method list, default method, billing profile,
and payment-method CRUD/default-selection contracts are in scope. Payment
authorization, capture, settlement, refunds, wallet balance, and transaction
truth stay out of scope for this phase.

### Notifications

- `GET /v1/notifications`
- `GET /v1/notifications/unread-count`
- `POST /v1/notifications/{notificationId}/read`
- `POST /v1/notifications/read-all`

### Search and Map

- `GET /v1/search/autocomplete`
- `POST /v1/search/places`
- `GET /v1/search/places/{placeId}`
- `POST /v1/search/reverse-geocode`
- `GET /v1/maps/reverse-geocode`
- `POST /v1/maps/reverse-geocode`
- `GET /v1/maps/route-estimate`
- `POST /v1/maps/route-estimate`
- `POST /v1/maps/route-preview`
- `POST /v1/maps/distance-estimate`
- `POST /v1/maps/duration-estimate`
- `GET /v1/maps/fare-estimate`
- `POST /v1/maps/fare-estimate`

Phase 12L treats search and map as remote repository prototypes in
`SHADOW_REMOTE`. Current Mapbox/local search, geocoding, route rendering,
booking, matching, navigation, and pricing behavior remain authoritative.
Backend map/search authority is future work. Fare estimates are preview-only
and must not be treated as final fare truth.

### Admin Review

- `GET /v1/admin/reviews`

## DTO Strategy

- Request and response DTOs are defined per API domain.
- Pagination uses shared cursor/limit request DTOs and `nextCursor` / `hasMore`
  response fields.
- Write DTOs always carry idempotency and correlation metadata when the route
  can mutate server state.
- Read DTOs are shaped to mirror domain read models closely enough for safe
  mapping without leaking transport details into the UI.
- Packages additionally define offer-source, available-offers, purchase-status,
  activation, and credit-deduction DTOs so the remote prototype can exercise
  the full balance and entitlement contract without changing local authority.
- Ride read DTOs map active ride read models directly and map ride history/detail
  responses back into the existing `Ride` UI/domain shape. Ride write DTOs remain
  contract-only until lifecycle mutation ownership moves backend-side.
- Driver onboarding DTOs keep application identity, review status, document
  metadata, upload/reference keys, and clarification messages explicit at the
  backend boundary. Raw document bytes and base64 payloads are not part of these
  DTOs.
- Auth DTOs cover OTP dry-run request metadata, OTP verification, session
  refresh, logout, and current-session reads. Token values stay at the remote
  repository boundary during this prototype and do not change mobile token
  persistence.
- Search DTOs carry query metadata, place identity, display names, approximate
  coordinates, category/type, city/district, and relevance metadata for
  semantic diagnostics. Raw address queries should not be emitted through
  telemetry.
- Map DTOs carry route estimate/preview data, distance, duration, route bounds,
  optional geometry references, transport type, estimate timestamps, and
  fare-preview metadata. Full route geometry must not be logged by diagnostics.

## Mapper Strategy

- Each domain receives three mapper directions:
  - `dtoToDomain`
  - `domainToDto`
  - `errorToRepositoryFailure`
- The initial implementation is scaffold-only.
- Mapper behavior is intentionally conservative and does not change runtime
  repository selection.

## Error Strategy

- Backend transport and contract failures are normalized into typed repository
  failures.
- Supported failure classes include:
  - `BackendUnavailableError`
  - `UnauthorizedError`
  - `ForbiddenError`
  - `ConflictError`
  - `ValidationError`
  - `RateLimitedError`
  - `ServerError`
  - `TimeoutError`
  - `OfflineError`
  - `SerializationError`

## Idempotency and Correlation

Write requests should always include:

- `idempotencyKey`
- `correlationId`
- `actorId`
- `actorRole`
- `clientTimestamp`

This applies to ride lifecycle writes, payment method mutations, package
mutations, saved location mutations, and driver onboarding submissions.

Driver onboarding follows the one-account model:

1. Account identity
2. Driver application
3. Backend review
4. Driver capability granted
5. Driver mode eligibility

The driver application never creates a second user identity. Mobile-submitted
application data is review input only; mobile cannot manufacture verified status
or self-approve a driver.

## Versioning

- API routes are versioned at the URL level using `/v1/...`.
- DTOs may carry a `version` field in envelopes when needed.
- Event payload versioning remains compatible with existing event-platform
  rules.
- Breaking DTO changes require a new DTO version or a new route version.

## Rollout Strategy

The backend resolver progresses through these stages:

1. `LOCAL`
2. `SHADOW_REMOTE`
3. `HYBRID`
4. `REMOTE`

`LOCAL` remains the default until remote behavior is proven safe.
`SHADOW_REMOTE` records remote diagnostics without affecting the UI.
`HYBRID` can mix local and remote sources with fallback behavior.
`REMOTE` is reserved for a future migration phase.

Saved locations is the first repository to gain a concrete remote prototype.
It can run in `SHADOW_REMOTE` mode for diagnostics while local remains the
authoritative source of truth.

Profile is the second repository to gain a concrete remote prototype.
The shared identity contract can be exercised in `SHADOW_REMOTE` mode for
diagnostics, while local profile persistence remains authoritative and the
current customer/driver one-account model stays unchanged.

Notifications are the third repository to gain a concrete remote prototype.
The feed, unread count, mark read/unread, mark-all-read, and clear contracts
can be exercised in `SHADOW_REMOTE` mode for diagnostics, while local
notification state remains authoritative and the current notification UI stays
unchanged.

Driver vehicles are the fourth repository to gain a concrete remote prototype.
The list, detail, add, update, delete, and primary-selection contracts can be
exercised in `SHADOW_REMOTE` mode for diagnostics, while local driver profile
state remains authoritative and the current UI stays unchanged. Vehicle
verification and approval remain backend-owned in the future rollout model.

Packages and entitlements are the fifth repository to gain a concrete remote
prototype. The catalog, campaigns, offer source, available offers,
entitlements, purchases, purchase-status updates, activation, and credit
deduction contracts can be exercised in `SHADOW_REMOTE` mode for diagnostics,
while local package economics and credit state remain authoritative. Because
this domain touches driver balance and payment-linked flows, rollout should
remain more conservative than the earlier repository prototypes.

Payment methods and billing preferences are the sixth repository to gain a
concrete remote prototype. The method list, default method, billing profile,
create, update, delete, and default-selection contracts can be exercised in
`SHADOW_REMOTE` mode for diagnostics, while local payment methods remain
authoritative. Payment execution and transaction truth stay future backend
work, and this prototype must not be used to infer settlement behavior.

Rides are the seventh repository to gain a concrete remote prototype. Active
ride, ride history, and ride detail reads can be exercised in `SHADOW_REMOTE`
mode for diagnostics, while local/live-provider ride lifecycle behavior remains
authoritative. Ride lifecycle mutations, matching, negotiation, payment,
package credit deduction, and realtime ride-event integration remain future
work.

Driver onboarding is the eighth repository to gain a concrete remote prototype.
Driver application/profile reads, application status, submit/update application,
document metadata/reference submission, clarification reads, and clarification
responses can be exercised in `SHADOW_REMOTE` mode for diagnostics. Local
driver onboarding state and current approval behavior remain authoritative.
Document telemetry must be sanitized and must not include national ID, DOB,
license number, MoMo pay code, phone number, document contents, or sensitive
document URLs.

Auth is the ninth repository to gain a concrete remote prototype. OTP dry-run,
OTP verification, session refresh, logout, and current-session contracts can be
exercised in `SHADOW_REMOTE` diagnostics mode, while local auth/session
behavior remains authoritative. Backend support for a non-delivery OTP
diagnostics endpoint is required before shadow OTP validation can be enabled.
Shadow auth telemetry must not emit OTP codes, raw tokens, full phone numbers,
session secrets, refresh tokens, access tokens, or device secrets.

Search and Map are the tenth repository prototypes. Place search,
autocomplete, place detail, reverse geocoding, route estimates/previews,
distance/duration estimates, and fare-preview contracts can be exercised in
`SHADOW_REMOTE` diagnostics mode. Local/Mapbox behavior remains authoritative.
Comparisons are tolerance-based: search uses semantic overlap instead of exact
ranking equality, and map diagnostics allow coordinate, distance, duration, and
fare-preview drift. Fake backend transport is automated-test-only.

Phase 12M adds a centralized readiness matrix that scores every remote
prototype for future staging selection. The matrix is diagnostics-only and
does not change any API contract, runtime authority, or repository default.
It exists so later Go backend work can stage domains in a controlled order
after the contract, shadow, and safety gates are satisfied.

The current rollout priority reflected by the matrix is:

1. saved locations
2. profile
3. payment methods
4. notifications
5. vehicles
6. ride reads
7. driver onboarding
8. search
9. map
10. auth
11. packages
