import type { BackendError } from '../contracts/backendErrors';
import { createNotImplementedError } from '../contracts/backendErrors';

export function notImplementedMapper(domain: string, direction: string) {
  throw createNotImplementedError(domain, direction, 'mapper');
}

export type MapperErrorToFailure = (error: unknown) => BackendError;
