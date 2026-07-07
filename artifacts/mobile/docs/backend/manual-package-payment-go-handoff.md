# Manual Package Payment Go Handoff

## Status

No Go backend source exists in this workspace.

This document is the implementation-ready handoff for the future Rides Go backend that must own manual package payment approval.

## Required Responsibilities

The Go backend must own:

- package payment configuration
- manual claim persistence
- claim versioning
- duplicate reference enforcement
- review authority
- approval transaction
- package purchase creation
- package activation
- credit grant transaction
- outbox event write
- driver notification delivery
- admin authorization

The mobile app must remain submission-only.

## Suggested Boundaries

Use the backend's existing architecture conventions. Do not introduce a second router, ORM, transaction helper, or auth stack.

Likely layers:

- HTTP handlers
- application services
- domain policies
- repository ports
- SQL persistence adapters
- outbox worker

## Acceptance Criteria

MP7 backend work is complete only when:

- a driver can submit a manual claim
- admin/support can review it
- approval is atomic with purchase, activation, credit grant, and outbox write
- duplicate transaction references are rejected by database constraint or equivalent transactional uniqueness
- repeated approval is idempotent
- no partial success is visible after rollback
- logs remain free of payer phone, transaction reference, proof data, and secrets

## Compatibility Checklist

The backend implementation must match the mobile DTO contracts already defined in:

- `artifacts/mobile/data/remote/contracts/api/packagePaymentApi.ts`
- `artifacts/mobile/data/remote/mappers/packagePaymentMapper.ts`

Any mismatch must be resolved intentionally, not by silent drift.
