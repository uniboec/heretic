import { describe, expect, it } from 'vitest'
import { buildCeremonySchedule } from '../schedule/buildCeremonySchedule'
import type { QueueWithPlacements } from '../types'

const settings = {
  tournamentScopeId: 'cup-2026',
  publicEnabled: true,
  ceremonyStartTime: '11:00',
  ceremonyDurationMinutes: 3,
  ceremonyBreakMinutes: 0,
  queueRevision: 0,
  ceremonySequenceCounter: 0,
  updatedAt: new Date(),
}

function makeQueue(overrides: Partial<QueueWithPlacements> & Pick<QueueWithPlacements, 'id' | 'categoryKey' | 'status' | 'queueOrder'>): QueueWithPlacements {
  return {
    tournamentScopeId: 'cup-2026',
    needsReview: false,
    queueGroup: 'NORMAL',
    ceremonySequence: null,
    completedAtCategory: new Date('2026-10-03T06:00:00.000Z'),
    ceremonyCompletedAt: null,
    actualStartAt: null,
    actualEndAt: null,
    scheduledStartAtSnapshot: null,
    durationMinutesSnapshot: null,
    breakMinutesSnapshot: null,
    adminComment: null,
    publicComment: null,
    conflictReason: null,
    revision: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    placements: [],
    ...overrides,
  }
}

