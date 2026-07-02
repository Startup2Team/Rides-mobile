# Saved Locations Domain

Owns customer saved places.

Owns:
- saved-place CRUD
- ordering
- validation

Must not own:
- search drafts
- booking truth
- notification state

Current source files outside this domain:
- `hooks/useSavedLocations.ts` compatibility wrapper
- `context/SavedLocationsContext.tsx`
- `persistence/savedLocationsPersistence.ts`
- `app/saved-place-selector.tsx`

Future migration plan:
- keep `SavedLocationsContext` as a compatibility layer for now
- move query reads to TanStack Query in a later phase without changing the public domain API
- keep repository boundary in `SavedLocationsRepository`

Phase 12C adds the first remote repository prototype for this domain.

- `RemoteSavedLocationsRepository` can run in `SHADOW_REMOTE` diagnostics mode
- the local repository remains authoritative for all current UI paths
- the remote response is observed for telemetry only and does not affect state
- the expected rollout path is `LOCAL -> SHADOW_REMOTE -> HYBRID -> REMOTE`

Ownership:
- repository: `SavedLocationsRepository`
- store: none yet
- query: future saved-locations query hooks and cache adapters
- events: saved-place-added, saved-place-updated, saved-place-removed
- compatibility: `SavedLocationsContext` and `hooks/useSavedLocations.ts`
