# Active Ride Canary Report

Phase 11I adds a developer-facing monitoring report for the Active Ride canary.
It does not change UI scope. The read-only summary strip remains the only
projected Active Ride surface.

## How To Read The Report

The report summarizes the current canary state:

- projected read count
- live fallback count
- gate denial count
- mapping failure count
- stale projection count
- comparison mismatch count
- rollback event count
- time since last mismatch
- time since last fallback
- stability status
- readiness for the next surface
- recommended action

## Recommendation Meanings

- `hold`: not enough stable data yet
- `investigate`: mapping, stale, or mismatch issues need review
- `rollback`: rollback events were recorded or the mismatch pattern is severe
- `ready_for_next_surface`: the stability gate passes and the canary is ready
  to be considered for the next conservative expansion step

## Why The UI Still Does Not Expand

The report is informational. It helps the team decide whether the current
Active Ride canary has stayed healthy long enough to justify the next
read-only surface. Until the recommendation is `ready_for_next_surface`, the
current UI cutover remains the only projected surface.
