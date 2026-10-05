import { describe, expect, it } from 'vitest'
import {
  filterMatQueueEntries,
  formatQueueAthleteInline,
  formatQueueBoutAthletes,
  getQueueAthleteDetails,
  resolveQueueStripFeatured,
} from '../judgeQueueFormat'
import type { BoutDisplayStatus } from '@/lib/bouts/presentation/boutDisplayStatus'
import type { MatControlSnapshot } from '@/lib/bouts/matControlSnapshot'
import type { InternalBout } from '@/lib/bouts/types'

const bout: InternalBout = {
  id: 'cat-a::bout-1',
  matchNumber: 1,
  categoryKey: 'cat-a',
  categoryTitle: '12–13 лет',
  discipline: 'tactic_control',
  storedMatIndex: 1,
  competitionStage: 1,
  schedulePhase: 'elimination',
  round: 1,
  roundsUntilFinal: 2,
  sideA: {
    kind: 'athlete',
    entryId: 'red-1',
    displayName: 'Иванов Иван Иванович',
    clubName: 'Динамо',
    city: 'Москва',
    publicNumber: 1,
  },
  sideB: {
    kind: 'athlete',
    entryId: 'blue-1',
    displayName: 'Петров Пётр Петрович',
    clubName: 'Спартак',
    city: 'Пермь',
    publicNumber: 2,
  },
}

describe('judgeQueueFormat', () => {
  it('returns full name and club with city for queue athlete', () => {
    expect(getQueueAthleteDetails(bout.sideA)).toEqual({
      name: 'Иванов Иван',
      clubCity: 'Динамо · Москва',
    })
  })

  it('formats athlete inline with club and city', () => {
    expect(formatQueueAthleteInline(bout.sideA)).toBe('Иванов Иван · Динамо · Москва')
  })

  it('formats bout athletes with affiliation', () => {
    expect(formatQueueBoutAthletes(bout)).toBe(
      'Иванов Иван (Динамо · Москва) — Петров Пётр (Спартак · Пермь)',
    )
  })

  it('filterMatQueueEntries hides completed bouts by default', () => {
    const displayStatusByBoutId = new Map<string, BoutDisplayStatus>([
      ['cat-a::bout-1', 'completed'],
      ['cat-a::bout-2', 'in_progress'],
      ['cat-a::bout-3', 'scheduled'],
    ])
    const entries = [
      { bout: { id: 'cat-a::bout-1' } },
      { bout: { id: 'cat-a::bout-2' } },
      { bout: { id: 'cat-a::bout-3' } },
    ]

    expect(filterMatQueueEntries(entries, displayStatusByBoutId, false)).toEqual([
      { bout: { id: 'cat-a::bout-2' } },
      { bout: { id: 'cat-a::bout-3' } },
    ])
    expect(filterMatQueueEntries(entries, displayStatusByBoutId, true)).toEqual(entries)
  })

  it('resolveQueueStripFeatured excludes the featured bout from later list', () => {
    const snapshot = {
      activeBout: { boutId: 'cat-a::bout-1' },
      matBoutsNav: [
        { boutId: 'cat-a::bout-1', displayStatus: 'in_progress', matchNumber: 1 },
        { boutId: 'cat-a::bout-2', displayStatus: 'preparing', matchNumber: 2 },
        { boutId: 'cat-a::bout-3', displayStatus: 'scheduled', matchNumber: 3 },
      ],
      queueInOrder: [
        { bout: { ...bout, id: 'cat-a::bout-2', matchNumber: 2, scheduleDisplayNumber: '1-2' } },
        { bout: { ...bout, id: 'cat-a::bout-3', matchNumber: 3, scheduleDisplayNumber: '1-3' } },
      ],
      queue: {
        nextAvailable: {
          bout: { ...bout, id: 'cat-a::bout-2', matchNumber: 2, scheduleDisplayNumber: '1-2' },
        },
        upcoming: [
          { bout: { ...bout, id: 'cat-a::bout-2', matchNumber: 2, scheduleDisplayNumber: '1-2' } },
          { bout: { ...bout, id: 'cat-a::bout-3', matchNumber: 3, scheduleDisplayNumber: '1-3' } },
        ],
        blocked: [],
      },
    } as unknown as MatControlSnapshot

    const featured = resolveQueueStripFeatured(snapshot)
    expect(featured.sectionLabel).toBe('Подготовка')
    expect(featured.entry?.bout.scheduleDisplayNumber).toBe('1-2')
    expect(featured.laterMatchNumbers).toEqual(['1-3'])
  })
})
