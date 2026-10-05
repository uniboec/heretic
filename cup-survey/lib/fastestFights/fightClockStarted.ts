import type { BoutEventRecord } from '@/lib/bouts/mat-control/types'

/** True when the fight clock was started at least once and that start was not undone. */
export function wasFightClockStarted(events: BoutEventRecord[]): boolean {
  return events.some((event) => !event.undoneAt && event.eventType === 'CLOCK_START')
}
