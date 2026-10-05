import { describe, expect, it } from 'vitest'
import { buildOlympicV1 } from '../../systems/olympic/v1/build'
import { buildBracketPdfDocument } from '../buildBracketPdfDocument'
import type { BracketExportCategory } from '../types'

function participants(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    entryId: `e${index + 1}`,
    seedPosition: index + 1,
    displayName: `Athlete ${index + 1}`,
    clubName: `Club ${index + 1}`,
    city: 'City',
  }))
}

function category(partial: Partial<BracketExportCategory>): BracketExportCategory {
  return {
    categoryKey: 'cat',
    title: 'Test category',
    discipline: 'TC',
    matIndex: 1,
    competitionStage: 1,
    effectiveSystemId: 'olympic',
    effectiveBronzeMode: 'ONE',
    participantCount: 4,
    structure: { systemId: 'olympic', systemVersion: 1, rounds: [] },
    participants: participants(4),
    boutOutcomes: {},
    result: null,
    ...partial,
  }
}

describe('buildBracketPdfDocument', () => {
  it('builds a non-empty pdf for olympic four', async () => {
    const built = buildOlympicV1({
      participants: participants(4),
      drawSeed: 'seed',
      options: { bronzeMode: 'ONE' },
    })
    const buffer = await buildBracketPdfDocument([
      category({ structure: built, participantCount: 4 }),
    ])

    expect(buffer.byteLength).toBeGreaterThan(10_000)
    expect(Buffer.from(buffer).subarray(0, 4).toString('utf8')).toBe('%PDF')
  })
})
