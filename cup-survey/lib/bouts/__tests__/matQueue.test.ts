import { describe, expect, it } from 'vitest'
import { applyMatQueueAfterOverrides } from '../applyMatQueueAfterOverrides'
import {
  buildMatQueue,
  buildMatQueueInOrder,
  resolveMatControlTargetBoutId,
  shouldAutoAlignMatSessionActiveBout,
} from '../matQueue'
import type { InternalBout } from '../types'

function bout(
  id: string,
  feederMatchId?: string,
  side: 'athlete' | 'hint' = 'athlete',
): InternalBout {
  return {
    id,
    matchNumber: 1,
    categoryKey: 'cat-1',
    categoryTitle: 'Cat',
    discipline: 'TC',
    storedMatIndex: 1,
    competitionStage: 1,
    schedulePhase: 'elimination',
    round: 1,
    roundsUntilFinal: 1,
    sideA: side === 'athlete'
      ? { kind: 'athlete', entryId: `${id}-a`, displayName: 'A', clubName: 'C', city: 'X', publicNumber: 1 }
      : { kind: 'hint', label: 'Winner', source: { matchId: feederMatchId!, outcome: 'winner' } },
    sideB: { kind: 'athlete', entryId: `${id}-b`, displayName: 'B', clubName: 'C', city: 'X', publicNumber: 2 },
  }
}

