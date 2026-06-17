import * as SecureStore from 'expo-secure-store';

const WS_BASE = process.env.EXPO_PUBLIC_WS_BASE_URL;
const __DEV__ = process.env.NODE_ENV !== 'production';

export class RideWebSocket {
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldReconnect = true;
  private handlers: Map<string, (payload: any) => void> = new Map();

  async connect(path: string, queryParams?: Record<string, string>) {
    if (!WS_BASE) {
      throw new Error('EXPO_PUBLIC_WS_BASE_URL is not set');
    }
    const token = await SecureStore.getItemAsync('access_token');
    if (!token) throw new Error('Missing access token');
    const params = new URLSearchParams({ token, ...(queryParams ?? {}) });
    const url = `${WS_BASE}${path}?${params}`;
    if (__DEV__) console.log('[WS] connecting', `${WS_BASE}${path}?token=…`);
    this.ws = new WebSocket(url);
    this.ws.onmessage = e => {
      const msg = JSON.parse(e.data);
      const handler = this.handlers.get(msg.type);
      if (handler) handler(msg.payload);
    };
    this.ws.onerror = () => {
      if (__DEV__) {
        console.warn(
          '[WS] connection error',
          path,
          '— rebuild/restart the API server if you see 401 (needs ?token= auth support)',
        );
      }
    };
    this.ws.onopen = () => {
      if (__DEV__) console.log('[WS] connected', path);
    };
    this.ws.onclose = (e: { code?: number; reason?: string }) => {
      if (__DEV__) console.warn('[WS] closed', path, e?.code ?? '', e?.reason ?? '');
      if (this.shouldReconnect) this.scheduleReconnect(path, queryParams);
    };
  }

  on(type: string, handler: (payload: any) => void) {
    this.handlers.set(type, handler);
    return this;
  }

  send(data: object) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  disconnect() {
    this.shouldReconnect = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
  }

  private scheduleReconnect(path: string, params?: Record<string, string>) {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect(path, params).catch(() => {});
    }, 3000);
  }
}
