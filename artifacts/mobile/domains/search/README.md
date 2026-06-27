# Search Domain

Owns the transient search flow and suggestions.

Owns:
- search query draft
- suggestion selection
- recent search session

Must not own:
- saved-place persistence
- ride truth
- profile identity

Current source files outside this domain:
- `state/searchStore.ts`
- `components/home/LocationSearchOverlay.tsx`
- `app/location-search.tsx`

Future migration plan:
- keep the search draft in `searchStore`
- move query/suggestion repository behavior into `domains/search`

Ownership:
- repository: `SearchRepository`
- store: `searchStore`
- query: future geocode/suggestion hooks
- events: search-query-changed, suggestion-selected
