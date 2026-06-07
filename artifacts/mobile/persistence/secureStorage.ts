import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { z } from 'zod';
import { SENSITIVE_STORAGE_KEYS } from '@/constants/storage';
import { reportOperationalWarning } from '@/observability/monitoring';
import {
  loadVersionedStorage,
  serializeVersionedStorage,
  type StorageLoadResult,
  STORAGE_VERSION,
} from './versionedStorage';

const envelopeSchema = z.object({
  version: z.number().int(),
  data: z.unknown(),
});
const chunkManifestSchema = z.object({
  chunked: z.literal(true),
  generation: z.string(),
  count: z.number().int().positive(),
});
const SECURE_CHUNK_LENGTH = 450;
const volatileSecureStorage = new Map<string, string>();

function warnSecureStorage(key: string, reason: string) {
  reportOperationalWarning('secure-storage.validation', { key, reason });
}

function secureKey(key: string) {
  return `rides.secure.${key.replace(/[^A-Za-z0-9._-]/g, '_')}`;
}

function chunkKey(key: string, generation: string, index: number) {
  return `${secureKey(key)}.${generation}.${index}`;
}

async function secureStoreAvailable() {
  return SecureStore.isAvailableAsync ? SecureStore.isAvailableAsync() : true;
}

async function secureGet(key: string) {
  return await secureStoreAvailable()
    ? SecureStore.getItemAsync(key)
    : volatileSecureStorage.get(key) ?? null;
}

async function secureSet(key: string, value: string) {
  if (await secureStoreAvailable()) {
    await SecureStore.setItemAsync(key, value);
  } else {
    volatileSecureStorage.set(key, value);
  }
}

async function secureDelete(key: string) {
  if (await secureStoreAvailable()) {
    await SecureStore.deleteItemAsync(key);
  } else {
    volatileSecureStorage.delete(key);
  }
}

function parseChunkManifest(raw: string | null) {
  if (!raw) return null;
  try {
    const parsed = chunkManifestSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

async function deleteChunks(key: string, manifest: z.infer<typeof chunkManifestSchema> | null) {
  if (!manifest) return;
  await Promise.all(
    Array.from({ length: manifest.count }, (_, index) =>
      secureDelete(chunkKey(key, manifest.generation, index)),
    ),
  );
}

async function readSecureRaw(key: string) {
  const raw = await secureGet(secureKey(key));
  const manifest = parseChunkManifest(raw);
  if (!manifest) return raw;

  const chunks = await Promise.all(
    Array.from({ length: manifest.count }, (_, index) =>
      secureGet(chunkKey(key, manifest.generation, index)),
    ),
  );
  if (chunks.some(chunk => chunk === null)) {
    warnSecureStorage(key, 'missing-chunk');
    return null;
  }
  return chunks.join('');
}

async function writeSecureRaw(key: string, raw: string) {
  const primaryKey = secureKey(key);
  const previousManifest = parseChunkManifest(await secureGet(primaryKey));

  if (raw.length <= SECURE_CHUNK_LENGTH) {
    await secureSet(primaryKey, raw);
    await deleteChunks(key, previousManifest);
    return;
  }

  const generation = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const chunks = Array.from(
    { length: Math.ceil(raw.length / SECURE_CHUNK_LENGTH) },
    (_, index) => raw.slice(index * SECURE_CHUNK_LENGTH, (index + 1) * SECURE_CHUNK_LENGTH),
  );
  const nextManifest = { chunked: true as const, generation, count: chunks.length };
  try {
    await Promise.all(chunks.map((chunk, index) =>
      secureSet(chunkKey(key, generation, index), chunk),
    ));
    await secureSet(primaryKey, JSON.stringify(nextManifest));
  } catch (error) {
    await deleteChunks(key, nextManifest);
    throw error;
  }
  await deleteChunks(key, previousManifest);
}

function parseSecureValue<T>(key: string, raw: string, schema: z.ZodType<T>): StorageLoadResult<T> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    warnSecureStorage(key, 'corrupted-json');
    return { data: null, source: 'invalid' };
  }

  const envelope = envelopeSchema.safeParse(parsed);
  if (!envelope.success || envelope.data.version !== STORAGE_VERSION) {
    warnSecureStorage(key, 'invalid-envelope');
    return { data: null, source: 'invalid' };
  }

  const validated = schema.safeParse(envelope.data.data);
  if (!validated.success) {
    warnSecureStorage(key, 'invalid-shape');
    return { data: null, source: 'invalid' };
  }

  return { data: validated.data, source: 'current' };
}

export async function saveSecureStorage<T>(key: string, data: T) {
  await writeSecureRaw(key, serializeVersionedStorage(data));
}

export async function loadSecureStorage<T>(
  key: string,
  schema: z.ZodType<T>,
): Promise<StorageLoadResult<T>> {
  const secureRaw = await readSecureRaw(key);
  if (secureRaw) return parseSecureValue(key, secureRaw, schema);

  const legacy = await loadVersionedStorage(key, schema);
  if (legacy.data) {
    await saveSecureStorage(key, legacy.data);
  }

  // Remove sensitive legacy data only after a successful secure write, or when invalid.
  if (legacy.source === 'invalid' || legacy.data) {
    await AsyncStorage.removeItem(key);
  }

  return legacy.data
    ? { data: legacy.data, source: 'legacy' }
    : legacy;
}

export async function removeSecureStorage(key: string) {
  const primaryKey = secureKey(key);
  const manifest = parseChunkManifest(await secureGet(primaryKey));
  await Promise.all([
    secureDelete(primaryKey),
    deleteChunks(key, manifest),
    AsyncStorage.removeItem(key),
  ]);
}

export function getSecureStorageKey(key: string) {
  return secureKey(key);
}

export async function clearSensitiveStorage() {
  await Promise.all(SENSITIVE_STORAGE_KEYS.map(removeSecureStorage));
}
