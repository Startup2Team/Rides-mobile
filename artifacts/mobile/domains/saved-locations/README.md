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
- `context/SavedLocationsContext.tsx`
- `persistence/savedLocationsPersistence.ts`
- `app/saved-place-selector.tsx`

Future migration plan:
- move saved-place rules into `domains/saved-locations`
- keep repository boundary in `SavedLocationsRepository`

Ownership:
- repository: `SavedLocationsRepository`
- store: none yet
- query: future saved-locations query hooks
- events: saved-place-added, saved-place-updated, saved-place-removed
