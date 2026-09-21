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
- `app/intercity*.tsx`, `app/driver-intercity*.tsx` — screens

## The three rules this domain exists to keep

1. **Remaining seats is the product.** It is `total − booked − held`, shown as
   the headline number, refetched on focus with a 15s `staleTime`. Browsing
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
cap is `min(4, max(1, floor(total / 2)))`, which yields 1–4 on the Coaster and
1–2 on the cab with no branch anywhere in the UI.

## State authority

Nothing about a booking lives only in client memory. The hold countdown is
recomputed from `hold_expires_at` against the wall clock on every tick, so
background → foreground and cold start are identical; the booking itself is
replayed from `GET /customer/intercity/bookings` on resume.

## Open contract questions

See the report accompanying the implementation: the corridor list endpoint, the
origin/destination points at publish, and the operator id are not specified by
§7 and are implemented as the server-derived defaults described there.
