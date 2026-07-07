# Package Payment Backend Implementation Checklist

## Configuration

- [ ] backend owns payment mode
- [ ] backend returns safe provider config
- [ ] mobile cannot mutate config

## Authentication

- [ ] driver identity comes from auth context
- [ ] client driverId is not trusted
- [ ] claim ownership enforced

## Claims

- [ ] persistent claim storage
- [ ] version starts at 1
- [ ] transitions increment version
- [ ] provider/reference unique constraint
- [ ] expiry persisted
- [ ] package offer validated against backend truth

## Driver APIs

- [ ] config
- [ ] create
- [ ] list own
- [ ] detail own
- [ ] submit
- [ ] resubmit
- [ ] cancel

## Admin authorization

- [ ] admin/support permission model
- [ ] reviewer identity from auth context
- [ ] approval endpoint protected

## Approval

- [ ] claim row locked
- [ ] expected version checked
- [ ] verification evidence validated
- [ ] amount matched
- [ ] provider/reference matched
- [ ] idempotency enforced
- [ ] purchase created once
- [ ] activation created once
- [ ] credits granted once
- [ ] claim approved once
- [ ] audit appended
- [ ] outbox written
- [ ] one database transaction

## Privacy

- [ ] payer phone not logged
- [ ] transaction reference not logged
- [ ] merchant code not logged
- [ ] raw merchant SMS not stored in core claim
- [ ] provider credentials not exposed
- [ ] internal review notes not sent to driver

## Outbox

- [ ] event written in approval transaction
- [ ] worker processes after commit
- [ ] consumer idempotent
- [ ] notification failure does not reverse activation

## Contract

- [ ] endpoint paths match OpenAPI
- [ ] DTO fields match
- [ ] timestamps match
- [ ] RWF amount representation matches
- [ ] error envelope matches BackendClient
- [ ] claim version conflict supported
