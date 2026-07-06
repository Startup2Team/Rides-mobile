# Capabilities

Capabilities are derived permissions for the one-app customer/driver model.

The app has one authenticated user and one shared identity. Roles are projections, not separate accounts. Capabilities are the stable contract that screens should use instead of branching on raw role flags.

## Why capabilities

Roles are too coarse for a scalable app:
- a customer may later become an approved driver
- an approved driver can still book rides as a customer
- future roles like fleet owner, business account, delivery partner, admin, dispatcher, and support add more nuance than `isDriver` can express

Capabilities answer the operational question:
- what is this account allowed to do right now?

## Current capability inputs

The resolver combines:
- shared user profile
- driver state
- approval state
- vehicle state
- package entitlement

## Current capability outputs

Examples:
- `canBookRide`
- `canDrive`
- `canGoOnline`
- `canReceiveRideRequests`
- `canManageVehicles`
- `canBuyPackages`
- `canViewDriverDashboard`
- `canSwitchMode`
- `canBecomeDriver`

## Rules

- screens should not compute capability state themselves
- screens should not branch on `isDriver` for new logic
- capability checks should stay derived from shared profile plus driver state
- customer mode and driver mode are projections of the same account
- approved driver does not create a second identity

## Future roles

The resolver is designed to scale to future capabilities such as:
- Fleet Owner
- Business Account
- Delivery Partner
- Admin
- Dispatcher
- Support

Those roles can be added by extending the capability resolver without splitting the account model.
