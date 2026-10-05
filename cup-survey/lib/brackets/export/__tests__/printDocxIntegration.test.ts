import { describe, expect, it } from 'vitest'
import { buildOlympicV1 } from '../../systems/olympic/v1/build'
import { buildBracketWordDocument } from '../buildBracketWordDocument'
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

function exportCategory(partial: Partial<BracketExportCategory>): BracketExportCategory {
  return {
    categoryKey: 'cat',
    title: 'Test Category',
    discipline: 'TC',
    matIndex: 1,
    competitionStage: 1,
    effectiveSystemId: 'olympic',
    effectiveBronzeMode: 'ONE',
    participantCount: 8,
    structure: { systemId: 'olympic', systemVersion: 1, rounds: [] },
    participants: participants(8),
    boutOutcomes: {},
    result: null,
    ...partial,
  }
}

describe('print docx integration', () => {
  it('packs olympic bracket into a valid docx buffer', async () => {
    const built = buildOlympicV1({
      participants: participants(8),
      drawSeed: 'seed',
      options: { bronzeMode: 'ONE' },
    })
    const category = exportCategory({
      effectiveSystemId: 'olympic',
      participantCount: 8,
      structure: built,
    })
    const buffer = await buildBracketWordDocument([category])
    expect(buffer.byteLength).toBeGreaterThan(5000)
  })
})
