# Staging Backend Transport

Phase 13A introduces the first real HTTP backend transport boundary for the
mobile app.

`HttpBackendTransport` is the production-quality API transport used underneath
`BackendClient`. Repositories must continue to call `BackendClient`; they must
not call `fetch` directly.

```
Remote repository
  -> BackendClient
  -> HttpBackendTransport
  -> Rides Go API
```

`FakeBackendTransport` remains test-only and must not be used for runtime
staging or production traffic.

## Environment Configuration

Backend connectivity is disabled by default. Development and production builds
do not automatically connect to staging.

Supported public variables:

```
EXPO_PUBLIC_BACKEND_ENV=STAGING
EXPO_PUBLIC_BACKEND_BASE_URL=https://placeholder-staging.example
EXPO_PUBLIC_SAVED_LOCATIONS_REPOSITORY_MODE=SHADOW_REMOTE
EXPO_PUBLIC_SAVED_LOCATIONS_SHADOW_WRITES_ENABLED=false
EXPO_PUBLIC_PROFILE_REPOSITORY_MODE=SHADOW_REMOTE
EXPO_PUBLIC_PROFILE_SHADOW_WRITES_ENABLED=false
```

Allowed backend environments:

- `LOCAL`
- `DISABLED`
- `STAGING`
- `PRODUCTION`

Missing or invalid values fail closed to local behavior. Remote base URLs must
parse as valid URLs. Non-localhost remote URLs must use HTTPS. No staging or
production URL is hard-coded in the app.

## Request Policy

Default API timeout: `12000ms`, defined in
`data/remote/transport/backendTransportConfig.ts`.

Timeouts abort the request when `AbortController` is available and map to
`TimeoutError`. Network failures map to `OfflineError` when they match platform
offline/fetch-failure behavior. HTTP status codes map through typed backend
errors.

Safe headers:

- `Accept: application/json`
- `Content-Type: application/json` when a JSON body exists
- `X-Correlation-Id`
- `X-Request-Id`
- `X-Idempotency-Key` when supplied
- API/client metadata such as staging environment, mobile platform, and API
  version

The transport may accept an injected token provider for future authorization
metadata. It does not read tokens from AsyncStorage or own session persistence.

Saved Locations and Profile both use this transport boundary through explicit
staging factories.

## Retry Policy

Retry behavior is centralized in
`data/remote/transport/backendRetryPolicy.ts`.

`GET` requests may retry bounded transient failures such as timeout, offline
fetch failures, `429`, and selected `5xx` responses. Writes are not retried
unless an idempotency key exists and the request is explicitly marked
retry-safe. Phase 13A saved-location writes remain conservative.

## Privacy

Transport telemetry records method, status class, latency, result,
correlation ID, attempt count, and error class. It must not log backend secrets,
auth tokens, raw response bodies, saved-location addresses, exact coordinates,
notes, or phone numbers.

## Staging Isolation

Mobile sends only safe staging/client metadata. The Go backend remains
responsible for physical or logical isolation between staging and production
databases, storage, queues, and credentials.