describe('buildCeremonySchedule', () => {
  it('pushes pending ETAs when in-progress ceremony runs late', () => {
    const now = new Date('2026-10-03T06:15:00.000Z')
    const queue = [
      makeQueue({
        id: 'a',
        categoryKey: 'cat-a',
        status: 'IN_PROGRESS',
        queueOrder: 0,
        ceremonySequence: 1,
        actualStartAt: new Date('2026-10-03T06:10:00.000Z'),
        durationMinutesSnapshot: 3,
        breakMinutesSnapshot: 0,
      }),
      makeQueue({
        id: 'b',
        categoryKey: 'cat-b',
        status: 'PENDING',
        queueOrder: 1,
      }),
    ]

    const schedule = buildCeremonySchedule({ queue, settings, now })
    const pending = schedule.find((item) => item.categoryKey === 'cat-b')
    expect(pending?.timing.estimatedStartAt).toBe(now.toISOString())
  })

  it('uses frozen break snapshot for completed categories', () => {
    const now = new Date('2026-10-03T07:00:00.000Z')
    const queue = [
      makeQueue({
        id: 'a',
        categoryKey: 'cat-a',
        status: 'COMPLETED',
        queueOrder: 0,
        ceremonySequence: 1,
        actualStartAt: new Date('2026-10-03T06:10:00.000Z'),
        actualEndAt: new Date('2026-10-03T06:13:00.000Z'),
        scheduledStartAtSnapshot: new Date('2026-10-03T06:10:00.000Z'),
        durationMinutesSnapshot: 3,
        breakMinutesSnapshot: 0,
      }),
      makeQueue({
        id: 'b',
        categoryKey: 'cat-b',
        status: 'PENDING',
        queueOrder: 1,
      }),
    ]

    const schedule = buildCeremonySchedule({
      queue,
      settings: { ...settings, ceremonyBreakMinutes: 5 },
      now,
    })
    const pending = schedule.find((item) => item.categoryKey === 'cat-b')
    expect(pending?.timing.estimatedStartAt).toBe('2026-10-03T06:13:00.000Z')
  })

  it('follows plan ETA example when in-progress ceremony finishes late', () => {
    const ceremonyStart = new Date('2026-10-03T06:00:00.000Z')
    const aStart = new Date('2026-10-03T06:10:00.000Z')
    const now = new Date('2026-10-03T06:17:00.000Z')
    const queue = [
      makeQueue({
        id: 'a',
        categoryKey: 'cat-a',
        status: 'IN_PROGRESS',
        queueOrder: 0,
        ceremonySequence: 1,
        actualStartAt: aStart,
        scheduledStartAtSnapshot: aStart,
        durationMinutesSnapshot: 3,
        breakMinutesSnapshot: 0,
      }),
      makeQueue({
        id: 'b',
        categoryKey: 'cat-b',
        status: 'PENDING',
        queueOrder: 1,
      }),
      makeQueue({
        id: 'c',
        categoryKey: 'cat-c',
        status: 'PENDING',
        queueOrder: 2,
      }),
    ]

    const schedule = buildCeremonySchedule({
      queue,
      settings: { ...settings, ceremonyStartTime: '11:00' },
      now,
    })

    const b = schedule.find((item) => item.categoryKey === 'cat-b')
    const c = schedule.find((item) => item.categoryKey === 'cat-c')

    expect(b?.timing.estimatedStartAt).toBe(now.toISOString())
    expect(c?.timing.estimatedStartAt).toBe('2026-10-03T06:20:00.000Z')
    expect(b?.timing.scheduledStartAt).toBe(ceremonyStart.toISOString())
  })

  it('pushes pending start to now while in-progress ceremony runs late', () => {
    const aStart = new Date('2026-10-03T06:10:00.000Z')
    const now = new Date('2026-10-03T06:15:00.000Z')
    const queue = [
      makeQueue({
        id: 'a',
        categoryKey: 'cat-a',
        status: 'IN_PROGRESS',
        queueOrder: 0,
        ceremonySequence: 1,
        actualStartAt: aStart,
        durationMinutesSnapshot: 3,
        breakMinutesSnapshot: 0,
      }),
      makeQueue({
        id: 'b',
        categoryKey: 'cat-b',
        status: 'PENDING',
        queueOrder: 1,
      }),
    ]

    const schedule = buildCeremonySchedule({ queue, settings, now })
    const b = schedule.find((item) => item.categoryKey === 'cat-b')

    expect(b?.timing.estimatedStartAt).toBe(now.toISOString())
  })

  it('keeps reopened category at ceremonySequence position without breaking next ETAs', () => {
    const aStart = new Date('2026-10-03T06:10:00.000Z')
    const aEnd = new Date('2026-10-03T06:13:00.000Z')
    const bStart = new Date('2026-10-03T06:13:00.000Z')
    const bEnd = new Date('2026-10-03T06:16:00.000Z')
    const now = new Date('2026-10-03T06:20:00.000Z')

    const queue = [
      makeQueue({
        id: 'a',
        categoryKey: 'cat-a',
        status: 'COMPLETED',
        queueOrder: 0,
        ceremonySequence: 1,
        actualStartAt: aStart,
        actualEndAt: aEnd,
        ceremonyCompletedAt: aEnd,
        scheduledStartAtSnapshot: aStart,
        durationMinutesSnapshot: 3,
        breakMinutesSnapshot: 0,
      }),
      makeQueue({
        id: 'b',
        categoryKey: 'cat-b',
        status: 'IN_PROGRESS',
        queueOrder: 1,
        ceremonySequence: 2,
        actualStartAt: bStart,
        actualEndAt: null,
        ceremonyCompletedAt: null,
        scheduledStartAtSnapshot: bStart,
        durationMinutesSnapshot: 3,
        breakMinutesSnapshot: 0,
      }),
      makeQueue({
        id: 'c',
        categoryKey: 'cat-c',
        status: 'PENDING',
        queueOrder: 2,
      }),
    ]

    const schedule = buildCeremonySchedule({ queue, settings, now })
    const reopened = schedule.find((item) => item.categoryKey === 'cat-b')
    const pending = schedule.find((item) => item.categoryKey === 'cat-c')

    expect(reopened?.ceremonySequence).toBe(2)
    expect(reopened?.status).toBe('IN_PROGRESS')
    expect(pending?.timing.estimatedStartAt).toBe(now.toISOString())
  })
})
