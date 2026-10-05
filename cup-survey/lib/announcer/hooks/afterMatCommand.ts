import type { Corner } from '@/lib/bouts/mat-control/types'
import { buildMatScheduleEntries } from '@/lib/bouts/matControlContext'
import { resolveMatIndexFromBout } from '@/lib/bouts/resolveMatIndexFromBout'
import { readFullScheduleSnapshot } from '@/lib/bouts/scheduleService'
import { enqueueBoutResultAnnouncer, syncMatAnnouncerState } from './matHooks'
import { enqueueBoutRepeatCallFromMatCommand } from './repeatCall'

export async function afterMatControlCommand(input: {
  boutId: string
  intent: string
  payload?: Record<string, unknown>
}): Promise<void> {
  try {
    const snapshot = await readFullScheduleSnapshot({ adminPreview: true })
    const scheduleEntries = buildMatScheduleEntries(snapshot.grouped)
    const matIndex = resolveMatIndexFromBout(input.boutId, scheduleEntries)

    if (input.intent === 'CONFIRM') {
      await enqueueBoutResultAnnouncer({ boutId: input.boutId, matIndex })
    } else if (
      input.intent === 'SECONDARY_CALL' ||
      input.intent === 'ATHLETE_WAIT_START'
    ) {
      const entryId = input.payload?.entryId
      const corner = input.payload?.corner
      if (typeof entryId === 'string' && (corner === 'red' || corner === 'blue')) {
        await enqueueBoutRepeatCallFromMatCommand({
          boutId: input.boutId,
          matIndex,
          corner: corner as Corner,
          entryId,
        })
      }
      await syncMatAnnouncerState({ matIndex })
    } else {
      await syncMatAnnouncerState({ matIndex })
    }

    const { flushAwardAnnouncerSyncIfDeferred } = await import('./scheduleAwardSync')
    flushAwardAnnouncerSyncIfDeferred()

    const { kickAnnouncerWorker } = await import('../worker')
    kickAnnouncerWorker()
  } catch (error) {
    console.error('[announcer] afterMatControlCommand failed', error)
  }
}
