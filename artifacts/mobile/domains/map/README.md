# Map Domain

Owns the transient map picker flow and reverse geocoding projection.

Owns:
- map picker session
- map picker selection
- reverse geocode projection

Must not own:
- booking history
- saved-place persistence
- ride event truth

Current source files outside this domain:
- `state/mapPickerStore.ts`
- `context/MapPickerContext.tsx`
- `app/map-picker.tsx`

Future migration plan:
- keep picker session logic isolated
- keep reverse geocoding behind `MapRepository`

Ownership:
- repository: `MapRepository`
- store: `mapPickerStore`
- query: future map lookup hooks
- events: map-picker-confirmed, map-picker-cancelled

Remote prototype:
- Phase 12L adds `RemoteMapRepository` for `SHADOW_REMOTE` diagnostics.
- The current Mapbox/local path remains authoritative.
- Remote routes never replace visible Mapbox routes.
- Route, distance, duration, and fare-preview comparisons use explicit
  tolerances.
- Fare previews are diagnostics only and never final fare truth.
- Telemetry must not include full route geometry, precise movement history,
  Mapbox tokens, access tokens, or backend secrets.
