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
