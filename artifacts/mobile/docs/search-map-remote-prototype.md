# Search and Map Remote Prototype

Phase 12L adds remote repository prototypes for search and map contracts in
`SHADOW_REMOTE` diagnostics mode.

## Authority

The current local/Mapbox path remains authoritative. Remote search results do
not replace visible search results. Remote routes do not replace visible
Mapbox routes. Remote fare estimates are preview-only and do not become final
pricing truth.

No booking, matching, navigation, payment, realtime, or ride lifecycle behavior
changes in this phase.

## Search Diagnostics

`RemoteSearchRepository` validates:

- place search
- autocomplete
- place detail
- reverse geocoding

Search comparison is semantic and tolerance-based. It compares safe fields such
as result count, normalized place names, category/type, approximate coordinate
parity, city/district classification, and broad ordering category. Backend and
Mapbox ranking may differ without being treated as a failure.

## Map Diagnostics

`RemoteMapRepository` validates:

- reverse geocoding
- route estimate
- route preview
- distance estimate
- duration estimate
- fare estimate preview

Route comparison uses explicit coordinate, distance, duration, and fare-preview
tolerances. Small expected routing drift must not be classified as a critical
mismatch.

Fare estimate preview is diagnostics only. Final pricing authority remains
future backend work.

## Privacy

Telemetry may include query length, result count, operation, latency,
distance/duration buckets, coarse coordinate buckets, and mismatch category.

Telemetry must not include exact home or saved-location addresses, raw search
queries, full route geometry, precise movement history, Mapbox tokens, access
tokens, or backend secrets.

## Tests

`FakeBackendTransport` is automated-test-only. The prototype must not contact
Mapbox or the real Rides backend unless an explicit transport is injected.
