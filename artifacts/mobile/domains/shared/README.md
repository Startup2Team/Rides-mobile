# Shared Domain Primitives

Owns cross-cutting primitives only.

Owns:
- shared types
- shared constants
- shared UI contracts
- store helpers

Must not own:
- domain canonical state
- repository implementation details

Current source files outside this domain:
- `types/index.ts`
- `state/storeUtils.ts`
- `constants/*.ts`

Future migration plan:
- keep shared primitives here
- avoid letting shared code accumulate domain truth

Ownership:
- repository: none
- store: helper utilities only
- query: none
- events: none
