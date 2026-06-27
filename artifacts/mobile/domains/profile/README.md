# Profile Domain

Owns shared profile presentation and profile media.

Owns:
- user profile
- profile image
- contact details

Must not own:
- driver verification state
- ride history
- booking state

Current source files outside this domain:
- `persistence/profilePersistence.ts`
- `components/ProfileAvatarCircle.tsx`
- `app/profile.tsx`

Future migration plan:
- move profile rules into `domains/profile`
- back them with `ProfileRepository`

Ownership:
- repository: `ProfileRepository`
- store: none yet
- query: future profile query hooks
- events: profile update acknowledgements
