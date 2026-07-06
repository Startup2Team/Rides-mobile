# Backend Staging Questions

Use this checklist when reviewing the real Go staging backend before the mobile
app is allowed to begin diagnostics-only shadow calls.

## Environment

- What is the staging base URL?
- Is the URL separate from production?
- Does the URL use HTTPS?
- Are there any build-time or runtime caveats the mobile team should know about?

## Authentication

- Is authentication required for staging access?
- If not required, should the mobile app send any placeholder auth metadata?
- If authentication is required, is the supported model:
  - injected token provider
  - service test identity
- What header or metadata shape should the mobile app use?
- How should the mobile app avoid owning token persistence?

## Saved Locations

- Is `GET /v1/saved-locations` confirmed for staging?
- Is `POST /v1/saved-locations` confirmed for staging?
- Is `PATCH /v1/saved-locations/{id}` confirmed for staging?
- Is `DELETE /v1/saved-locations/{id}` confirmed for staging?
- Do the request and response DTOs match the mobile contract page?

## Profile

- Is `GET /v1/profile/me` confirmed for staging?
- Is `PATCH /v1/profile/me` confirmed for staging?
- Is `POST /v1/profile/me/photo` confirmed for staging?
- Is `PATCH /v1/profile/me/phone` confirmed for staging?
- Do the request and response DTOs match the mobile contract page?

## Error Format

- What is the canonical validation error format?
- What body shape should the mobile app expect for unauthorized requests?
- What body shape should the mobile app expect for conflicts?
- What body shape should the mobile app expect for rate limiting?
- What body shape should the mobile app expect for 5xx failures?

## Rate Limits

- Are staging rate limits enabled?
- Are `Retry-After` headers present?
- Are the limits per-user, per-IP, or global?
- Are the staging limits representative of production?

## Isolation

- Is staging database storage isolated from production?
- Is staging object storage isolated from production?
- Are staging credentials separate from production credentials?
- Are staging logs and traces separated from production?

## Privacy

- Are exact addresses excluded from logs and traces?
- Are phone numbers excluded from logs and traces?
- Are tokens and signed URLs excluded from logs and traces?
- Are request and response bodies sanitized before telemetry export?

## Rollback

- If the mobile team removes the staging environment variables, does the app
  remain local-only?
- If staging fails or times out, does local behavior stay authoritative?
- Are any backend-side rollout flags required before mobile shadow calls are
  allowed?

## Backend Follow-Up

- Which answers are final?
- Which answers are still pending backend infrastructure work?
- Which answers require a later follow-up after the first staging probe?
