import { describe, expect, it } from 'vitest'
import { buildMatSchedule, getMatEndTimes } from '../buildMatSchedule'
import { normalizeBoutsPageSettings } from '../normalizeBoutsPageSettings'
import { makeTestBout } from './testBoutHelpers'

const baseSettings = normalizeBoutsPageSettings({
  publicEnabled: true,
  matCount: 1,
  autoMatAssignMode: 'BY_CATEGORY',
  autoMatByCategoryEnabled: true,
  boutsStartTime: '10:00',
  matStartTimeOverrides: {},
  boutBreakMinutes: 3,
  ageDivisionDurationOverrides: {},
})

function makeBout(id: string, categoryKey: string) {
  return makeTestBout({
    id,
    categoryKey,
    categoryTitle: 'Test',
    discipline: 'tactic_control',
    storedMatIndex: 1,
    schedulePhase: 'elimination',
    round: 1,
    roundsUntilFinal: 1,
    matchNumber: parseInt(id.replace(/\D/g, ''), 10) || 1,
  })
}

describe('buildMatSchedule', () => {
  it('uses last bout end for mat end times, not cursor after break', () => {
    const bouts = [
      makeBout('b1', 'tactic_control:novice:m_boys_1:w1'),
      makeBout('b2', 'tactic_control:novice:m_boys_1:w2'),
    ]
    const now = new Date('2026-10-03T05:00:00.000Z') // 10:00 +05

    const schedule = buildMatSchedule({
      bouts,
      matIndex: 1,
      settings: baseSettings,
      eventDate: '2026-10-03',
      now,
      executions: new Map(),
    })

    const endTimes = getMatEndTimes(schedule)
    expect(endTimes.scheduledEndAt).toBe(schedule[1]?.timing.scheduledEndAt)
    expect(endTimes.estimatedEndAt).toBe(schedule[1]?.timing.estimatedEndAt)
    expect(endTimes.scheduledEndAt).not.toBeNull()
  })

  it('uses actual timestamps for completed bouts', () => {
    const bouts = [makeBout('b1', 'tactic_control:novice:m_boys_1:w1')]
    const actualStartAt = new Date('2026-10-03T05:10:00.000Z')
    const actualEndAt = new Date('2026-10-03T05:13:00.000Z')

    const schedule = buildMatSchedule({
      bouts,
      matIndex: 1,
      settings: baseSettings,
      eventDate: '2026-10-03',
      now: new Date('2026-10-03T05:20:00.000Z'),
      executions: new Map([
        [
          'b1',
          {
            boutId: 'b1',
            actualStartAt,
            actualEndAt,
          },
        ],
      ]),
    })

    expect(schedule[0]?.timing.status).toBe('completed')
    expect(schedule[0]?.timing.estimatedStartAt).toBe(actualStartAt.toISOString())
    expect(schedule[0]?.timing.estimatedEndAt).toBe(actualEndAt.toISOString())
  })

  it('in_progress tail drift: upcoming starts after live cursor, not scheduled plan', () => {
    const bouts = [
      makeBout('b1', 'tactic_control:novice:m_boys_1:w1'),
      makeBout('b2', 'tactic_control:novice:m_boys_1:w2'),
    ]
    const actualStartAt = new Date('2026-10-03T05:20:00.000Z')
    const now = new Date('2026-10-03T05:25:00.000Z')

    const schedule = buildMatSchedule({
      bouts,
      matIndex: 1,
      settings: baseSettings,
      eventDate: '2026-10-03',
      now,
      executions: new Map([
        ['b1', { boutId: 'b1', actualStartAt, actualEndAt: null }],
      ]),
    })

    const upcoming = schedule[1]
    expect(upcoming?.timing.status).toBe('upcoming')
    expect(new Date(upcoming!.timing.estimatedStartAt).getTime()).toBeGreaterThan(
      new Date(upcoming!.timing.scheduledStartAt).getTime(),
    )
  })
})
