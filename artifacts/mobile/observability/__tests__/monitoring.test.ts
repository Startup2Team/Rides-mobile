describe('mobile monitoring adapter', () => {
  const environment = process.env as Record<string, string | undefined>;
  const originalDsn = environment['EXPO_PUBLIC_SENTRY_DSN'];

  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    if (originalDsn === undefined) {
      delete environment['EXPO_PUBLIC_SENTRY_DSN'];
    } else {
      environment['EXPO_PUBLIC_SENTRY_DSN'] = originalDsn;
    }
  });

  test('stays disabled and does not report when the DSN is missing', () => {
    delete environment['EXPO_PUBLIC_SENTRY_DSN'];
    const Sentry = require('@sentry/react-native');
    const monitoring = require('../monitoring');

    expect(monitoring.initializeMonitoring()).toBe(false);
    monitoring.reportRuntimeError(new Error('not sent'), 'test.failure');
    monitoring.reportOperationalWarning('test.warning');

    expect(Sentry.init).not.toHaveBeenCalled();
    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(Sentry.captureMessage).not.toHaveBeenCalled();
  });

  test('initializes without PII and reports only allowlisted operational context', () => {
    environment['EXPO_PUBLIC_SENTRY_DSN'] = 'https://public@example.invalid/1';
    const Sentry = require('@sentry/react-native');
    const monitoring = require('../monitoring');

    expect(monitoring.initializeMonitoring()).toBe(true);
    expect(Sentry.init).toHaveBeenCalledWith(expect.objectContaining({
      dsn: 'https://public@example.invalid/1',
      sendDefaultPii: false,
      beforeSend: expect.any(Function),
    }));

    monitoring.reportOperationalWarning('storage.validation', {
      key: '@rides_history',
      reason: 'corrupted-json',
    });

    expect(Sentry.__scope.setTag).toHaveBeenCalledWith(
      'warning.category',
      'storage.validation',
    );
    expect(Sentry.__scope.setContext).toHaveBeenCalledWith('operation', {
      key: '@rides_history',
      reason: 'corrupted-json',
    });
    expect(Sentry.captureMessage).toHaveBeenCalledWith('storage.validation', 'warning');
  });

  test('removes user, request, and breadcrumb data before sending', () => {
    environment['EXPO_PUBLIC_SENTRY_DSN'] = 'https://public@example.invalid/1';
    const Sentry = require('@sentry/react-native');
    const monitoring = require('../monitoring');
    monitoring.initializeMonitoring();

    const beforeSend = Sentry.init.mock.calls[0][0].beforeSend;
    const event = beforeSend({
      user: { id: 'sensitive-user' },
      request: { url: 'https://example.invalid/private' },
      breadcrumbs: [{ message: 'private action' }],
      tags: { retained: 'yes' },
    });

    expect(event).toEqual({ tags: { retained: 'yes' } });
  });

  test('reports operational failures without the original error message', () => {
    environment['EXPO_PUBLIC_SENTRY_DSN'] = 'https://public@example.invalid/1';
    const Sentry = require('@sentry/react-native');
    const monitoring = require('../monitoring');
    monitoring.initializeMonitoring();

    monitoring.reportOperationalFailure(
      'map.geocoding.search',
      new Error('sensitive address or token'),
    );

    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'map.geocoding.search' }),
    );
    expect(Sentry.__scope.setContext).toHaveBeenCalledWith('operation', {
      errorType: 'Error',
    });
  });
});
