# Capabilities

Capabilities are derived permissions for the one-app customer/driver model.

The app has one authenticated user and one shared identity. Customer mode and driver mode are projections over that same account.

## Why capabilities scale better than roles

Roles alone are too coarse once the app supports:
- customers
- approved drivers
- fleet owners
- business accounts
- delivery partners
- admins
- dispatchers
- support agents

Capabilities answer the question:
what can this account do right now?

That is more useful than asking whether the account is simply a driver.

## Capability Inputs

The resolver combines:
- shared profile / authenticated user
- driver state
- approval state
- vehicle state
- package entitlement

## Current Capability Examples

- `canBookRide`
- `canDrive`
- `canGoOnline`
- `canReceiveRideRequests`
- `canEditProfile`
- `canManageVehicles`
- `canBuyPackages`
- `canUseWallet`
- `canReceivePayments`
- `canViewDriverDashboard`
- `canViewCustomerTrips`
- `canSwitchMode`
- `canBecomeDriver`

## Rules

- screens should use capability checks, not raw role flags
- screens should not derive their own capability matrix
- approved driver does not become a separate user
- customer and driver remain role projections of the same account
- capability logic should stay derived, not manually duplicated

## One-Account Model

1. User signs up once.
2. The account starts as a customer.
3. The customer may apply to become a driver.
4. Driver approval adds driver capabilities to the same account.
5. The user can still book rides as a customer.
6. Logout clears the shared session, not a role-specific identity.

## Future Roles

The same capability layer can grow into:
- Fleet Owner
- Business Account
- Delivery Partner
- Admin
- Dispatcher
- Support

The account remains one account. The capability surface expands around it.
