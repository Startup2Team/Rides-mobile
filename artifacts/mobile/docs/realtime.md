# Realtime Gateway

Phase 8D introduces a realtime gateway as infrastructure only. It is not wired into rides, notifications, payments, UI flows, or backend services.

## Architecture

The gateway lives in `artifacts/mobile/realtime/` and is split into small infrastructure modules:

- `connection/` owns connect, disconnect, reconnect, authentication, pause, resume, and destroy.
- `subscriptions/` owns the in-memory subscription registry and restore list.
- `heartbeat/` owns ping, pong, timeout detection, and latency.
- `presence/` defines connection states.
- `events/` defines typed realtime events and a local event bus.
- `dispatcher/` routes inbound transport messages to the event bus and heartbeat.
- `network/` observes device connectivity and keeps reconnect offline-aware.
- `auth/` defines the token provider contract.
- `metrics/` creates inspector-friendly snapshots.
- `hooks/` exposes snapshot subscription for React callers.
- `debug/` contains the hidden realtime inspector.

The default singleton uses a no-op transport. Importing the package does not connect to a backend.

## Lifecycle

Consumers explicitly call `connect()`. The manager moves through `Connecting` and then `Connected` when the injected transport connects. `authenticate()` uses either an explicit token or an injected auth provider and then moves to `Authenticated`.

`disconnect()` stops heartbeat and closes the transport. `pause()` prevents connection work and disconnects. `resume()` clears the pause flag and reconnects only when the network is online. `destroy()` removes transport and network listeners and leaves the gateway disconnected.

## Presence

Supported states:

- `Offline`
- `Connecting`
- `Connected`
- `Authenticated`
- `Reconnecting`
- `Disconnected`
- `Degraded`

`Degraded` is reserved for connection failures or unhealthy heartbeat states. Future feature integrations can decide how to react without changing the gateway contracts.

## Subscriptions

The subscription registry supports:

- `subscribe(topic, params)`
- `unsubscribe(id)`
- `unsubscribeAll()`
- `restoreSubscriptions(subscriptions)`

On connect, the manager sends `subscription.restore` messages through the injected transport for all currently registered subscriptions. This is infrastructure only; no ride or notification topics are registered by default.

## Heartbeat

Heartbeat supports:

- `ping()` sends a typed heartbeat ping message.
- `pong(sentAt)` records latency.
- `checkTimeout()` marks the heartbeat timed out when a ping has not received a newer pong within the timeout window.

Heartbeat events are published on the local event bus as `realtime.heartbeat`.

## Reconnect

Reconnect uses exponential backoff with a configurable base delay and max delay. Network offline state prevents reconnect attempts. If the gateway was connected when the network drops, it marks itself for reconnect and resumes when the network returns.

## Event Bus

The event bus supports local `publish`, `subscribe`, and unsubscribe callbacks. Typed infrastructure events are defined in `events/types.ts`. Feature events can be dispatched through `realtime.dispatch`, but no feature integration is active in this phase.

## Debug

`RealtimeInspector` is hidden by default. When rendered with `visible`, it shows:

- connection state
- latency
- subscription count
- heartbeat state
- reconnect count

## Future Integration

Backend integration should provide a real `RealtimeTransport` implementation. Ride engine integration should consume typed events through the dispatcher/event bus and register subscriptions explicitly. Notification integration should follow the same pattern. This phase intentionally leaves those integrations out so the realtime infrastructure can be validated independently.
