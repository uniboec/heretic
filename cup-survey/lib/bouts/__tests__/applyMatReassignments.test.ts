import { describe, expect, it } from 'vitest'
import { applyMatReassignmentsFromOverrides } from '../applyMatReassignments'
import type { InternalBout } from '../types'

function bout(id: string, categoryKey = 'cat'): InternalBout {
  return {
    id,
    matchNumber: 1,
    categoryKey,
    categoryTitle: '55 кг',
    discipline: 'TC',
    storedMatIndex: 1,
    competitionStage: 1,
    schedulePhase: 'elimination',
    round: 1,
    roundsUntilFinal: 1,
    sideA: {
      kind: 'athlete',
      entryId: 'a',
      displayName: 'A',
      clubName: 'C',
      city: 'X',
    },
    sideB: {
      kind: 'athlete',
      entryId: 'b',
      displayName: 'B',
      clubName: 'C',
      city: 'Y',
    },
  }
}

describe('applyMatReassignmentsFromOverrides', () => {
  it('moves bout to target mat when assignedMatIndex override is set', () => {
    const grouped = {
      mats: [
        { matIndex: 1, bouts: [bout('b1'), bout('b2')] },
        { matIndex: 2, bouts: [bout('b3')] },
      ],
      warnings: [],
    }

    const result = applyMatReassignmentsFromOverrides(grouped, { b2: { assignedMatIndex: 2 } }, 2)

    expect(result.mats.find((mat) => mat.matIndex === 1)?.bouts.map((entry) => entry.id)).toEqual([
      'b1',
    ])
    expect(result.mats.find((mat) => mat.matIndex === 2)?.bouts.map((entry) => entry.id).sort()).toEqual([
      'b2',
      'b3',
    ])
  })

  it('ignores out-of-range assignedMatIndex', () => {
    const grouped = {
      mats: [{ matIndex: 1, bouts: [bout('b1')] }],
      warnings: [],
    }

    const result = applyMatReassignmentsFromOverrides(grouped, { b1: { assignedMatIndex: 5 } }, 2)

    expect(result.mats[0]?.bouts.map((entry) => entry.id)).toEqual(['b1'])
  })
})
