import { buildMatScheduleEntries } from '@/lib/bouts/matControlContext'
import { resolveMatIndexFromBout } from '@/lib/bouts/resolveMatIndexFromBout'
import { readFullScheduleSnapshot } from '@/lib/bouts/scheduleService'
import { enqueueBoutResultAnnouncer } from './matHooks'

export async function afterBoutResultCorrection(input: { boutId: string }): Promise<void> {
  try {
    const snapshot = await readFullScheduleSnapshot({ adminPreview: true })
    const scheduleEntries = buildMatScheduleEntries(snapshot.grouped)
    const matIndex = resolveMatIndexFromBout(input.boutId, scheduleEntries)

    await enqueueBoutResultAnnouncer({ boutId: input.boutId, matIndex })

    const { scheduleMatAnnouncerSync } = await import('./scheduleMatSync')
    scheduleMatAnnouncerSync()

    const { flushAwardAnnouncerSyncIfDeferred, scheduleAwardAnnouncerSync } = await import(
      './scheduleAwardSync',
    )
    flushAwardAnnouncerSyncIfDeferred()
    scheduleAwardAnnouncerSync()
  } catch (error) {
    console.error('[announcer] afterBoutResultCorrection failed', error)
  }
}
