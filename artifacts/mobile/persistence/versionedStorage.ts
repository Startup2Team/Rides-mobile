import AsyncStorage from '@react-native-async-storage/async-storage';
import { z } from 'zod';
import { reportOperationalWarning } from '@/observability/monitoring';

export const STORAGE_VERSION = 1;

const envelopeSchema = z.object({
  version: z.number().int(),
  data: z.unknown(),
});

export interface StorageLoadResult<T> {
  data: T | null;
  source: 'missing' | 'current' | 'legacy' | 'invalid';
}

function warnStorage(key: string, reason: string, details?: unknown) {
  console.warn('[storage-validation]', { key, reason, details });
  reportOperationalWarning('storage.validation', { key, reason });
}

export function serializeVersionedStorage<T>(data: T) {
  return JSON.stringify({ version: STORAGE_VERSION, data });
}

export async function saveVersionedStorage<T>(key: string, data: T) {
  await AsyncStorage.setItem(key, serializeVersionedStorage(data));
}

export async function removeVersionedStorage(key: string) {
  await AsyncStorage.removeItem(key);
}

export async function loadVersionedStorage<T>(
  key: string,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
): Promise<StorageLoadResult<T>> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return { data: null, source: 'missing' };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    warnStorage(key, 'corrupted-json', error);
    return { data: null, source: 'invalid' };
  }

  const envelope = envelopeSchema.safeParse(parsed);
  if (envelope.success) {
    if (envelope.data.version !== STORAGE_VERSION) {
      warnStorage(key, 'unsupported-version', { version: envelope.data.version });
      return { data: null, source: 'invalid' };
    }
    const validated = schema.safeParse(envelope.data.data);
    if (!validated.success) {
      warnStorage(key, 'invalid-current-shape', validated.error.issues);
      return { data: null, source: 'invalid' };
    }
    return { data: validated.data, source: 'current' };
  }

  const legacy = schema.safeParse(parsed);
  if (!legacy.success) {
    warnStorage(key, 'invalid-legacy-shape', legacy.error.issues);
    return { data: null, source: 'invalid' };
  }

  await saveVersionedStorage(key, legacy.data);
  return { data: legacy.data, source: 'legacy' };
}
