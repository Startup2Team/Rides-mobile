import * as Sentry from '@sentry/react-native';

type SafeValue = string | number | boolean;
type SafeContext = Record<string, SafeValue | undefined>;

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim() ?? '';
const SENTRY_ENVIRONMENT = process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT?.trim() || undefined;

let initialized = false;

function compactContext(context?: SafeContext): Record<string, SafeValue> | undefined {
  if (!context) return undefined;
  const safe = Object.fromEntries(
    Object.entries(context).filter((entry): entry is [string, SafeValue] => entry[1] !== undefined),
  );
  return Object.keys(safe).length > 0 ? safe : undefined;
}

export function initializeMonitoring() {
  if (initialized || !SENTRY_DSN) return false;

  try {
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: SENTRY_ENVIRONMENT,
      sendDefaultPii: false,
      beforeSend(event) {
        delete event.user;
        delete event.request;
        delete event.breadcrumbs;
        return event;
      },
    });
    initialized = true;
    return true;
  } catch {
    return false;
  }
}

export function reportRuntimeError(error: unknown, category: string, context?: SafeContext) {
  if (!initialized) return;
  Sentry.withScope(scope => {
    scope.setTag('failure.category', category);
    const safeContext = compactContext(context);
    if (safeContext) scope.setContext('operation', safeContext);
    Sentry.captureException(error instanceof Error ? error : new Error(category));
  });
}

export function reportOperationalWarning(category: string, context?: SafeContext) {
  if (!initialized) return;
  Sentry.withScope(scope => {
    scope.setTag('warning.category', category);
    const safeContext = compactContext(context);
    if (safeContext) scope.setContext('operation', safeContext);
    Sentry.captureMessage(category, 'warning');
  });
}

export function reportOperationalFailure(category: string, error?: unknown, context?: SafeContext) {
  reportRuntimeError(new Error(category), category, {
    ...context,
    errorType: error instanceof Error ? error.name : typeof error,
  });
}

export function isMonitoringEnabled() {
  return initialized;
}

/**
 * Dev-only contract guard. Warns (Sentry + console) when a container key that a
 * response mapper depends on is ABSENT from the payload — i.e. the backend JSON
 * shape has drifted from what the mapper expects. This is deliberately quiet for
 * legitimately-empty collections: an existing key holding `[]`/`{}`/`null` is a
 * valid empty state and does NOT warn; only a MISSING key (shape mismatch) does.
 *
 * Use it in the mappers that read a nested container (e.g. `data.documents`,
 * `data.saved_locations`) so a future backend rename surfaces loudly in dev
 * instead of silently defaulting to an empty list.
 */
export function expectField(obj: unknown, key: string, context: string): void {
  if (!__DEV__) return;
  const present = obj != null && typeof obj === 'object' && key in (obj as Record<string, unknown>);
  if (present) return;
  reportOperationalWarning('contract.shape_mismatch', { context, field: key });
  // eslint-disable-next-line no-console
  console.warn(
    `[contract] expected field "${key}" missing in ${context} — backend response shape may have changed`,
  );
}
