import { describe, expect, it } from 'vitest'
import { canChangeCompetitionStage } from '../competitionStageLifecycle'
import { makeTestBout } from './testBoutHelpers'
import { makeTestScheduledBout } from './testBoutHelpers'

describe('canChangeCompetitionStage', () => {
  const categoryBouts = [makeTestBout({ id: 'cat:a::1', categoryKey: 'cat:a', competitionStage: 2 })]

  it('rejects when any category bout has started', () => {
    const allowed = canChangeCompetitionStage({
      categoryBouts,
      targetStage: 3,
      snapshot: {
        allBouts: [makeTestScheduledBout({ id: 'cat:a::1', competitionStage: 2 })],
        executions: new Map([
          [
            'cat:a::1',
            {
              boutId: 'cat:a::1',
              actualStartAt: new Date('2026-10-03T05:00:00.000Z'),
              actualEndAt: null,
            },
          ],
        ]),
      },
    })
    expect(allowed).toBe(false)
  })

  it('rejects moving to earlier stage when target stage already started elsewhere', () => {
    const allowed = canChangeCompetitionStage({
      categoryBouts: [makeTestBout({ id: 'cat:b::1', categoryKey: 'cat:b', competitionStage: 3 })],
      targetStage: 1,
      snapshot: {
        allBouts: [
          makeTestScheduledBout({ id: 'cat:b::1', competitionStage: 3 }),
          makeTestScheduledBout({ id: 'other::1', competitionStage: 2 }),
        ],
        executions: new Map([
          [
            'other::1',
            {
              boutId: 'other::1',
              actualStartAt: new Date('2026-10-03T06:00:00.000Z'),
              actualEndAt: null,
            },
          ],
        ]),
      },
    })
    expect(allowed).toBe(false)
  })

  it('allows upcoming category to move 2→3 while stage 1 runs', () => {
    const allowed = canChangeCompetitionStage({
      categoryBouts: [makeTestBout({ id: 'cat:b::1', categoryKey: 'cat:b', competitionStage: 2 })],
      targetStage: 3,
      snapshot: {
        allBouts: [
          makeTestScheduledBout({ id: 'cat:b::1', competitionStage: 2 }),
          makeTestScheduledBout({ id: 'other::1', competitionStage: 1 }),
        ],
        executions: new Map([
          [
            'other::1',
            {
              boutId: 'other::1',
              actualStartAt: new Date('2026-10-03T06:00:00.000Z'),
              actualEndAt: null,
            },
          ],
        ]),
      },
    })
    expect(allowed).toBe(true)
  })
})
