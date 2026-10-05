import type { MatQueueEntry } from '@/lib/bouts/matQueue'
import type { MatControlSnapshot } from '@/lib/bouts/matControlSnapshot'
import {
  formatBoutDisplayStatus,
  type BoutDisplayStatus,
} from '@/lib/bouts/presentation/boutDisplayStatus'
import type { InternalBout, InternalBoutSide } from '@/lib/bouts/types'
import type { MandateWarning } from '@/lib/mandate/types'

import { formatJudgeQueueAthleteName, sideLabel, sideMeta } from './judgeAthlete'

export function warningsForAthleteSide(
  side: InternalBoutSide,
  entryWarnings: Record<string, MandateWarning[]>,
): MandateWarning[] {
  if (side.kind !== 'athlete') return []
  return entryWarnings[side.entryId] ?? []
}

export type QueueAthleteDetails = {
  name: string
  clubCity: string
}

export function getQueueAthleteDetails(side: InternalBoutSide): QueueAthleteDetails {
  return {
    name:
      side.kind === 'athlete'
        ? formatJudgeQueueAthleteName(side.displayName)
        : sideLabel(side),
    clubCity: sideMeta(side),
  }
}

export function formatQueueAthleteInline(side: InternalBoutSide): string {
  const { name, clubCity } = getQueueAthleteDetails(side)
  return clubCity ? `${name} · ${clubCity}` : name
}

export function buildMatQueueDisplayStatusMap(
  snapshot: MatControlSnapshot,
): Map<string, BoutDisplayStatus> {
  return new Map(snapshot.matBoutsNav.map((item) => [item.boutId, item.displayStatus]))
}

export function filterMatQueueEntries<T extends { bout: { id: string } }>(
  entries: T[],
  displayStatusByBoutId: Map<string, BoutDisplayStatus>,
  includeCompleted: boolean,
): T[] {
  if (includeCompleted) return entries
  return entries.filter((entry) => displayStatusByBoutId.get(entry.bout.id) !== 'completed')
}

export function filterMatBoutNavItems(
  items: MatControlSnapshot['matBoutsNav'],
  includeCompleted: boolean,
): MatControlSnapshot['matBoutsNav'] {
  if (includeCompleted) return items
  return items.filter((item) => item.displayStatus !== 'completed')
}

export function countCompletedMatBouts(snapshot: MatControlSnapshot): number {
  return snapshot.matBoutsNav.filter((item) => item.displayStatus === 'completed').length
}

export function matQueueDisplayStatusLabel(
  entry: MatQueueEntry,
  displayStatus?: BoutDisplayStatus,
): string {
  if (entry.blockedReason === 'NOT_READY') return 'Не готов'
  if (displayStatus) return formatBoutDisplayStatus(displayStatus)
  if (!entry.blockedReason) return formatBoutDisplayStatus('scheduled')
  return queueStatusLabel(entry)
}

export function resolveQueueStripFeatured(snapshot: MatControlSnapshot): {
  entry: MatQueueEntry | null
  sectionLabel: string
  displayStatus: BoutDisplayStatus
  laterMatchNumbers: string[]
} {
  const displayStatusByBoutId = new Map(
    snapshot.matBoutsNav.map((item) => [item.boutId, item.displayStatus]),
  )
  const activeBoutId = snapshot.activeBout?.boutId ?? null

  const findEntry = (boutId: string): MatQueueEntry | null =>
    snapshot.queueInOrder.find((entry) => entry.bout.id === boutId) ??
    snapshot.queue.upcoming.find((entry) => entry.bout.id === boutId) ??
    (snapshot.queue.nextAvailable?.bout.id === boutId ? snapshot.queue.nextAvailable : null)

  const preparingItem = snapshot.matBoutsNav.find((item) => item.displayStatus === 'preparing')
  let entry: MatQueueEntry | null = null
  let displayStatus: BoutDisplayStatus = 'scheduled'

  if (preparingItem) {
    entry = findEntry(preparingItem.boutId)
    displayStatus = 'preparing'
  } else if (snapshot.queue.nextAvailable) {
    entry = snapshot.queue.nextAvailable
    displayStatus = displayStatusByBoutId.get(entry.bout.id) ?? 'scheduled'
  }

  const sectionLabel = displayStatus === 'preparing' ? 'Подготовка' : 'Следующий'
  const featuredId = entry?.bout.id ?? null
  const laterMatchNumbers: string[] = []
  const seenMatchNumbers = new Set<string>()

  for (const queueEntry of snapshot.queueInOrder) {
    if (queueEntry.bout.id === featuredId || queueEntry.bout.id === activeBoutId) continue
    if (displayStatusByBoutId.get(queueEntry.bout.id) === 'completed') continue
    if (displayStatusByBoutId.get(queueEntry.bout.id) === 'in_progress') continue
    if (seenMatchNumbers.has(queueEntry.bout.scheduleDisplayNumber)) continue
    seenMatchNumbers.add(queueEntry.bout.scheduleDisplayNumber)
    laterMatchNumbers.push(queueEntry.bout.scheduleDisplayNumber)
    if (laterMatchNumbers.length >= 3) break
  }

  return { entry, sectionLabel, displayStatus, laterMatchNumbers }
}

export function queueStatusLabel(entry: MatQueueEntry): string {
  if (!entry.blockedReason) return 'Готов'
  if (entry.blockedReason === 'REST' && entry.restUntil) {
    const ms =
      (typeof entry.restUntil === 'string'
        ? new Date(entry.restUntil).getTime()
        : entry.restUntil.getTime()) - Date.now()
    const min = Math.max(0, Math.ceil(ms / 60_000))
    return `Отдых ${min} мин`
  }
  if (entry.blockedReason === 'DEPENDENCY') return 'Ожидает бой'
  return 'Не готов'
}

export function formatQueueBoutAthletes(bout: InternalBout): string {
  const left = getQueueAthleteDetails(bout.sideA)
  const right = getQueueAthleteDetails(bout.sideB)
  const leftLine = left.clubCity ? `${left.name} (${left.clubCity})` : left.name
  const rightLine = right.clubCity ? `${right.name} (${right.clubCity})` : right.name
  return `${leftLine} — ${rightLine}`
}
