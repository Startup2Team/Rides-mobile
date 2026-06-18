# Verification Submissions

This mobile app now prepares three review payloads for a future Rides web/admin workflow:

- Driver application submissions
- Vehicle application submissions
- Vehicle document update submissions

## Payload shape

Each submission includes:

- `clientSubmissionId` for idempotency
- `submittedAt`
- `status`
- `reviewStatus`
- the full payload required for human review
- a `history` array for local timeline rendering

## Driver application

Fields prepared by mobile:

- `userId`
- `fullName`
- `phone`
- `dob`
- `nationalId`
- operating location fields
- Mobile Money details
- selfie/profile image
- first vehicle details
- all required document images

## Vehicle application

Fields prepared by mobile:

- `userId`
- `driverId`
- `vehicleId`
- `vehicleType`
- `brand`
- `model`
- `manufactureYear`
- `plateNumber`
- vehicle-specific capacity fields
- all required document images
- vehicle outside/inside photos

## Vehicle document update

Fields prepared by mobile:

- `userId`
- `driverId`
- `vehicleId`
- `vehicleType`
- `plateNumber`
- changed document fields
- previous document metadata when available
- updated document images
- vehicle outside/inside photos

## Backend endpoints

Later, these payloads can map to:

- `POST /verification/driver-applications`
- `POST /verification/vehicle-applications`
- `POST /verification/vehicle-document-updates`
- `POST /verification/review-decisions`

## Idempotency

Mobile passes `clientSubmissionId` with every request. The backend should reject duplicates or return the existing submission for the same client id.

## File upload strategy

The mobile app is already structured to send local image URIs and document metadata. A backend can later replace local persistence with direct file upload or signed URL uploads, then store the resulting file references in the same payload shape.

## Review workflow

1. Mobile creates a submission with `pending_review`.
2. Admin reviews in the web system.
3. Admin approves or rejects with a reason.
4. Mobile applies the review decision to the stored submission.
5. Existing approved vehicles remain usable until a new submission is explicitly approved or rejected.

