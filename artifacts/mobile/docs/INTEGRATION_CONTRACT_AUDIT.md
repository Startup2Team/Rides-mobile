# Mobile ↔ Backend API Contract Audit

Tracked record of verified mobile/backend JSON contract mismatches, found by
audit and fixed on the `integration` branch. The **backend**
(`Rides-api/api-server`) is the source of truth; every fix below aligns the
mobile client to the backend's actual JSON.

## The envelope-depth pattern (read this first)

The backend wraps every success body with `respond.OK(w, X)`, which serialises
to an HTTP body of `{"data": X}`.

On the mobile side, `response.data` is the **HTTP body**, so:

```
response.data       === { data: X }   // the envelope
response.data.data  === X             // the actual payload the handler returned
```

The single most common bug class here is **reading one level too shallow when the
handler returns a keyed object rather than a bare array**. When a handler does:

```go
respond.OK(w, map[string]interface{}{"documents": docs})   // X = { documents: [...] }
```

then `response.data.data` is `{ documents: [...] }`, **not** the array. Calling
`.map()` on it throws `undefined is not a function` / `x.map is not a function`.
The array lives at `response.data.data.documents`.

Rule of thumb: **if the Go handler passes a `map[string]...` (or a struct) to
`respond.OK`, the array/field is nested one level deeper than the envelope.**
Only when the handler passes a bare slice (`respond.OK(w, entries)`) is
`response.data.data` itself the array.

## Findings

Severity key: **P0** = crash / feature completely broken; **P1** = silent wrong
data / degraded UX; **P2** = latent/robustness.

### 1. Driver documents list — wrong depth + no DTO mapping — P0

- **Endpoint:** `GET /v1/driver/documents`
- **Backend:** `{ data: { documents: [ { id, document_type, file_url, uploaded_at } ] } }`
  (`internal/driver/repository.go` `Document`, `internal/driver/handler.go:373`).
- **Was wrong:** mobile read `response.data.data` as the array (one level too
  shallow → `.map` crash) and typed the DTO as the camelCase domain shape with no
  snake→camel mapping, so `documentType`/`fileUrl`/`createdAt` would all have been
  `undefined` even if the depth were right. It also expected a `status` the
  backend never emits.
- **Fix:** read `response.data.data.documents`; added `DriverDocumentDto`
  (`document_type`, `file_url`, `uploaded_at`) mapped to
  `{ documentType, fileUrl, createdAt }`; `status` left optional/undefined.
- **File:** `services/driverDocuments.ts`

### 2. Saved locations list — wrong depth — P0

- **Endpoint:** `GET /v1/users/me/saved-locations`
- **Backend:** `{ data: { saved_locations: [ ... ] } }` (`internal/location/handler.go:129`).
- **Was wrong:** mobile read `response.data.data` as the array → `.map` crash.
- **Fix:** read `response.data.data.saved_locations ?? []`.
- **File:** `services/savedLocations.ts`

### 3. My ratings list — wrong depth — P0

- **Endpoint:** `GET /v1/users/me/ratings`
- **Backend:** `{ data: { ratings: [ ... ], limit, offset } }` (`internal/rating/handler.go:143`).
- **Was wrong:** mobile read `response.data.data` as the array → `.map` crash.
- **Fix:** read `response.data.data.ratings ?? []`.
- **File:** `services/rating.ts`

### 4. Negotiation history — wrong field names on every field — P1

- **Endpoint:** `GET .../rides/{id}/negotiation/history` (customer + driver)
- **Backend:** bare array (`respond.OK(w, entries)`), each entry
  `{ id, type ("offer"|"text"), sender ("customer"|"driver"|"system"), amount,
  response, text, is_final, timestamp }` (`internal/negotiation/service.go`
  `HistoryEntry`; `internal/negotiation/handler.go:125`).
- **Was wrong:** mobile DTO read `ride_id`, `actor_role`/`role`, `kind`/`type`,
  `created_at` — the backend sends `sender`, `type`, `timestamp` and **no**
  `ride_id`. Result: `actorRole`/`kind`/`createdAt` empty, `rideId` undefined.
  It also dropped the `response` (accept/decline outcome) and `is_final` fields
  entirely.
- **Fix:** single shared DTO + mapper (`mapNegotiationHistoryEntry`) exported from
  `services/negotiation.ts` and reused by the driver side.
  Mapping: `sender → actorRole`, `type → kind`, `timestamp → createdAt`,
  surfaced `response` and `isFinal`. `rideId` is now threaded in from the caller
  (which already knows it) rather than read from the payload.
  - **Note on `kind` values:** the task suggested `offer→proposal` / `text→message`,
    but the actual consuming domain type (`types/index.ts` `NegotiationMessage`)
    uses `type: 'offer' | 'text'` with `sender: 'customer' | 'driver' | 'system'`.
    Per the instruction to "inspect the consuming type/enum", the mapper keeps the
    backend/domain vocabulary (`offer`/`text`, lowercase sender) so a future wiring
    of history into the negotiation timeline lines up with `NegotiationMessage`.
    `getNegotiationHistory` currently has no consumer, so this is forward-safe.
- **Files:** `services/negotiation.ts`, `services/driverNegotiation.ts`

### 5. Active ride — 404 treated as an error, `return null` was dead — P0

