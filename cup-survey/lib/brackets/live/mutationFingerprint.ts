import { createHash } from 'crypto'

/** Deterministic mutation fingerprint for impact preview (client + server). */
export function stableJsonHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}
