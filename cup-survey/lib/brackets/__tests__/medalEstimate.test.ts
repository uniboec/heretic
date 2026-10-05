import { describe, expect, it } from 'vitest'
import { estimateCategoryMedals, estimateTournamentMedals } from '../core/medalEstimate'

describe('estimateCategoryMedals', () => {
  it('counts olympic podium with two bronzes', () => {
    expect(
      estimateCategoryMedals({
        status: 'ACTIVE',
        participantCount: 8,
        systemId: 'olympic',
        bronzeMode: 'TWO',
      }),
    ).toEqual({ gold: 1, silver: 1, bronze: 2, included: true })
  })

  it('counts olympic podium with one bronze fight', () => {
    expect(
      estimateCategoryMedals({
        status: 'ACTIVE',
        participantCount: 8,
        systemId: 'olympic',
        bronzeMode: 'ONE',
      }),
    ).toEqual({ gold: 1, silver: 1, bronze: 1, included: true })
  })

  it('has no bronze for olympic with fewer than 4 participants', () => {
    expect(
      estimateCategoryMedals({
        status: 'ACTIVE',
        participantCount: 2,
        systemId: 'olympic',
        bronzeMode: null,
      }),
    ).toEqual({ gold: 1, silver: 1, bronze: 0, included: true })
  })

  it('counts round robin bronze from 3 participants', () => {
    expect(
      estimateCategoryMedals({
        status: 'ACTIVE',
        participantCount: 3,
        systemId: 'round_robin',
        bronzeMode: null,
      }),
    ).toEqual({ gold: 1, silver: 1, bronze: 1, included: true })
  })

  it('counts three_way full podium', () => {
    expect(
      estimateCategoryMedals({
        status: 'ACTIVE',
        participantCount: 3,
        systemId: 'three_way',
        bronzeMode: null,
      }),
    ).toEqual({ gold: 1, silver: 1, bronze: 1, included: true })
  })

  it('counts solo athlete as one gold medal', () => {
    expect(
      estimateCategoryMedals({
        status: 'INACTIVE',
        participantCount: 1,
        systemId: null,
        bronzeMode: null,
      }),
    ).toEqual({ gold: 1, silver: 0, bronze: 0, included: true })
  })

  it('excludes unsupported categories', () => {
    expect(
      estimateCategoryMedals({
        status: 'UNSUPPORTED',
        participantCount: 5,
        systemId: 'olympic',
        bronzeMode: 'TWO',
      }),
    ).toEqual({ gold: 0, silver: 0, bronze: 0, included: false })
  })
})

describe('estimateTournamentMedals', () => {
  it('aggregates across categories', () => {
    const result = estimateTournamentMedals([
      {
        status: 'ACTIVE',
        participantCount: 8,
        systemId: 'olympic',
        bronzeMode: 'TWO',
      },
      {
        status: 'ACTIVE',
        participantCount: 3,
        systemId: 'round_robin',
        bronzeMode: null,
      },
      {
        status: 'INACTIVE',
        participantCount: 1,
        systemId: null,
        bronzeMode: null,
      },
    ])

    expect(result).toEqual({
      gold: 3,
      silver: 2,
      bronze: 3,
      activeCategories: 2,
      soloCategories: 1,
      excludedCategories: 0,
    })
  })

  it('includes solo categories in gold total', () => {
    const result = estimateTournamentMedals([
      {
        status: 'INACTIVE',
        participantCount: 1,
        systemId: null,
        bronzeMode: null,
      },
      {
        status: 'ACTIVE',
        participantCount: 4,
        systemId: 'olympic',
        bronzeMode: 'ONE',
      },
    ])

    expect(result).toEqual({
      gold: 2,
      silver: 1,
      bronze: 1,
      activeCategories: 1,
      soloCategories: 1,
      excludedCategories: 0,
    })
  })
})
