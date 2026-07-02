import { BackendClient } from '../client';
import {
  BackendUnavailableError,
  NotImplementedError,
  createBackendUnavailableError,
  createNotImplementedError,
} from '../contracts';
import {
  RepositoryResolver,
  repositoryResolver,
} from '../adapters';
import {
  remoteAuthRepository,
  remoteRideRepository,
} from '../repositories';
import { observability, resetObservabilityForTests } from '@/observability/context/observabilityContext';

describe('backend integration boundary', () => {
  beforeEach(() => {
    resetObservabilityForTests();
  });

  afterEach(() => {
    resetObservabilityForTests();
  });

  test('typed backend errors are constructible', () => {
    expect(createBackendUnavailableError('ride', 'loadRideHistory')).toBeInstanceOf(BackendUnavailableError);
    expect(createNotImplementedError('backend-client', 'get')).toBeInstanceOf(NotImplementedError);
  });

  test('backend client fails closed without transport', async () => {
    const client = new BackendClient();
    await expect(client.get('/rides')).rejects.toMatchObject({
      name: 'NotImplementedError',
      code: 'not_implemented',
      transport: 'transport',
    });
  });

  test('remote repository stubs return typed backend-unavailable failures', async () => {
    await expect(remoteRideRepository.loadRideHistory()).rejects.toMatchObject({
      name: 'BackendUnavailableError',
      code: 'backend_unavailable',
      repository: 'ride',
    });
    await expect(remoteAuthRepository.getCurrentUser()).rejects.toMatchObject({
      code: 'backend_unavailable',
      repository: 'auth',
      method: 'getCurrentUser',
    });
  });

  test('repository resolver defaults to local mode', async () => {
    const resolver = new RepositoryResolver();
    const result = await resolver.resolve({
      repository: 'ride',
      method: 'loadRideHistory',
      local: async () => ['local'],
      remote: async () => ['remote'],
    });

    expect(result).toEqual({
      mode: 'LOCAL',
      source: 'local',
      value: ['local'],
    });
  });

  test('shadow remote mode keeps local result and records remote diagnostics', async () => {
    const resolver = new RepositoryResolver('SHADOW_REMOTE');
    const result = await resolver.resolve({
      repository: 'ride',
      method: 'loadRideHistory',
      local: async () => ['local'],
      remote: async () => ['remote'],
    });

    expect(result).toEqual({
      mode: 'SHADOW_REMOTE',
      source: 'local',
      value: ['local'],
    });
    expect(observability.metrics.getPoints()).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'repository.remote.attempt' }),
      expect.objectContaining({ name: 'repository.remote.latency_ms' }),
    ]));
  });

  test('hybrid mode falls back to remote when local fails', async () => {
    const resolver = new RepositoryResolver('HYBRID');
    const result = await resolver.resolve({
      repository: 'profile',
      method: 'getProfileImage',
      local: async () => { throw new Error('local failure'); },
      remote: async () => 'remote-image',
    });

    expect(result).toEqual({
      mode: 'HYBRID',
      source: 'remote',
      value: 'remote-image',
    });
  });

  test('singleton resolver remains local by default', () => {
    expect(repositoryResolver.getMode()).toBe('LOCAL');
  });
});
