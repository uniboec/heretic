import { describe, expect, it } from 'vitest'
import {
  buildFrozenFirstOrder,
  violatesFrozenPrefix,
} from '../compactFrozenPrefixOnMats'
import type { InternalBout } from '../types'

function bout(id: string, stage = 1): InternalBout {
  return {
    id,
    categoryKey: 'cat',
    competitionStage: stage,
    schedulePhase: 'preliminary',
    matIndex: 1,
    bracketRound: 1,
    bracketPosition: 1,
    sourceBoutIds: [],
    athleteEntryIds: [],
    weightClassKey: 'w',
    ageDivisionKey: 'a',
    genderKey: 'm',
    experienceTier: 'experienced',
    controlStyle: 'close_control',
    isBye: false,
    isWalkover: false,
    isBronzeFight: false,
    isRepechage: false,
    isFinal: false,
    isThirdPlace: false,
    matchNumber: 1,
    scheduledOrder: 1,
  }
}

describe('compactFrozenPrefixOnMats helpers', () => {
  it('moves frozen bouts before upcoming while preserving relative order', () => {
    const bouts = [bout('a'), bout('b'), bout('c'), bout('d')]
    const isFrozen = (id: string) => id === 'a' || id === 'c' || id === 'd'
    expect(buildFrozenFirstOrder(bouts, isFrozen)).toEqual(['a', 'c', 'd', 'b'])
  })

  it('detects frozen prefix violations in scheduled order', () => {
    const isFrozen = (id: string) => id === 'a' || id === 'c'
    expect(violatesFrozenPrefix(['a', 'b', 'c'], isFrozen)).toBe(true)
    expect(violatesFrozenPrefix(['a', 'c', 'b'], isFrozen)).toBe(false)
  })
})
