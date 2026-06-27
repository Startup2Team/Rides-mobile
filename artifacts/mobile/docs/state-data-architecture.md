# State And Data Architecture Blueprint

Status: target architecture blueprint for the mobile app. This document describes the intended ownership model and migration path. It does not change runtime behavior.

## 1. Principles

1. Separate state by ownership.
   - UI state
   - client draft state
   - domain state
   - server state
   - cached state
   - persisted sensitive state
   - real-time event state
2. Screens do not own domain truth.
3. Screens do not write directly to persistence.
4. Contexts stay small and cross-cutting only.
5. Repositories own data-source boundaries.
6. TanStack Query owns server and cacheable state.
7. Focused client stores own client-only draft and transient domain state.
8. Active ride lifecycle becomes event-driven.
9. Persistence is schema-versioned and validated.
10. Backend-affecting mutations use idempotency keys.

## One App, Two Role Projections

Rides is one application with one authenticated user and one shared session. Customer mode and driver mode are role projections over the same account, not separate apps.

Shared state:
- auth/session
- user profile
- role/mode
- notifications
- settings
- saved places
- payment methods

Customer domain state:
- booking draft
- active customer ride
- ride history
- saved-place search draft

Driver domain state:
- driver profile
- driver availability
- active vehicle session
- driver ride request
- driver packages and entitlements
- documents and verification

Transient flow state:
- search flow
- map picker flow
- form drafts

Why this matters:
- switching modes must not fork identity
- the same customer can later become a driver without duplicating account data
- a driver can still use customer booking flows in the same app session
- shared state reduces reconciliation bugs and makes scaling safer across 100M+ customers and 50M+ drivers
- role projections stay lightweight while the account remains unified

What must never be duplicated:
- auth/session ownership
- user identity
- saved-place canonical data
- payment method identity
- active vehicle session truth
- active ride truth
- backend-side entitlements

## 2. Target State Categories

### 2.1 UI State

Examples:
- sheet open or closed
- selected tab
- spinner visibility
- local focus and keyboard state
- animation progress

Owner:
- screen component local state

Rules:
- Never persist.
- Never become a source of truth for business data.

### 2.2 Client Draft State

Examples:
- booking draft
- pickup and destination draft
- selected vehicle
- saved-place form draft
- map picker transient session

Owner:
- focused store or reducer, not screen-local state

Rules:
- May survive navigation.
- May reset on flow completion, cancel, logout, or TTL expiry.
- Must not be treated as authoritative domain truth.

### 2.3 Server Or Cacheable State

Examples:
- profile
- saved locations
- ride history
- notifications
- driver vehicles
- driver stats
- package catalog and campaigns

Owner:
- TanStack Query

Rules:
- Cached and refetched through query keys.
- Backed by repository adapters.
- Invalidated on relevant mutations.

### 2.4 Sensitive Persisted State

Examples:
- session
- auth tokens
- profile secrets
- payment tokens

Owner:
- SecureStore plus repository wrapper

Rules:
- Never in AsyncStorage.
- Never in plain screen state as the durable copy.
- Clear on logout.

### 2.5 Offline Or Cache Persisted State

Examples:
- package catalog cache
- route cache
- saved places cache
- profile cache

Owner:
- repository plus storage adapter, with optional query persistence

Rules:
- Schema-versioned.
- Validated on load.
- Safe to discard and rebuild.

### 2.6 Real-Time State

Examples:
- active ride status
- driver live location
- ETA
- negotiation events
- cancellation events

Owner:
- event stream gateway plus ride projection store

Rules:
- Applied through events, not ad hoc screen writes.
- Deduplicate by event id.
- Reject stale sequence numbers.

## 3. Store Blueprint

These stores are the target client state layer. They are not implemented in this phase.

### 3.1 `artifacts/mobile/state/bookingStore.ts`

Purpose:
- Own the customer booking draft across home, search, map picker, and ride entry points.

Owns:
- pickup draft
- destination draft
- selected vehicle
- fare estimate draft
- booking flow status
- cancelled draft restoration

