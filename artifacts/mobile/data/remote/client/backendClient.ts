import { createNotImplementedError, SerializationError } from '../contracts/backendErrors';
import type {
  BackendClientConfig,
  BackendDownload,
  BackendRequestOptions,
  BackendResponse,
  BackendUpload,
} from '../contracts/backendClientTypes';

export class BackendClient {
  readonly baseUrl: string;
  readonly transport?: BackendClientConfig['transport'];

  constructor(config: BackendClientConfig = {}) {
    this.baseUrl = config.baseUrl ?? '';
    this.transport = config.transport;
  }

  private async send<T = unknown>(method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, options?: BackendRequestOptions): Promise<BackendResponse<T>> {
    if (!this.transport) {
      throw createNotImplementedError('backend-client', method.toLowerCase(), 'transport');
    }

    try {
      return await this.transport({ method, path, options }) as BackendResponse<T>;
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new SerializationError({
        repository: 'backend-client',
        method: method.toLowerCase(),
        transport: 'transport',
        cause: error,
      });
    }
  }

  request<T = unknown>(path: string, options: BackendRequestOptions = {}) {
    return this.send<T>('GET', path, options);
  }

  get<T = unknown>(path: string, options: BackendRequestOptions = {}) {
    return this.send<T>('GET', path, options);
  }

  post<T = unknown>(path: string, options: BackendRequestOptions = {}) {
    return this.send<T>('POST', path, options);
  }

  put<T = unknown>(path: string, options: BackendRequestOptions = {}) {
    return this.send<T>('PUT', path, options);
  }

  patch<T = unknown>(path: string, options: BackendRequestOptions = {}) {
    return this.send<T>('PATCH', path, options);
  }

  delete<T = unknown>(path: string, options: BackendRequestOptions = {}) {
    return this.send<T>('DELETE', path, options);
  }

  async upload<T = unknown>(path: string, options: BackendRequestOptions = {}): Promise<BackendUpload> {
    const response = await this.post<T>(path, options);
    return {
      status: response.status,
      data: response.data,
      headers: response.headers,
    };
  }

  async download(path: string, options: BackendRequestOptions = {}): Promise<BackendDownload> {
    const response = await this.get<BackendDownload['data']>(path, options);
    return {
      status: response.status,
      data: response.data,
      headers: response.headers,
    };
  }
}