describe('buildMatQueue', () => {
  it('keeps hint bout in blocked queue until participants are known', () => {
    const bouts = [bout('cat-1::m1'), bout('cat-1::m2', 'm1', 'hint')]
    const queue = buildMatQueue({
      bouts,
      completedBoutIds: new Set(),
      activeBoutId: null,
      restUntilByEntryId: new Map(),
      now: new Date(),
    })

    expect(queue.nextAvailable?.bout.id).toBe('cat-1::m1')
    expect(queue.blocked.some((entry) => entry.blockedReason === 'NOT_READY')).toBe(true)
  })

  it('skips REST blocks when skipRestBlocks is true', () => {
    const bouts = [bout('cat-1::m1'), bout('cat-1::m3')]
    const restUntil = new Date(Date.now() + 60_000)
    const queue = buildMatQueue({
      bouts,
      completedBoutIds: new Set(['cat-1::m1']),
      activeBoutId: null,
      restUntilByEntryId: new Map([['cat-1::m3-a', restUntil]]),
      now: new Date(),
      skipRestBlocks: true,
    })

    expect(queue.blocked.some((entry) => entry.blockedReason === 'REST')).toBe(false)
    expect(queue.nextAvailable?.bout.id).toBe('cat-1::m3')
  })

  it('enabled:false regression keeps REST block in queue', () => {
    const bouts = [bout('cat-1::m1'), bout('cat-1::m3')]
    const restUntil = new Date(Date.now() + 60_000)
    const queue = buildMatQueue({
      bouts,
      completedBoutIds: new Set(['cat-1::m1']),
      activeBoutId: null,
      restUntilByEntryId: new Map([['cat-1::m3-a', restUntil]]),
      now: new Date(),
      skipRestBlocks: false,
    })

    expect(queue.blocked.some((entry) => entry.blockedReason === 'REST')).toBe(true)
    expect(queue.nextAvailable).toBeNull()
  })

  it('blocks athlete bout during mandatory rest', () => {
    const bouts = [bout('cat-1::m1'), bout('cat-1::m3')]
    const restUntil = new Date(Date.now() + 60_000)
    const queue = buildMatQueue({
      bouts,
      completedBoutIds: new Set(['cat-1::m1']),
      activeBoutId: null,
      restUntilByEntryId: new Map([['cat-1::m3-a', restUntil]]),
      now: new Date(),
    })

    expect(queue.blocked.some((entry) => entry.blockedReason === 'REST')).toBe(true)
  })

  it('buildMatQueueInOrder preserves runtime order across ready and blocked bouts', () => {
    const bouts = [bout('cat-1::m1'), bout('cat-1::m2', 'm1', 'hint'), bout('cat-1::m3')]
    const ordered = applyMatQueueAfterOverrides(bouts, {
      'cat-1::m1': { queueAfterBoutId: 'cat-1::m3' },
    })

    const queueInOrder = buildMatQueueInOrder({
      bouts: ordered,
      completedBoutIds: new Set(),
      activeBoutId: 'cat-1::m3',
      restUntilByEntryId: new Map(),
      now: new Date(),
    })

    expect(queueInOrder.map((entry) => entry.bout.id)).toEqual([
      'cat-1::m2',
      'cat-1::m3',
      'cat-1::m1',
    ])
    expect(queueInOrder.find((entry) => entry.isActive)?.bout.id).toBe('cat-1::m3')
    expect(queueInOrder.find((entry) => entry.bout.id === 'cat-1::m2')?.blockedReason).toBe(
      'NOT_READY',
    )
  })

  it('shouldAutoAlignMatSessionActiveBout keeps valid focused bout', () => {
    expect(
      shouldAutoAlignMatSessionActiveBout({
        sessionActiveBoutId: 'cat-1::m3',
        matBoutIds: new Set(['cat-1::m1', 'cat-1::m3']),
        completedBoutIds: new Set(),
      }),
    ).toBe(false)
  })

  it('shouldAutoAlignMatSessionActiveBout realigns completed session bout', () => {
    expect(
      shouldAutoAlignMatSessionActiveBout({
        sessionActiveBoutId: 'cat-1::m1',
        matBoutIds: new Set(['cat-1::m1', 'cat-1::m2']),
        completedBoutIds: new Set(['cat-1::m1']),
      }),
    ).toBe(true)
  })

  it('shouldAutoAlignMatSessionActiveBout keeps correction focus pinned', () => {
    expect(
      shouldAutoAlignMatSessionActiveBout({
        sessionActiveBoutId: 'cat-1::m1',
        matBoutIds: new Set(['cat-1::m1', 'cat-1::m2']),
        completedBoutIds: new Set(['cat-1::m1']),
        correctionFocusBoutId: 'cat-1::m1',
      }),
    ).toBe(false)

    expect(
      shouldAutoAlignMatSessionActiveBout({
        sessionActiveBoutId: 'cat-1::m2',
        matBoutIds: new Set(['cat-1::m1', 'cat-1::m2']),
        completedBoutIds: new Set(['cat-1::m1']),
        correctionFocusBoutId: 'cat-1::m1',
      }),
    ).toBe(true)
  })

  it('resolveMatControlTargetBoutId skips confirmed bout after session clears', () => {
    const bouts = [bout('cat-1::m1'), bout('cat-1::m2')]

    expect(
      resolveMatControlTargetBoutId({
        sessionActiveBoutId: null,
        sessionActiveBoutPhase: null,
        orderedMatBouts: bouts,
        completedBoutIds: new Set(['cat-1::m1']),
        restUntilByEntryId: new Map(),
        now: new Date(),
      }),
    ).toBe('cat-1::m2')
  })

  it('resolveMatControlTargetBoutId keeps session bout on the mat', () => {
    const bouts = [bout('cat-1::m1'), bout('cat-1::m3')]
    const ordered = applyMatQueueAfterOverrides(bouts, {
      'cat-1::m1': { queueAfterBoutId: 'cat-1::m3' },
    })

    expect(
      resolveMatControlTargetBoutId({
        sessionActiveBoutId: 'cat-1::m1',
        sessionActiveBoutPhase: 'scheduled',
        orderedMatBouts: ordered,
        completedBoutIds: new Set(),
        restUntilByEntryId: new Map(),
        now: new Date(),
      }),
    ).toBe('cat-1::m1')

    expect(
      resolveMatControlTargetBoutId({
        sessionActiveBoutId: 'cat-1::m1',
        sessionActiveBoutPhase: 'live',
        orderedMatBouts: ordered,
        completedBoutIds: new Set(),
        restUntilByEntryId: new Map(),
        now: new Date(),
      }),
    ).toBe('cat-1::m1')
  })

  it('resolveMatControlTargetBoutId ignores session bout that moved off the mat', () => {
    const bouts = [bout('cat-1::m1'), bout('cat-1::m2')]

    expect(
      resolveMatControlTargetBoutId({
        sessionActiveBoutId: 'cat-1::m2',
        sessionActiveBoutPhase: 'live',
        orderedMatBouts: [bouts[0]!],
        completedBoutIds: new Set(),
        restUntilByEntryId: new Map(),
        now: new Date(),
      }),
    ).toBe('cat-1::m1')
  })

  it('resolveMatControlTargetBoutId advances past completed session bout', () => {
    const bouts = [bout('cat-1::m1'), bout('cat-1::m2')]

    expect(
      resolveMatControlTargetBoutId({
        sessionActiveBoutId: 'cat-1::m1',
        sessionActiveBoutPhase: 'confirmed',
        orderedMatBouts: bouts,
        completedBoutIds: new Set(['cat-1::m1']),
        restUntilByEntryId: new Map(),
        now: new Date(),
      }),
    ).toBe('cat-1::m2')
  })

  it('resolveMatControlTargetBoutId keeps explicit focus outside runtime order', () => {
    const bouts = [bout('cat-1::m1')]
    const matBoutIds = new Set(['cat-1::m1', 'cat-1::m3'])

    expect(
      resolveMatControlTargetBoutId({
        sessionActiveBoutId: 'cat-1::m3',
        sessionActiveBoutPhase: 'scheduled',
        orderedMatBouts: bouts,
        matBoutIds,
        completedBoutIds: new Set(),
        restUntilByEntryId: new Map(),
        now: new Date(),
      }),
    ).toBe('cat-1::m3')
  })

  it('resolveMatControlTargetBoutId prefers in-progress bout on the mat', () => {
    const bouts = [bout('cat-1::m1'), bout('cat-1::m2')]

    expect(
      resolveMatControlTargetBoutId({
        sessionActiveBoutId: null,
        sessionActiveBoutPhase: null,
        orderedMatBouts: bouts,
        completedBoutIds: new Set(),
        restUntilByEntryId: new Map(),
        now: new Date(),
        matInProgressBoutId: 'cat-1::m2',
      }),
    ).toBe('cat-1::m2')
  })

  it('resolveMatControlTargetBoutId prefers correction focus over in-progress bout', () => {
    const bouts = [bout('cat-1::m1'), bout('cat-1::m2')]

    expect(
      resolveMatControlTargetBoutId({
        sessionActiveBoutId: 'cat-1::m1',
        sessionActiveBoutPhase: 'confirmed',
        orderedMatBouts: bouts,
        completedBoutIds: new Set(['cat-1::m1']),
        restUntilByEntryId: new Map(),
        now: new Date(),
        matInProgressBoutId: 'cat-1::m2',
        correctionFocusBoutId: 'cat-1::m1',
      }),
    ).toBe('cat-1::m1')
  })
})
