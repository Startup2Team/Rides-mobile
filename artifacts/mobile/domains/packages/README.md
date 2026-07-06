# Packages Domain

This directory documents package catalog and package entitlement responsibilities.

Package catalog, package offers, purchases, activation, and credits are owned by `domain/driverRidePackages.ts` in the current runtime.

Package payment initiation policy and manual payment claims are owned by `domains/package-payments`.

Future backend approval must bridge an approved manual claim into package activation atomically, with a matching successful package purchase and exactly-once credit transaction. That authority does not live in the mobile client.

The mobile frontend still cannot activate a package from manual claim approval. Even if a future backend marks a claim approved, activation must happen only through trusted backend authority and backend-owned package transactions.