Must not own:
- active ride lifecycle
- persisted saved places
- auth/session
- server-side fare truth

Lifecycle:
- created when the app session starts
- reset on booking completion, cancellation, logout, or account switch

Persistence:
- optional short-lived persistence for recovery
- never authoritative without a server or repository source

Reset rules:
- clear on successful booking submission
- restore on cancel when product requires it
- clear on logout

Relationship to repositories/query:
- consumes profile, saved locations, and route/cache data through queries
- does not write directly to storage

### 3.2 `artifacts/mobile/state/rideStore.ts`

Purpose:
- Hold the active ride projection and local guards around event application.

Owns:
- active ride projection
- current ride UI projection
- last applied event sequence
- local transition guards

Must not own:
- booking draft
- saved locations
- package catalog
- persisted auth/session

Lifecycle:
- created per authenticated app session
- hydrates from event store or backend snapshot

Persistence:
- projection snapshot can be persisted for recovery
- source of truth remains event stream or server snapshot

Reset rules:
- clear on terminal ride completion when projection is archived
- clear on logout
- reconcile on app resume

Relationship to repositories/query:
- reads authoritative ride data from ride repository or event gateway
- exposes derived UI-friendly projection only

### 3.3 `artifacts/mobile/state/searchStore.ts`

Purpose:
- Hold search draft state for location search and related routes.

Owns:
- current search target
- query text
- selected suggestion draft
- recent search session state

Must not own:
- saved locations persistence
- booking truth
- active ride truth

Lifecycle:
- route-scoped or flow-scoped

Persistence:
- usually none
- temporary only

Reset rules:
- clear on route exit, cancel, or target change

Relationship to repositories/query:
- drives geocoding/search queries
- consumes saved locations and recent history through queries

### 3.4 `artifacts/mobile/state/mapPickerStore.ts`

Purpose:
- Hold the transient map picker session and one-time result handoff.

Owns:
- temporary map picker session
- selection result
- session TTL
- one-time consume logic

Must not own:
- saved-place canonical persistence
- booking truth beyond the current handoff
- ride lifecycle

Lifecycle:
- created on route entry
- destroyed or expired on confirm, cancel, or TTL timeout

Persistence:
- no durable persistence
- optional in-memory only

Reset rules:
- clear after consume
- clear on cancel/back
- clear on TTL expiry

Relationship to repositories/query:
- writes back to booking or saved-place store, not directly to screen state

### 3.5 `artifacts/mobile/state/driverSessionStore.ts`

Purpose:
- Hold driver availability and online session draft state.

Owns:
- online/offline mode
- selected active vehicle session
- driver availability draft
- local online transition state

Must not own:
- long-term driver profile truth
- package catalog
- ride lifecycle truth

Lifecycle:
- created for authenticated driver session
- resets on logout, mode switch, or offline completion

Persistence:
- optional short-lived recovery state only

Reset rules:
- clear on logout
- clear when switching modes
- clear when session vehicle changes

Relationship to repositories/query:
- consumes driver profile, entitlement, and vehicle data through repositories/query

## 4. Repository Blueprint

Repositories define source boundaries. Each repository can have local, cached, and backend implementations later.

### 4.1 `AuthRepository.ts`

Responsibility:
- session identity
- login/logout
- token refresh
- current user and mode

Current local implementation:
- SecureStore-backed persistence

Future backend implementation:
- auth API
- refresh token rotation
- session revocation

Cache behavior:
- session and identity cached in memory and secure storage

Persistence behavior:
- SecureStore only for sensitive data

Error behavior:
- auth errors are terminal for the session
- network errors must not corrupt the local session

Idempotency expectations:
- login/logout/revoke operations should be safe to repeat

### 4.2 `ProfileRepository.ts`

Responsibility:
- user profile
- driver profile summary
- profile image metadata

Current local implementation:
- secure persistence plus local merge logic

Future backend implementation:
- profile fetch/update endpoints

Cache behavior:
- query cache plus secure fallback for sensitive profile fields

Persistence behavior:
- SecureStore for sensitive profile state

