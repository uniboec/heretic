import { ForeignEntryIdError, ParticipantCornerMismatchError } from './mat-control/errors'
import type { BoutEventRecord, BoutParticipantContext, Corner } from './mat-control/types'

export function resolveOperationalCorner(
  entryId: string,
  participants: BoutParticipantContext,
): Corner | null {
  if (participants.redEntryId === entryId) {
    return participants.cornersSwapped ? 'blue' : 'red'
  }
  if (participants.blueEntryId === entryId) {
    return participants.cornersSwapped ? 'red' : 'blue'
  }
  return null
}

export function assertBoutParticipantCorner(input: {
  entryId: string
  corner: Corner
  participants: BoutParticipantContext
}): void {
  const { entryId, corner, participants } = input

  if (entryId !== participants.redEntryId && entryId !== participants.blueEntryId) {
    throw new ForeignEntryIdError()
  }

  const operationalCorner = resolveOperationalCorner(entryId, participants)
  if (operationalCorner !== corner) {
    throw new ParticipantCornerMismatchError()
  }
}

export function oppositeCorner(corner: Corner): Corner {
  return corner === 'red' ? 'blue' : 'red'
}

export function entryIdForCorner(
  corner: Corner,
  participants: BoutParticipantContext,
): string | null {
  if (corner === 'red') {
    return participants.cornersSwapped ? participants.blueEntryId : participants.redEntryId
  }
  return participants.cornersSwapped ? participants.redEntryId : participants.blueEntryId
}

/** UI column for an athlete episode — prefers cornerAtEvent from the latest start. */
export function uiCornerForEntryEpisode(
  events: BoutEventRecord[],
  entryId: string,
  participants: BoutParticipantContext,
  startEventType: 'ATHLETE_WAIT_START' | 'ATHLETE_DOCTOR_START' | 'ATHLETE_EQUIPMENT_START',
): Corner | null {
  const latestStart = events
    .filter((event) => !event.undoneAt && event.eventType === startEventType && event.entryId === entryId)
    .at(-1)

  if (latestStart?.cornerAtEvent) {
    return latestStart.cornerAtEvent
  }

  return resolveOperationalCorner(entryId, participants)
}
