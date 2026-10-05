import { createHash } from 'crypto'
import { canonicalJson } from '@/lib/brackets/core/hash'
import { MAT_CONTROL_SCHEMA_VERSION } from './types'

const HASH_EXCLUDE_KEYS = new Set(['payloadHash', 'packageHash', 'checksum', 'eventHash'])

export function jcsCanonicalize(value: unknown): string {
  return canonicalJson(stripExcludedHashFields(value))
}

export function sha256Jcs(value: unknown): string {
  return createHash('sha256').update(jcsCanonicalize(value)).digest('hex')
}

export function computePayloadHash(body: Record<string, unknown>): string {
  return sha256Jcs({
    schemaVersion: MAT_CONTROL_SCHEMA_VERSION,
    ...body,
  })
}

export function computeEventHash(event: {
  schemaVersion?: number
  type: string
  commandId: string
  sequenceNo: number
  boutElapsedMs: number
  payload: Record<string, unknown>
}): string {
  return sha256Jcs({
    schemaVersion: event.schemaVersion ?? MAT_CONTROL_SCHEMA_VERSION,
    type: event.type,
    commandId: event.commandId,
    sequenceNo: event.sequenceNo,
    boutElapsedMs: event.boutElapsedMs,
    payload: event.payload,
  })
}

export function computePackageHash(packageBody: {
  schemaVersion: number
  boutId: string
  boutSessionId: string
  ownershipEpoch: number
  events: Array<Record<string, unknown>>
  result: Record<string, unknown>
  finalState: Record<string, unknown>
}): string {
  const sortedEvents = [...packageBody.events].sort(
    (a, b) => Number(a.sequenceNo) - Number(b.sequenceNo),
  )
  return sha256Jcs({
    schemaVersion: packageBody.schemaVersion,
    boutId: packageBody.boutId,
    boutSessionId: packageBody.boutSessionId,
    ownershipEpoch: packageBody.ownershipEpoch,
    events: sortedEvents,
    result: packageBody.result,
    finalState: packageBody.finalState,
  })
}

function stripExcludedHashFields(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripExcludedHashFields)
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    const next: Record<string, unknown> = {}
    for (const key of Object.keys(record).sort()) {
      if (HASH_EXCLUDE_KEYS.has(key)) continue
      next[key] = stripExcludedHashFields(record[key])
    }
    return next
  }
  return value
}
