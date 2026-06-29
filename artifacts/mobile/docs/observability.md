# Observability Foundation

Phase 8F adds observability infrastructure only. It does not add backend telemetry, Sentry wiring, OpenTelemetry dependencies, UI changes, or business logic migration.

## Architecture

The foundation lives in `artifacts/mobile/observability/`:

- `logger/` provides structured logs with `debug`, `info`, `warn`, `error`, and `fatal`.
- `metrics/` provides counters, gauges, histograms, timers, and async timing helpers.
- `tracing/` provides trace ids, span ids, correlation ids, child spans, and context propagation.
- `performance/` contains passive instrumentation helpers for infrastructure boundaries.
- `crash/` provides an exporter-injected crash reporter abstraction.
- `health/` provides a health monitor and checks for queue, realtime, event engine, query cache, storage, and network.
- `context/` exposes the in-memory observability singleton.
- `exporters/` contains an in-memory exporter used by tests and future adapters.
- `hooks/` and `debug/` expose a hidden inspector surface.

The legacy `observability/monitoring.ts` Sentry adapter remains unchanged. This phase does not extend Sentry usage.

## Logs

Logs are structured objects only. Infrastructure code records fields such as component, operation, repository, event type, and status. Direct console logging is intentionally avoided in the new observability foundation.

## Metrics

The metrics registry supports:

- `counter`
- `gauge`
- `histogram`
- `timer`

Metrics are stored in memory until a future exporter is added.

## Traces

The tracer supports root spans and child spans. Each span carries:

- `traceId`
- `spanId`
- `parentSpanId`
- `correlationId`

Repository boundary instrumentation uses spans so future request-level correlation can connect repositories, mutations, events, and realtime work.

## Correlation

Correlation ids are currently generated locally by the tracer. Future backend and realtime integration should propagate correlation ids across API calls, domain events, offline mutations, and realtime messages.

## Health

Health checks are available for:

- offline queue
- realtime gateway
- event engine
- TanStack Query cache
- storage
- network

The health monitor rolls checks up into `healthy`, `degraded`, `unhealthy`, or `unknown`.

## Instrumentation

Passive instrumentation was added for:

- Offline mutation engine enqueue/process paths
- Realtime gateway connection/auth/reconnect/disconnect paths
- Domain event dispatcher
- TanStack Query client and query wrapper
- Repository boundary helper
- Navigation policy
- Mutation engine metrics

This instrumentation records in-memory logs, metrics, and traces only. It does not change business outcomes.

## Future OpenTelemetry Integration

Future OpenTelemetry work should add exporters that translate local metrics and spans into OTLP-compatible payloads. The current tracer and metrics registry intentionally keep the public surface small so that adapter can be added without changing call sites.

## Future Sentry Integration

Future Sentry integration should implement crash and log exporters. The current crash reporter is dependency-injected and does not import Sentry. PII filtering rules should remain centralized before any exporter sends data off-device.

## Production Readiness

Phase 9F uses the observability foundation as a readiness gate. The gate checks that logs, metrics, traces, correlation propagation, and health checks all emit expected diagnostics before any ride runtime migration is approved.
