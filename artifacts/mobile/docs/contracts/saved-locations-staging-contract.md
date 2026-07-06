# Saved Locations Staging Contract

This page documents the mobile-side expectation for the saved locations staging
API. It is the contract the mobile app will use for diagnostics-only
`SHADOW_REMOTE` calls once the backend team confirms the staging evidence pack.

This is not proof that the Go backend has already implemented the endpoints.

## Base Path

- `GET /v1/saved-locations`
- `POST /v1/saved-locations`
- `PATCH /v1/saved-locations/{id}`
- `DELETE /v1/saved-locations/{id}`

## Mobile Expectations

### List Saved Locations

- method: `GET`
- request: no body
- response: list of saved location records
- auth expectation: backend team must confirm whether auth is required
- correlation metadata: supported

### Create Saved Location

- method: `POST`
- request: create saved location DTO
- response: created saved location DTO
- idempotency metadata: supported
- auth expectation: backend team must confirm whether auth is required
- correlation metadata: supported

### Update Saved Location

- method: `PATCH`
- request: update saved location DTO
- response: updated saved location DTO
- idempotency metadata: supported
- auth expectation: backend team must confirm whether auth is required
- correlation metadata: supported

### Delete Saved Location

- method: `DELETE`
- request: delete request DTO or path parameter only, depending on backend
- response: delete confirmation DTO or empty response
- idempotency metadata: supported
- auth expectation: backend team must confirm whether auth is required
- correlation metadata: supported

## DTO Notes

The mobile app expects request and response DTOs to remain narrow and
transport-safe. The staging contract should preserve:

- location identity
- display label
- location category or type
- primary/default semantics where applicable
- created/updated timestamps where applicable

The contract should not require the mobile app to log raw addresses, exact
coordinates, notes, phone numbers, or tokens.

## Error Expectations

The mobile transport maps backend failures into typed repository errors:

- `400` or `422` -> validation failure when applicable
- `401` -> unauthorized
- `403` -> forbidden
- `409` -> conflict
- `429` -> rate limited
- `5xx` -> server failure
- malformed JSON -> serialization failure

## Example Request Shapes

```json
{
  "label": "Home",
  "type": "home",
  "coordinates": {
    "latitude": 0.0,
    "longitude": 0.0
  }
}
```

## Example Response Shapes

```json
{
  "id": "saved_location_id",
  "label": "Home",
  "type": "home",
  "isPrimary": true
}
```

## What The Backend Team Should Confirm

- the staging path matches the contract above
- the DTO field names match the mobile mappers
- the error response format maps cleanly to typed backend errors
- the staging environment is isolated from production
- the staging rate-limit policy is known

## Relationship To Runtime

This contract page does not change repository source selection. Local saved
locations remain authoritative until a future rollout phase explicitly changes
runtime behavior.
