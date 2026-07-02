# Backend API Contracts

This document defines the production backend API blueprint for the mobile app.
It is a contract-only phase. No network behavior changes and no repository source
selection changes are introduced here.

## Endpoint Blueprint

### Auth

- `POST /v1/auth/otp/request`
- `POST /v1/auth/otp/verify`
- `POST /v1/auth/session/refresh`
- `POST /v1/auth/logout`

### Profile

- `GET /v1/profile/me`
- `PATCH /v1/profile/me`
- `POST /v1/profile/me/photo`
- `PATCH /v1/profile/me/phone`

### Driver

- `POST /v1/driver/applications`
- `POST /v1/driver/applications/{applicationId}/documents`
- `GET /v1/driver/applications/{applicationId}`
- `POST /v1/driver/applications/{applicationId}/clarifications`
- approval and rejection remain backend-admin actions

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
- `GET /v1/maps/reverse-geocode`
- `GET /v1/maps/route-estimate`
- `GET /v1/maps/fare-estimate`

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