- **Endpoint:** `GET .../rides/active` (customer + driver)
- **Backend:** returns **HTTP 404** when there is no active ride (not `{data:null}`)
  (`internal/ride/handler.go:199`).
- **Was wrong:** the mobile transport throws on 404
  (`httpBackendTransport` → `mapStatusError`, 404 falls through to
  `BackendUnavailableError` with `status: 404`). So the `data ? ... : null` branch
  was dead and a normal cold start with no in-flight ride threw
  "backend unavailable".
- **Fix:** wrap the call in try/catch; if
  `error instanceof BackendError && error.status === 404`, return `null`
  (no active ride is a normal state). Any other error still propagates.
- **Files:** `services/rides.ts` (`getActiveRide`),
  `services/driverRides.ts` (`getActiveDriverRide`)

### 6. Manual payment info — wrong field names, always fell back — P1

- **Endpoint:** `GET /v1/driver/packages/payment-info`
- **Backend:** `{ data: { momo_code, momo_name, instructions, enabled } }`
  (`internal/packages/handler.go:152`).
- **Was wrong:** mobile read `pay_code`/`number` (and camelCase variants), which
  the backend never sends, so it always used the hardcoded fallback MoMo code.
- **Fix:** typed `ManualPaymentInfoDto` (`momo_code`, `momo_name`, `instructions`,
  `enabled`) mapped to `{ payCode, momoName, instructions, enabled }`; consumer
  `resolveManualPaymentInfo` now reads the typed shape. The backend has **no**
  separate send-money phone number, so `ResolvedManualPaymentInfo.phoneNumber`
  intentionally keeps the bundled fallback.
- **Files:** `services/driverPackages.ts`, `services/manualPayment.ts`

### 7. Submit payment proof — wrong body, every submit 400'd — P0

- **Endpoint:** `POST /v1/driver/packages/purchases/{id}/proof`
- **Backend:** decodes `{ reference, phone, screenshot_url, note }` and requires
  `reference` OR `screenshot_url` (`internal/packages/purchase.go` `ProofInput` /
  `SubmitProof`).
- **Was wrong:** mobile sent `{ payment_ref, provider_txn_id, status }` — none of
  those keys exist on the backend, so the required-field check failed and every
  submit returned 400.
- **Fix:** `PaymentProofInput` is now `{ reference?, phone?, screenshotUrl?, note? }`
  serialised to `{ reference, phone, screenshot_url, note }` (only defined keys sent).
- **File:** `services/driverPackages.ts`

### 8. Driver location update — wrong speed key (and wrong unit) — P1

- **Endpoint:** `POST /v1/driver/location`
- **Backend:** decodes `{ lat, lng, speed_kmh, heading }`
  (`internal/driver/handler.go:283`); ignores anything else.
- **Was wrong:** mobile sent `speed` (dropped by the backend) plus `accuracy`
  (ignored). Additionally the call site passed `expo-location`'s
  `coords.speed`, which is **metres/second**, into what the backend treats as km/h.
- **Fix:** send `speed_kmh` instead of `speed`; dropped `accuracy` from the wire
  body and the `DriverLocationUpdate` interface (backend ignores it); the call
  site in `app/(driver)/index.tsx` now converts m/s → km/h (`* 3.6`).
- **Files:** `services/driverAvailability.ts`, `app/(driver)/index.tsx`

## Dev-only contract guard

Added `expectField(obj, key, context)` to `observability/monitoring.ts`. In
`__DEV__` it fires `reportOperationalWarning('contract.shape_mismatch', ...)` and
a `console.warn` when a **container key** a mapper depends on is **absent** from
the payload (i.e. the backend shape drifted). It is deliberately quiet for
legitimately-empty collections: an existing key holding `[]`/`null` is a valid
empty state and does not warn — only a missing key does.

Wired into the nested-container mappers most prone to silent breakage:
`driverDocuments.list` (`documents`), `savedLocations.list` (`saved_locations`),
`ratings.mine` (`ratings`). Negotiation/active-ride return a bare array or a
single object (no container key), so no guard is needed there.

## Checklist: how to add a new backend call safely

1. **Find the handler**, not just the route. Read what it passes to
   `respond.OK(w, X)` — that `X` is exactly your `response.data.data`.
2. **Match the depth.** If `X` is a `map[string]...`/struct, your array/field is
   nested (`response.data.data.<key>`). If `X` is a bare slice, `response.data.data`
   *is* the array.
3. **Match the field names & case.** Backend JSON is snake_case. Define a `*Dto`
   interface with the exact backend keys and a `toDomain` mapper; never type the
   DTO as the camelCase domain shape (it silently yields `undefined`).
4. **Match the request body keys too.** Read the handler's decode struct
   (`var body struct { ... json:"..." }` / `*Input`) and send exactly those keys.
   Note required-field validation.
5. **Handle non-2xx that are normal states.** A 404 for "nothing here" throws in
   the transport (`mapStatusError`); catch `BackendError` + `error.status` and map
   it to your empty/null result. Don't rely on a `{data:null}` branch the backend
   never returns.
6. **Guard nested containers** with `expectField(payload, '<key>', '<context>')`
   so a future rename is loud in dev instead of silently defaulting to `[]`.
7. **Mind units/enums**, not just key names (e.g. m/s vs km/h; lowercase vs
   uppercase role/status values).
8. **`npx tsc --noEmit` must be 0**, and add/adjust a test that asserts the real
   backend shape (not the old broken one).