Error behavior:
- validation errors should not overwrite a good cached profile

Idempotency expectations:
- profile update mutation should use stable idempotency when backend-affecting

### 4.3 `SavedLocationsRepository.ts`

Responsibility:
- saved locations CRUD
- ordering and normalization

Current local implementation:
- secure storage

Future backend implementation:
- user-scoped saved location API

Cache behavior:
- TanStack Query list cache plus offline fallback

Persistence behavior:
- secure or encrypted local storage if sensitive location policy requires it

Error behavior:
- partial failures should not erase the previous list

Idempotency expectations:
- create/update/delete should be idempotent by saved-place id

### 4.4 `RideRepository.ts`

Responsibility:
- ride lifecycle commands
- active ride snapshot
- history projection
- negotiation and cancellation

Current local implementation:
- local ride engine and ride history persistence

Future backend implementation:
- event stream gateway
- command API
- active ride snapshot fetch

Cache behavior:
- active ride projection cache plus history cache

Persistence behavior:
- snapshot or event cursor persistence

Error behavior:
- stale or duplicate events must be ignored

Idempotency expectations:
- every command uses a stable idempotency key

### 4.5 `DriverRepository.ts`

Responsibility:
- driver identity
- driver profile
- driver availability
- ratings summary
- driver session state

Current local implementation:
- AuthContext and driver-specific persistence

Future backend implementation:
- driver profile API
- online status API
- ratings summary API

Cache behavior:
- query cache with local fallback

Persistence behavior:
- secure storage for sensitive driver identity state

Error behavior:
- backend rejection should not destroy the local profile immediately

Idempotency expectations:
- profile or session mutations must be safe to repeat

### 4.6 `VehicleRepository.ts`

Responsibility:
- driver vehicles
- vehicle documents
- verification status

Current local implementation:
- secure persistence plus local domain normalization

Future backend implementation:
- vehicle list and document APIs

Cache behavior:
- query cache plus local persisted fallback

Persistence behavior:
- secure storage for sensitive and verification-related data

Error behavior:
- invalid vehicle documents should be isolated to the affected record

Idempotency expectations:
- update submissions must use stable submission ids

### 4.7 `PackageRepository.ts`

Responsibility:
- package catalog
- campaigns
- entitlement
- purchase/activation

Current local implementation:
- cached local repositories plus entitlement persistence

Future backend implementation:
- package catalog API
- campaign API
- entitlement API
- purchase and activation APIs

Cache behavior:
- TanStack Query plus persisted cache

Persistence behavior:
- cacheable state in AsyncStorage
- entitlement and purchase history in secure storage if still sensitive

Error behavior:
- partial refresh should not replace a valid full catalog generation

Idempotency expectations:
- purchase and activation must be idempotent

### 4.8 `NotificationRepository.ts`

Responsibility:
- notification feed
- read and unread state
- notification actions

Current local implementation:
- local read-state storage

Future backend implementation:
- feed API
- read-state sync API

Cache behavior:
- query cache for feed
- persisted local read-state for recovery

Persistence behavior:
- cacheable data in AsyncStorage

Error behavior:
- feed refresh failures must not erase local read-state

Idempotency expectations:
- marking read or unread should be idempotent

### 4.9 `PaymentRepository.ts`

Responsibility:
- payment methods
- package purchase flows
- payment authorization

Current local implementation:
- secure persistence and local simulation

Future backend implementation:
- payment method API
- wallet and package checkout API

Cache behavior:
- query cache for payment methods and receipts

Persistence behavior:
- SecureStore for sensitive payment metadata

Error behavior:
- payment failures must preserve the user input and allow retry

Idempotency expectations:
- every purchase authorization must use a stable key

## 5. TanStack Query Blueprint

### 5.1 Naming Convention

Use domain-first query keys.

Examples:
- `profileKeys.current()`
- `savedLocationKeys.list(userId)`
- `rideKeys.history(userId)`
- `driverKeys.vehicles(driverId)`
- `packageKeys.catalog(vehicleType)`
- `notificationKeys.list(userId)`

