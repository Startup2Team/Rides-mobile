# Manual Package Payment Security

## Authentication

Driver endpoints must use trusted backend-authenticated driver identity.

Admin endpoints must use trusted backend-authenticated admin/support identity.

Do not trust driverId or reviewerId from the request body.

## Logging

Never log:

- payer phone number
- transaction reference
- merchant code
- raw verification evidence
- proof references
- support notes
- secrets
- tokens

## Privacy

Driver-facing responses should only expose safe, user-visible review state and safe explanations.

Internal review notes and fraud diagnostics belong only in backend-admin storage and logs with strict controls.
