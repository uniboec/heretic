import { afterEach, describe, expect, it } from 'vitest'
import { buildOlympicV1 } from '../systems/olympic/v1/build'
import {
  categoryStructureNeedsLazyReconcile,
  isLazyReconcileDisabled,
} from '../lazyReconcilePublishedStructure'

const participants4 = [
  {
    entryId: 'a1',
    displayName: 'A1',
    clubName: 'C',
    city: 'X',
    clubIdentity: 'c',
    publicNumber: 1,
    seedPosition: 1,
    seedLocked: false,
  },
  {
    entryId: 'a2',
    displayName: 'A2',
    clubName: 'C',
    city: 'X',
    clubIdentity: 'c',
    publicNumber: 2,
    seedPosition: 2,
    seedLocked: false,
  },
  {
    entryId: 'a3',
    displayName: 'A3',
    clubName: 'C',
    city: 'X',
    clubIdentity: 'c',
    publicNumber: 3,
    seedPosition: 3,
    seedLocked: false,
  },
  {
    entryId: 'a4',
    displayName: 'A4',
    clubName: 'C',
    city: 'X',
    clubIdentity: 'c',
    publicNumber: 4,
    seedPosition: 4,
    seedLocked: false,
  },
]

describe('isLazyReconcileDisabled', () => {
  const previous = process.env.CUP_DISABLE_LAZY_RECONCILE

  afterEach(() => {
    if (previous === undefined) {
      delete process.env.CUP_DISABLE_LAZY_RECONCILE
    } else {
      process.env.CUP_DISABLE_LAZY_RECONCILE = previous
    }
  })

  it('returns true when CUP_DISABLE_LAZY_RECONCILE=1', () => {
    process.env.CUP_DISABLE_LAZY_RECONCILE = '1'
    expect(isLazyReconcileDisabled()).toBe(true)
  })

  it('returns false when flag is unset', () => {
    delete process.env.CUP_DISABLE_LAZY_RECONCILE
    expect(isLazyReconcileDisabled()).toBe(false)
  })
})

describe('categoryStructureNeedsLazyReconcile', () => {
  it('returns true when active BoutResult exists but match winner is missing', () => {
    const structure = buildOlympicV1({
      participants: participants4,
      drawSeed: 'seed',
      options: { bronzeMode: 'ONE' },
    })

    expect(
      categoryStructureNeedsLazyReconcile(structure, new Set(['cat::bout-1'])),
    ).toBe(true)
  })

  it('returns false when stored structure already reflects the bout winner', () => {
    const structure = buildOlympicV1({
      participants: participants4,
      drawSeed: 'seed',
      options: { bronzeMode: 'ONE' },
    })
    structure.rounds[0] = {
      ...structure.rounds[0]!,
      winnerEntryId: 'a1',
      loserEntryId: 'a4',
    }
    structure.result = { status: 'in_progress', placements: [] }

    expect(
      categoryStructureNeedsLazyReconcile(structure, new Set(['cat::bout-1'])),
    ).toBe(false)
  })
})
