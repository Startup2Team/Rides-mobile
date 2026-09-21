# Intercity Domain

Owns Rides Intercity: scheduled multi-seat trips on a corridor (Kigali →
Musanze), published by an **operator** (a bus company, or an individual running
their own vehicle) and booked seat-by-seat by passengers. Payment is **cash on
board** — this domain never touches money.

Contract: `/Users/paccee/Pac/Rides/INTERCITY_DESIGN.md` §7 (API), §9 (manifest
PII tiering), §11 (decisions), §15 (operators).

Owns:
- corridor catalogue (browse)
- trip search on a corridor + date
- remaining-seat presentation
- seat holds, confirmation, cancellation (the passenger's ticket)
- trip publishing and the driver manifest (board / no-show / start / complete)
- intercity failure taxonomy (the `409 SEATS_UNAVAILABLE` recovery)

Must not own:
- credit/entitlement truth (`domains/packages`)
- payment truth (there is none — cash on board)
- city ride lifecycle (`domains/ride`)
- driver approval or vehicle verification truth

Source files:
- `services/intercity.ts` — the API client and the only place the raw DTO is visible
- `query/hooks/useIntercityQueries.ts` — React Query hooks
- `query/keys/intercityKeys.ts`, `query/policies.ts` (`intercity*` policies)
- `domains/intercity/seats.ts` — pure seat / money / countdown rules
- `domains/intercity/errors.ts` — failure classification
- `domains/intercity/eligibility.ts` — which vehicles may run a corridor
- `app/intercity*.tsx`, `app/driver-intercity*.tsx` — screens

## The three rules this domain exists to keep

1. **Remaining seats is the product.** It arrives as the server's
   `seats_available` (`total − booked − held`), shown as the headline number,
   refetched on focus with a 15s `staleTime`. It is **never** derived from
   `total_seats` when the field is missing — that failure mode advertised a
   sold-out Coaster as having 18 free seats. Browsing
   customers are deliberately **not** streamed over WebSocket (design §8): a
   render is a snapshot, and the hold call is the authority.
2. **`409 SEATS_UNAVAILABLE` is an expected outcome.** Someone else took the
   last seats between the render and the tap. It renders as a recoverable
   message plus a refreshed list — never a crash, never a raw error string. An
   *unlabelled* 409 on a seat write is treated the same way, because the seat
   `UPDATE` returns zero rows for six different reasons (design §4).
3. **`sellable_seats` is never displayed**, even if the API returns it. It is
   the seat count clamped by the operator's credit balance, so publishing it is
   an exact live oracle of a rival's balance (design §11 D3 / §13). It is
   dropped in the DTO mapper and asserted by test.

## Capacity is never special-cased

An 18-seat Coaster and a 4-seat cab go through one path. The per-account seat
cap comes from the server as `max_seats_per_booking`; the mirrored local rule
`min(4, max(1, floor(total / 2)))` is only a fallback for a payload that omits
it. Either way the Coaster yields 1–4 and the cab 1–2 with no branch in the UI.

## The wire shape is pinned by test

Every collection endpoint on this API **keys its array**
(`{corridors}`, `{trips, limit, offset}`, `{bookings, limit, offset}`); none
returns a bare array. Reading `response.data.data` as an array made `.map`
throw, React Query recorded a failure, and the screen rendered its *empty*
state — a hard client bug that looked exactly like "the backend has no data".
`services/__tests__/intercity.test.ts` fixtures are verbatim copies of
`intercity.TripView` / `BookingView` / `Manifest`, so a rename on either side
fails a test instead of silently reading `undefined`.

The **manifest is not a trip**: `GET /driver/intercity/trips/{id}/manifest`
returns `{trip_id, status, depart_at, total_seats, booked_seats, held_seats,
phones_visible, passengers[]}` and nothing about the route. The driver screen
reads the route, price and boarding point from the trip endpoint and degrades
gracefully when that second read fails.

## Not every driver may run a corridor

Intercity needs a vehicle seating at least 4 — a cab, Hilux, Hiace or bus. The
server derives `intercity_eligible` on every vehicle (`GET /driver/vehicles`,
`session.active_vehicle`) and enforces the same rule on publish with
`422 VEHICLE_NOT_INTERCITY_ELIGIBLE`. The app **hides the driver Intercity
entry point** when the fleet is known-ineligible, and the screen explains the
requirement when it is reached anyway (deep link, vehicle switched after the
menu rendered). An unresolved vehicle list keeps the door open: a failed
request must not look like an ineligible driver.

## State authority

Nothing about a booking lives only in client memory. The hold countdown is
recomputed from `hold_expires_at` against the wall clock on every tick, so
background → foreground and cold start are identical; the booking itself is
replayed from `GET /customer/intercity/bookings` on resume.

## Open contract questions

See the report accompanying the implementation: the corridor list endpoint, the
origin/destination points at publish, and the operator id are not specified by
§7 and are implemented as the server-derived defaults described there.
