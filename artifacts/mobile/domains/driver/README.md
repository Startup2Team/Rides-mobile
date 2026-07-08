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

Remote prototype:
- Phase 12J adds `RemoteDriverRepository` for driver onboarding and driver application diagnostics
- `SHADOW_REMOTE` may validate application/profile reads, status reads, submit/update application DTOs, document metadata/reference DTOs, clarification reads, and clarification responses
- local driver onboarding state remains authoritative for current runtime behavior
- remote review status never grants runtime driver capability, changes role switching, or changes go-online eligibility
- mobile cannot approve a driver, reject a driver, force verification, or manufacture verified status

Authority model:
1. account identity
2. driver application
3. backend review
4. driver capability granted
5. driver mode eligibility

The driver application is attached to the same canonical account used as a customer. It does not create a second identity.

Document security:
- driver documents are metadata/reference contracts only
- raw document bytes and base64 document data must not be persisted or sent through repository DTOs
- telemetry must not include national ID, DOB, license number, MoMo pay code, phone number, document contents, document URLs, or signed URLs
- shadow comparisons use safe semantic categories such as application stage, review category, vehicle type, document type presence, document verification category, and clarification count

Future migration plan:
- move driver rules into `domains/driver`
- keep driver state behind `DriverRepository`
- keep role switching from forking identity
- move approval authority to backend/admin review before any remote authority cutover

Ownership:
- repository: `DriverRepository`
- store: `driverSessionStore` (future)
- query: future driver profile/availability hooks
- events: driver-online, driver-offline, vehicle-selected
