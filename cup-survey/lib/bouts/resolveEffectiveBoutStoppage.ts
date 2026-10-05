import type { BoutEventRecord, StoppageTrigger } from './mat-control/types'

export type EffectiveBoutStoppage = {
  eventId: string
  boutElapsedMs: number
  trigger: StoppageTrigger
}

function readStoppageTrigger(payload: Record<string, unknown> | null | undefined): StoppageTrigger | null {
  const trigger = payload?.trigger
  return typeof trigger === 'string' ? (trigger as StoppageTrigger) : null
}

function readBoutElapsedMs(
  event: BoutEventRecord,
  payload: Record<string, unknown> | null | undefined,
): number | null {
  if (typeof event.boutElapsedMs === 'number' && Number.isFinite(event.boutElapsedMs)) {
    return event.boutElapsedMs
  }
  const fromPayload = payload?.boutElapsedMs
  if (typeof fromPayload === 'number' && Number.isFinite(fromPayload)) {
    return fromPayload
  }
  return null
}

export function resolveEffectiveBoutStoppage(events: BoutEventRecord[]): EffectiveBoutStoppage | null {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]
    if (event.undoneAt || event.eventType !== 'BOUT_STOPPAGE') {
      continue
    }

    const payload =
      event.payload && typeof event.payload === 'object'
        ? (event.payload as Record<string, unknown>)
        : null
    const trigger = readStoppageTrigger(payload)
    const boutElapsedMs = readBoutElapsedMs(event, payload)
    if (trigger == null || boutElapsedMs == null) {
      continue
    }

    return {
      eventId: event.id,
      boutElapsedMs,
      trigger,
    }
  }

  return null
}