Key rules:
- scalar identifiers only
- avoid ad hoc string concatenation in screens
- use shared factories

### 5.2 Suggested Query Surface

Use `useQuery` for:
- profile
- saved locations
- ride history
- driver vehicles
- driver stats
- notifications
- package catalog
- package campaigns

Use `useMutation` for:
- profile update
- saved location create/update/delete
- package activation
- package purchase
- notification read state changes
- ride commands once backend exists

Use infinite query for:
- ride history pagination
- notifications pagination

Use optimistic update for:
- notification read state
- saved location create/update/delete when the backend supports it
- profile display updates
- selected vehicle state if backend tolerates it

Use background refetch for:
- package catalog
- notifications
- profile
- driver vehicles
- saved locations

Use offline cache for:
- package catalog and campaigns
- profile snapshot
- saved locations list
- ride history summary

### 5.3 Suggested Stale Times

- profile: short to medium
- saved locations: medium
- ride history: medium
- driver vehicles: medium
- driver stats: short
- notifications: short
- package catalog/campaigns: medium to long

### 5.4 Invalidation Rules

- login/logout invalidates all user-scoped queries
- profile update invalidates profile and dependent UI
- saved place mutation invalidates saved locations
- ride completion invalidates active ride and history
- package activation invalidates entitlement, package catalog, and driver stats
- notification read state mutation invalidates notification list counters

## 6. Event-Driven Ride Lifecycle Blueprint

The active ride should become an event-sourced projection.

### 6.1 Event Envelope

Every event should carry:
- `eventId`
- `rideId`
- `sequence`
- `rideVersion`
- `occurredAt`
- `idempotencyKey`
- `source`
- `payload`

Rules:
- ignore duplicate event ids
- ignore stale sequence numbers
- reconcile on app resume
- persist active ride snapshot
- recover after restart from snapshot plus last sequence

### 6.2 Proposed Events

#### `ride.requested`

Payload:
- ride draft
- pickup
- destination
- requested vehicle

Source:
- customer app or backend command gateway

Projection impact:
- create active ride projection in `searching`

UI effect:
- show searching screen

#### `ride.matching.started`

Payload:
- ride id
- match metadata

Source:
- backend matching service

Projection impact:
- mark matching active

UI effect:
- searching UI becomes active and can show progress

#### `ride.driver.offered`

Payload:
- driver id
- offer amount
- vehicle data

Source:
- driver or backend match layer

Projection impact:
- append negotiation offer

UI effect:
- negotiation screen updates

#### `ride.driver.accepted`

Payload:
- driver id
- vehicle id
- accepted fare or matching confirmation

Source:
- driver app

Projection impact:
- transition to assigned or negotiating depending policy

UI effect:
- show assigned driver state

#### `ride.driver.arriving`

Payload:
- driver location snapshot

Source:
- driver app or backend automation

Projection impact:
- move to arriving

UI effect:
- show ETA and arrival screen

#### `ride.driver.arrived`

Payload:
- arrival timestamp
- pickup location

Source:
- driver app

Projection impact:
- move to arrived

UI effect:
- show wait state

#### `ride.started`

Payload:
- start timestamp
- pickup snapshot

Source:
- driver app

Projection impact:
- move to in progress

UI effect:
- start trip tracking screen

#### `ride.completed`

Payload:
- completion timestamp
- final fare
- driver id
- ride summary

Source:
- driver app or backend

Projection impact:
- terminal completed state
- archive snapshot into history

UI effect:
- show completion and rating entry

#### `ride.cancelled`

Payload:
- cancellation reason
- actor
- cancellation timestamp

Source:
- customer, driver, support, or backend policy engine

Projection impact:
- terminal cancelled state

UI effect:
- clear active ride and show recovery state if needed

#### `ride.payment.authorized`

Payload:
- payment authorization id
- fare

Source:
- payment gateway or backend

Projection impact:
- attach payment authorization status

UI effect:
- show payment pending or confirmed state

#### `ride.payment.completed`

Payload:
- payment reference
- settled amount

Source:
- backend payment service

Projection impact:
- finalize payment state

