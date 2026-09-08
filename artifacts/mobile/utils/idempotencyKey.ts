// Generates a fresh idempotency key for a client-initiated write (e.g. a MoMo
// purchase attempt). Not a security token — just needs to be unique per
// attempt so a retried request is safely deduped server-side. Mirrors the
// crypto.randomUUID-with-fallback pattern already used for device ids
// (data/remote/client/deviceMetadata.ts) so it never blocks on crypto
// availability on older Hermes runtimes.
export function generateIdempotencyKey(prefix: string): string {
  const globalCrypto = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (globalCrypto?.randomUUID) {
    return `${prefix}-${globalCrypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
