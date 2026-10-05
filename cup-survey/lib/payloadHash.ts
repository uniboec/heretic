import { createHash } from 'crypto'

export function hashPayload(payload: Record<string, unknown>): string {
  const stable = JSON.stringify(payload, Object.keys(payload).sort())
  return createHash('sha256').update(stable).digest('hex')
}
