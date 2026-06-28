# Profile Domain

Shared identity domain for the one-app customer/driver model.

This domain is query-backed now, but it still behaves as a compatibility layer around the existing app session and profile persistence.

Rides uses one authenticated account per user. Every user starts as a customer. A customer may later become an approved driver, but the identity stays the same across both role projections.

## Shared Identity Ownership

One user. One identity. Many capabilities.

The same account can express different capabilities over time:
- Customer
- Driver
- Fleet Owner, future
- Business Account, future
- Delivery Partner, future

The profile remains shared across all capabilities. The capability changes, not the identity.

Owns:
- user id
- full name
- phone number
- email if present
- profile photo
- preferred language
- account settings
- notification preferences
- shared identity fields used in customer and driver mode

Must not own:
- driver approval or rejection state
- driver verification documents
- driver vehicles
- driver package entitlements
- driver online/offline availability
- active ride lifecycle truth
- saved locations canonical storage
- payments or wallet canonical state

Current source files outside this domain:
- `context/AuthContext.tsx`
- `persistence/profilePersistence.ts`
- `components/ProfileAvatarCircle.tsx`
- `components/HomeTopHeader.tsx`
- `hooks/useProfilePhotoActions.ts`
- `app/(tabs)/profile.tsx`
- `app/(driver)/profile.tsx`
- `app/(driver)/index.tsx`
- `app/edit-profile.tsx`
- `app/change-phone-number.tsx`
- `app/driver-onboarding.tsx`

Compatibility layer:
- `AuthContext` still owns the live app session and role switching
- `useProfilePhotoActions` still exists as a wrapper
- `SavedLocationsContext` style replacement is not needed here yet
- shared identity writes should flow through this domain, not directly from screens
- query hooks back the shared profile reads and writes, but the existing screens still rely on the compatibility hooks

Future migration plan:
- move the remaining profile consumers to the domain entry point
- replace direct storage reads with query/repository-backed reads when the server profile exists
- keep customer and driver identity projection on the same account

Ownership:
- repository: `profileRepository`
- store: none yet
- query: future profile query hooks
- events: profile update acknowledgements

One-account rule:
- customer and driver are role projections of the same profile
- logout clears the shared session, not a role-specific account
- driver approval adds a projection, it does not create a second user
