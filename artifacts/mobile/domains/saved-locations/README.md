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

Ownership:
- repository: `SavedLocationsRepository`
- store: none yet
- query: future saved-locations query hooks and cache adapters
- events: saved-place-added, saved-place-updated, saved-place-removed
- compatibility: `SavedLocationsContext` and `hooks/useSavedLocations.ts`
