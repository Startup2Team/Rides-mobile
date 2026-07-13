# Driver Statistics

Phase 1 creates a local driver statistics view model for the driver Statistics screen.
Phase 2 uses that model to create the driver-facing Summary experience.

This domain is intentionally pure:

- it accepts explicit inputs from the UI layer;
- it does not read AsyncStorage;
- it does not use React hooks;
- it does not call backend APIs;
- it does not create fake chart points or simulated trends.

## Current Authority

No backend-authoritative driver statistics source exists yet. The current view model normalizes local prototype data:

- completed trips and period earnings from local ride history;
- all-time completed trips and ride revenue from the local driver profile;
- rating from locally stored driver ratings;
- ride/package balance and package purchase history from local entitlement state.

Every metric carries source metadata and confidence so the UI can avoid presenting weak local data as authoritative.

## Phase 2 Summary UI

The Statistics screen now focuses on driver performance instead of package or billing details:

- period earnings;
- completed trips;
- earnings per trip;
- driver rating and acceptance/profile performance;
- truthful local insights;
- supporting all-time/profile performance rows.

The visual hierarchy is structurally inspired by high-quality native activity dashboards, but the presentation remains Rides-specific. Package history, Mobile Money details, remaining package rides, and bonus rides are no longer primary Statistics content.

Mini visualizations are driven directly by Phase 1 buckets. They do not use fake trend arrays, random values, or smoothing. The circular earnings summary visual is a completed-trip summary for the selected period; it does not represent an earnings goal, completion percentage, driver rank, or target progress.

## Periods

Supported periods are `today`, `week`, and `month`.

The Phase 1 implementation uses the device local timezone:

- `today`: 24 hourly buckets;
- `week`: 7 daily buckets, Monday through Sunday;
- `month`: daily buckets for the current local month.

This is prototype behavior only. A future backend statistics service should provide server-authoritative period boundaries, including the product timezone rules for Rwanda.

## Future Backend Dependency

A backend statistics boundary should eventually provide authoritative earnings, trip lifecycle counts, acceptance/completion/cancellation rates, rating aggregates, online time, vehicle breakdowns, and time buckets for trends.
