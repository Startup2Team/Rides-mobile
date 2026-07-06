# Manual Package Payment Outbox

The approval transaction must write the notification/event row in the same database transaction as approval.

## Event

manual_payment_claim.approved

## Payload

- eventId
- claimId
- driverId
- packageId
- vehicleId
- activationId
- entitlementVersion
- occurredAt

## Exclusions

Do not include:

- payer phone
- transaction reference
- merchant code
- raw verification evidence
- support notes
- proof references

## Delivery

Outbox delivery happens after commit and must be idempotent.

Notification delivery failure must not roll back committed activation.