UI effect:
- show paid state in ride details or receipt

#### `ride.rating.submitted`

Payload:
- stars
- comment

Source:
- customer app

Projection impact:
- update ride review state

UI effect:
- rating flow completes

#### `driver.location.updated`

Payload:
- coordinates
- accuracy
- recordedAt

Source:
- driver app

Projection impact:
- update live driver marker

UI effect:
- map marker and ETA change

#### `negotiation.offer.created`

Payload:
- actor
- amount
- message id

Source:
- customer or driver app

Projection impact:
- append negotiation state

UI effect:
- negotiation list updates

#### `negotiation.offer.accepted`

Payload:
- accepted offer id
- accepted amount

Source:
- customer or driver app

Projection impact:
- transition to confirmed

UI effect:
- close negotiation and proceed

#### `negotiation.offer.rejected`

Payload:
- rejected offer id
- reason

Source:
- customer or driver app

Projection impact:
- update negotiation state

UI effect:
- show rejection state or fallback offer

### 6.3 Projection Rules

- active ride state changes only through events
- event reducer produces the UI projection
- screens read projections, not raw mutable ride truth
- event replay must be deterministic
- projection can be cached locally for fast startup

## 7. Offline And Mutation Blueprint

### 7.1 Outbox

Domains needing an outbox:
- ride actions
- driver online and offline
- driver accept and decline
- saved place add, edit, delete
- profile update
- document upload metadata
- package purchase and activation
- rating submission

Outbox properties:
- persistent
- ordered
- idempotent
- bounded by TTL and max size
- replayable after reconnect

### 7.2 Retry Policy

- retry only transient transport failures
- exponential backoff with jitter
- bounded attempts
- stop on validation, authorization, and terminal domain errors
- preserve the same idempotency key across retries

### 7.3 Conflict Resolution

- server wins for authoritative state
- local draft can be preserved for user recovery
- stale mutation responses must not overwrite newer snapshots
- if a command is rejected due to stale version, refresh before retry

### 7.4 Rollback Rules

- optimistic updates roll back on terminal failure
- noncritical UI optimism may remain if the mutation is still pending
- never keep an optimistic terminal ride state after a rejected command

### 7.5 Network Status

- app should distinguish offline, retrying, and synced
- reconnect triggers outbox flush and query refresh
- resume should revalidate active ride and entitlement data

## 8. Persistence Ownership Blueprint

### 8.1 SecureStore

Use for:
- auth/session
- profile secrets
- payment tokens
- sensitive driver identity data

### 8.2 AsyncStorage

Use only for cacheable and replaceable state:
- package catalog cache
- package campaigns cache
- route cache if persisted later
- notification read state if not sensitive

### 8.3 Versioned Envelopes

Rules:
- every persisted payload has a schema version
- load validates shape before use
- invalid or unsupported data is rejected safely
- legacy migration happens once on read

### 8.4 Logout Rules

- logout clears sensitive state
- logout invalidates user-scoped query caches
- logout clears active ride and draft stores unless product policy requires recovery

### 8.5 Corruption Handling

- corrupt or invalid storage must fail soft
- load should return null or empty default, not crash the app
- report a sanitized storage validation warning

### 8.6 Chunking And Size Limits

- large secure values can be chunked
- cache stores should stay small and replaceable
- never store base64 image blobs or large route traces in secure storage unless there is no better option

### 8.7 Never Store Locally

- backend access tokens beyond SecureStore scope
- raw payment credentials
- server trust decisions
- terminal ride authority
- any long-lived secret that is not required for offline recovery

## 9. Migration Roadmap

### Phase 7C: Extract Booking/Search/Map Picker Stores

Objective:
- move transient client draft state out of large contexts and screens.

Likely files:
- new `artifacts/mobile/state/*` stores
- `RideContext`
- `CustomerHome`
- `location-search`
- `saved-place-selector`
- `map-picker`

Risk:
- flow regressions in booking and saved-place handoff

Validation:
- navigation and booking flow tests
- state reset tests

Rollback:
- keep current context values as adapters until store parity is proven

