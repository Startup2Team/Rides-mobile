# Packages Domain

This directory documents package catalog and package entitlement responsibilities.

Package catalog, package offers, purchases, activation, and credits are owned by `domain/driverRidePackages.ts` in the current runtime.

Package payment initiation policy and manual payment claims are owned by `domains/package-payments`.

Future backend approval must bridge an approved manual claim into package activation atomically, but that authority does not live in the mobile client.
