import { buildCanonicalEventFromCreated } from './commandPayload'
import { computeEventHash } from './hash'

/** Maps control intent to primary BoutEvent type for 1:1 command→event cases. */
const INTENT_TO_EVENT_TYPE: Record<string, string> = {
  CLOCK_START: 'CLOCK_START',
  CLOCK_STOP: 'CLOCK_STOP',
  CLOCK_ADJUST: 'CLOCK_ADJUST',
  FIRST_CALL: 'FIRST_CALL',
  SECONDARY_CALL: 'SECONDARY_CALL',
  NO_SHOW: 'NO_SHOW',
  ATHLETE_WAIT_START: 'ATHLETE_WAIT_START',
  ATHLETE_WAIT_END: 'ATHLETE_WAIT_END',
  ATHLETE_DOCTOR_START: 'ATHLETE_DOCTOR_START',
  ATHLETE_DOCTOR_END: 'ATHLETE_DOCTOR_END',
  ATHLETE_EQUIPMENT_START: 'ATHLETE_EQUIPMENT_START',
  ATHLETE_EQUIPMENT_END: 'ATHLETE_EQUIPMENT_END',
  CORNER_SWAP: 'CORNER_SWAP',
  UNDO: 'UNDO',
  CONFIRM: 'RESULT_CONFIRMED',
  CANCEL_STOPPAGE: 'STOPPAGE_CANCELLED',
  OPEN_NEXT_BOUT: 'OPEN_NEXT_BOUT',
  RESET_BOUT: 'RESET_BOUT',
  EXPIRE_PERIOD: 'PERIOD_ENDED',
  TECHNICAL_SCORE: 'TECHNICAL_SCORE',
  ADJUDICATION: 'ADJUDICATION',
  BOUT_STOPPAGE: 'BOUT_STOPPAGE',
}

export function resolveEventTypeForIntent(intent: string): string {
  return INTENT_TO_EVENT_TYPE[intent] ?? intent
}

export function computeClientCommandEventHash(input: {
  intent: string
  commandId: string
  sequenceNo: number
  payload: Record<string, unknown>
}): string {
  const boutElapsedMs =
    typeof input.payload.boutElapsedMs === 'number' ? input.payload.boutElapsedMs : 0
  const canonical = buildCanonicalEventFromCreated({
    type: resolveEventTypeForIntent(input.intent),
    commandId: input.commandId,
    sequenceNo: input.sequenceNo,
    boutElapsedMs,
    payload: input.payload,
  })
  return computeEventHash(canonical)
}
