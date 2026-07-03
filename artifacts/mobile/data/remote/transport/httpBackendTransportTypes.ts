import type { BackendRequestOptions, BackendTransport } from '../contracts/backendClientTypes';

export type BackendEnvironment = 'LOCAL' | 'DISABLED' | 'STAGING' | 'PRODUCTION';

export interface BackendTransportEnvironment {
  backendEnv?: string;
  backendBaseUrl?: string;
  nodeEnv?: string;
  savedLocationsRepositoryMode?: string;
  savedLocationsShadowWritesEnabled?: string;
  profileRepositoryMode?: string;
  profileShadowWritesEnabled?: string;
}

export interface ResolvedBackendTransportConfig {
  environment: BackendEnvironment;
  enabled: boolean;
  baseUrl: string | null;
  timeoutMs: number;
  reason?: string;
}

export interface HttpBackendTransportConfig {
  baseUrl: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  tokenProvider?: () => Promise<string | null | undefined> | string | null | undefined;
  clientMetadata?: Record<string, string>;
  now?: () => number;
  random?: () => number;
}

export interface HttpBackendTransportFactoryResult {
  transport: BackendTransport;
  config: ResolvedBackendTransportConfig;
}

export interface HttpBackendRequest extends BackendRequestOptions {
  retrySafe?: boolean;
}
