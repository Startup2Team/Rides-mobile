# Auth Domain

Owns session and identity boundaries for the one-app customer/driver model.

Owns:
- authenticated user
- shared session
- logout boundary
- role projection state

Must not own:
- booking drafts
- saved places
- active ride truth
- package entitlements

Current source files outside this domain:
- `context/AuthContext.tsx`
- `persistence/authPersistence.ts`
- `app/login.tsx`

Future migration plan:
- move auth-facing business rules into `domains/auth`
- keep storage behind `AuthRepository`
- keep identity/session orchestration out of screens

Ownership:
- repository: `AuthRepository`
- store: none yet
- query: future profile/session query hooks only
- events: logout/session boundary events

Remote prototype:
- Phase 12K adds `RemoteAuthRepository` as a `SHADOW_REMOTE` diagnostics
  prototype for OTP/session API contracts.
- Local session state and `AuthContext` remain authoritative.
- Login UI, OTP UI, session persistence, navigation, and role switching stay
  unchanged.
- Shadow `requestOtp` must never trigger real SMS/OTP delivery. It may only use
  a backend dry-run/non-delivery diagnostics endpoint or fail closed as
  unavailable/not implemented.
- Remote verify, refresh, logout, and current-session responses are ignored for
  runtime authority and must not mutate token persistence.
- Auth telemetry must be sanitized. Do not emit OTP codes, access tokens,
  refresh tokens, full phone numbers, session secrets, or device secrets.

Future rollout:
1. `LOCAL` remains default.
2. `SHADOW_REMOTE` validates dry-run OTP and session DTO compatibility.
3. `HYBRID` may be considered only after backend auth authority and token
   persistence rules are explicitly designed.
4. `REMOTE` is reserved for a future auth/session authority cutover.
