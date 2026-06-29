# Driver Domain

Owns driver-side identity projection and availability.

Owns:
- driver profile
- availability
- driver session
- onboarding projection

Must not own:
- customer booking draft
- saved locations
- ride history truth

Current source files outside this domain:
- `context/DriverEntitlementContext.tsx`
- `context/AuthContext.tsx`
- `app/(driver)/index.tsx`

Future migration plan:
- move driver rules into `domains/driver`
- keep driver state behind `DriverRepository`
- keep role switching from forking identity

Ownership:
- repository: `DriverRepository`
- store: `driverSessionStore` (future)
- query: future driver profile/availability hooks
- events: driver-online, driver-offline, vehicle-selected
