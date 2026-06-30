export interface RealtimeAuthProvider {
  getToken(): Promise<string | null> | string | null;
}

export interface RealtimeAuthState {
  authenticated: boolean;
  tokenExpiresAt?: string | null;
  lastAuthenticatedAt?: string | null;
}
