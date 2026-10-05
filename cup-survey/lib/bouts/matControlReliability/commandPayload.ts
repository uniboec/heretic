import { MAT_CONTROL_SCHEMA_VERSION } from './types'
import { computePayloadHash } from './hash'

export function buildCommandPayloadHash(input: {
  intent: string
  sequenceNo: number
  payload: Record<string, unknown>
  includeBoutElapsedMs?: boolean
}): string {
  const body: Record<string, unknown> = {
    intent: input.intent,
    sequenceNo: input.sequenceNo,
    payload: input.payload,
  }
  if (input.includeBoutElapsedMs && input.payload.boutElapsedMs != null) {
    body.boutElapsedMs = input.payload.boutElapsedMs
  }
  return computePayloadHash(body)
}

export function buildCanonicalEventFromCreated(input: {
  type: string
  commandId: string
  sequenceNo: number
  boutElapsedMs: number
  payload: Record<string, unknown> | null
}) {
  return {
    schemaVersion: MAT_CONTROL_SCHEMA_VERSION,
    type: input.type,
    commandId: input.commandId,
    sequenceNo: input.sequenceNo,
    boutElapsedMs: input.boutElapsedMs,
    payload: input.payload ?? {},
  }
}
