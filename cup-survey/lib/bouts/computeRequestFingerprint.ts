import { canonicalJson } from '../brackets/core/hash'
import { createHash } from 'crypto'

/** Server-computed fingerprint: hash(intent + stable canonical payload). */
export function computeRequestFingerprint(
  commandTypeOrIntent: string,
  payload: unknown,
): string {
  const input = `${commandTypeOrIntent}:${canonicalJson(payload ?? {})}`
  return createHash('sha256').update(input).digest('hex')
}
