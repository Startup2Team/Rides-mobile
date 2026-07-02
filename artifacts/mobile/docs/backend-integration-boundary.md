# Backend Integration Boundary

Phase 12A adds a backend-ready repository boundary without changing runtime
behavior.

## Repository Resolver

The repository resolver can choose one of four modes:

- `LOCAL`
- `REMOTE`
- `HYBRID`
- `SHADOW_REMOTE`

The default remains `LOCAL`, so existing screens continue to use the same
local-first behavior they already have.

## Remote Layer

The remote layer introduces stub repository implementations for every existing
repository contract. These stubs currently return typed failures such as
`BackendUnavailableError` or `NotImplementedError`.

## Shadow Remote

Shadow remote mode runs the local repository first, then executes the remote
path for diagnostics only. The remote result is ignored. Telemetry records
latency, result, fallback, and response shape without affecting the UI.

Phase 12C makes saved locations the first real remote repository prototype.
Its shadow execution is still diagnostics-only, and the app continues to read
the local repository result as authoritative.

Phase 12D adds the same prototype path for the shared profile repository.
The remote profile path can now be exercised in `SHADOW_REMOTE` mode for
diagnostics, but the local profile result still wins and the app behavior stays
unchanged.

Phase 12E adds the same prototype path for notifications.
The remote notification feed and read-state path can now be exercised in
`SHADOW_REMOTE` mode for diagnostics, but local notification state remains
authoritative and the current UI behavior stays unchanged.

Phase 12F adds the same prototype path for driver vehicles.
The remote vehicle list, detail, add, update, delete, and primary-selection
paths can now be exercised in `SHADOW_REMOTE` mode for diagnostics, but local
driver profile state remains authoritative and the current UI behavior stays
unchanged.

## Migration Strategy

The boundary exists so future backend work can swap sources behind the
resolver without screens needing to know whether data is local, mock, remote,
or hybrid.

## Rollout

The app should continue to default to local repositories until backend
integration is explicitly enabled in a later phase.
