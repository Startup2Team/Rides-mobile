# Profile Staging Contract

This page documents the mobile-side expectation for the profile staging API.
It is the contract the mobile app will use for diagnostics-only `SHADOW_REMOTE`
calls once the backend team confirms the staging evidence pack.

This is not proof that the Go backend has already implemented the endpoints.

## Base Path

- `GET /v1/profile/me`
- `PATCH /v1/profile/me`
- `POST /v1/profile/me/photo`
- `PATCH /v1/profile/me/phone`

## Mobile Expectations

### Get Current Profile

- method: `GET`
- request: no body
- response: current profile DTO
- auth expectation: backend team must confirm whether auth is required
- correlation metadata: supported

### Update Profile

- method: `PATCH`
- request: update profile DTO
- response: updated profile DTO
- idempotency metadata: supported
- auth expectation: backend team must confirm whether auth is required
- correlation metadata: supported

### Upload Or Update Profile Photo

- method: `POST`
- request: profile photo upload DTO or multipart contract, depending on backend
- response: updated profile DTO or photo confirmation DTO
- idempotency metadata: supported
- auth expectation: backend team must confirm whether auth is required
- correlation metadata: supported

### Update Phone

- method: `PATCH`
- request: phone update DTO
- response: updated profile DTO or phone confirmation DTO
- idempotency metadata: supported
- auth expectation: backend team must confirm whether auth is required
- correlation metadata: supported

## DTO Notes

The mobile app expects profile DTOs to stay safe for diagnostics and semantic
comparison. The staging contract should preserve:

- profile existence
- display-name presence and category
- language or preference category
- photo presence
- phone verification state where supported

The contract should not require the mobile app to log:

- full phone numbers
- email addresses
- signed or private photo URLs
- tokens
- raw profile values

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
  "displayName": "Amina",
  "language": "en",
  "photoId": "profile_photo_id"
}
```

```json
{
  "phone": "+250700000000"
}
```

## Example Response Shapes

```json
{
  "id": "profile_id",
  "displayName": "Amina",
  "language": "en",
  "photoPresent": true,
  "phoneVerified": true
}
```

## What The Backend Team Should Confirm

- the staging path matches the contract above
- the DTO field names match the mobile mappers
- the error response format maps cleanly to typed backend errors
- the staging environment is isolated from production
- the staging rate-limit policy is known

## Relationship To Runtime

This contract page does not change repository source selection. Local profile
behavior remains authoritative until a future rollout phase explicitly changes
runtime behavior.
