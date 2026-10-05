import { describe, expect, it } from 'vitest'
import type { InternalBout } from '@/lib/bouts/types'
import { resolveMatAnnouncerPositionIds } from '../hooks/matHooks'

function athleteBout(id: string): InternalBout {
  return {
    id,
    categoryTitle: 'Test',
    sideA: {
      kind: 'athlete',
      entryId: `${id}-a`,
      displayName: 'A',
      clubName: 'Club',
      city: 'City',
      publicNumber: 1,
    },
    sideB: {
      kind: 'athlete',
      entryId: `${id}-b`,
      displayName: 'B',
      clubName: 'Club',
      city: 'City',
      publicNumber: 2,
    },
    bracketKind: 'single',
    roundIndex: 0,
    boutIndex: 0,
  } as unknown as InternalBout
}

function byeBout(id: string): InternalBout {
  return {
    id,
    categoryTitle: 'Test',
    sideA: {
      kind: 'athlete',
      entryId: `${id}-a`,
      displayName: 'A',
      clubName: 'Club',
      city: 'City',
      publicNumber: 1,
    },
    sideB: { kind: 'bye' },
    bracketKind: 'single',
    roundIndex: 0,
    boutIndex: 0,
  } as unknown as InternalBout
}

describe('resolveMatAnnouncerPositionIds', () => {
  it('uses queue index 0 for call and index 1 for prepare', () => {
    const queue = [
      { bout: { id: 'current-bout' } },
      { bout: { id: 'prepare-bout' } },
      { bout: { id: 'later-bout' } },
    ]

    expect(resolveMatAnnouncerPositionIds(queue)).toEqual({
      currentId: 'current-bout',
      prepareId: 'prepare-bout',
    })
  })

  it('returns null prepare when only one bout remains', () => {
    expect(resolveMatAnnouncerPositionIds([{ bout: { id: 'only' } }])).toEqual({
      currentId: 'only',
      prepareId: null,
    })
  })

  it('returns nulls for empty queue', () => {
    expect(resolveMatAnnouncerPositionIds([])).toEqual({
      currentId: null,
      prepareId: null,
    })
  })

  it('skips non-announceable bouts when bout map is provided', () => {
    const queue = [
      { bout: { id: 'bye-bout' } },
      { bout: { id: 'current-bout' } },
      { bout: { id: 'prepare-bout' } },
    ]
    const boutById = new Map([
      ['bye-bout', byeBout('bye-bout')],
      ['current-bout', athleteBout('current-bout')],
      ['prepare-bout', athleteBout('prepare-bout')],
    ])

    expect(resolveMatAnnouncerPositionIds(queue, { boutById, matIndex: 1 })).toEqual({
      currentId: 'current-bout',
      prepareId: 'prepare-bout',
    })
  })
})