### Phase 7D: Introduce Repository Interfaces

Objective:
- normalize data-source boundaries for auth, profile, saved locations, rides, vehicles, packages, notifications, payments.

Likely files:
- `artifacts/mobile/data/repositories/*`
- current persistence modules
- domain adapters

Risk:
- shape mismatches between local and future backend payloads

Validation:
- repository contract tests
- schema validation tests

Rollback:
- keep current local implementations behind repository facades

### Phase 7E: Adopt TanStack Query For Cacheable Domains

Objective:
- move reads to query-backed cache.

Likely files:
- query hooks
- screens and shared components that consume server data
- invalidation helpers

Risk:
- stale cache behavior and overfetching

Validation:
- hydration tests
- invalidation tests
- offline fallback tests

Rollback:
- preserve repository-backed local reads as fallback paths

### Phase 7F: Move Active Ride Lifecycle To Event Projection

Objective:
- replace mutable ride truth with event-sourced projection.

Likely files:
- `RideProvider`
- ride domain files
- navigation into ride screens

Risk:
- most complex migration in the app

Validation:
- event replay tests
- duplicate event tests
- resume/reconcile tests

Rollback:
- keep current ride engine as the fallback adapter until projection parity is proven

### Phase 7G: Add Offline Outbox And Idempotent Mutations

Objective:
- make backend-affecting actions retryable and safe.

Likely files:
- mutation layer
- repository adapters
- network status hooks

Risk:
- duplicate submits or stale command replay

Validation:
- idempotency tests
- retry/backoff tests
- conflict tests

Rollback:
- disable outbox for unsupported domains while keeping local mutation paths

### Phase 7H: State/Data Regression Tests And Enforcement

Objective:
- lock in ownership boundaries.

Likely files:
- state ownership tests
- persistence tests
- repository contract tests
- lint or scan scripts

Risk:
- false positives if guardrails are too broad

Validation:
- CI gates for direct persistence access
- duplicate state scans

Rollback:
- allow documented exceptions with explicit file-level allowlists

## 10. Guardrails

Future enforcement rules:

1. Screens cannot import persistence modules directly.
2. Screens cannot call `AsyncStorage` or `SecureStore` directly.
3. Screens cannot call raw backend clients directly.
4. Screens should access server data only through repositories or query hooks.
5. Canonical state must not be duplicated across unrelated owners.
6. Backend-affecting mutations must have idempotency keys.
7. Active ride state cannot be manually mutated outside the event reducer or projection adapter.
8. Persisted data must use schema validation and versioned envelopes.
9. Sensitive data must never be written to AsyncStorage.
10. Temporary route handoffs must not become long-lived storage.

## 11. Recommended First Implementation Phase

The safest first implementation phase after this blueprint is:

- Phase 7C, extracting booking/search/map-picker stores and trimming the largest contexts.

Reason:
- highest local duplication
- lowest backend risk
- best path to reducing `RideProvider` and screen coupling without introducing cache or event complexity too early

## 12. Repository Layer Update

Phase 7D introduces repository boundaries without changing runtime behavior.

- Repository contracts live in [`docs/repositories.md`](./repositories.md).
- Screens must not import persistence or sources directly.
- Contexts and focused stores may call repositories.
- Repositories own the data-source decision and preserve the current local behavior for now.
- Local adapters are the default implementation until backend and offline strategies are introduced.

The immediate low-risk consumer migrated in this phase is `SavedLocationsContext`, which now reads and writes through `savedLocationsRepository` instead of calling storage helpers directly.

## 13. Domain-First Direction

Phase 7E scaffolds a domain-first organization under [`domains/`](../domains/).

The goal is not to move runtime code yet. The goal is to make ownership explicit before imports start shifting.

- `domains/<name>/README.md` documents ownership for each domain
- `domains/domainOwnership.ts` provides a typed ownership map
- repository boundaries remain the data boundary
- contexts and focused stores remain the short-term integration layer
- runtime behavior remains unchanged until later phases move code deliberately
This is the domain-first direction for state and data organization.
