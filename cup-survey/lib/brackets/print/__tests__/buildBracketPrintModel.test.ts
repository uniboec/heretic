import { describe, expect, it } from 'vitest'
import { buildOlympicV1 } from '../../systems/olympic/v1/build'
import { buildBracketPrintModel } from '../buildBracketPrintModel'
import { renderBracketSvg } from '../renderBracketSvg'
import type { BracketExportCategory } from '../../export/types'

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
    title: 'Test',
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

describe('buildBracketPrintModel', () => {
  it('builds single page for olympic 4', () => {
    const built = buildOlympicV1({
      participants: participants(4),
      drawSeed: 'seed',
      options: { bronzeMode: 'ONE' },
    })
    const model = buildBracketPrintModel(category({ structure: built, participantCount: 4 }))
    expect(model.pages).toHaveLength(1)
    expect(model.pages[0]?.layoutKind).toBe('olympicFour')
  })

  it('builds multiple pages for olympic 16', () => {
    const built = buildOlympicV1({
      participants: participants(16),
      drawSeed: 'seed',
      options: { bronzeMode: 'ONE' },
    })
    const model = buildBracketPrintModel(
      category({ structure: built, participantCount: 16, effectiveBronzeMode: 'ONE' }),
    )
    expect(model.pages.length).toBeGreaterThan(1)
    expect(model.pages.at(-1)?.placements.length).toBeGreaterThan(0)
  })

  it('renders SVG with connector paths for olympic four', () => {
    const built = buildOlympicV1({
      participants: participants(4),
      drawSeed: 'seed',
      options: { bronzeMode: 'ONE' },
    })
    const model = buildBracketPrintModel(
      category({
        structure: built,
        participantCount: 4,
        boutsReleased: true,
        scheduleDisplayByBoutId: {
          'cat::bout-1': '2-10',
          'cat::bout-2': '2-11',
          'cat::bout-3': '2-12',
        },
      }),
    )
    const svg = renderBracketSvg(model.pages[0]!)
    expect(svg).toContain('<svg')
    expect(svg).toContain('Бой №')
    expect(svg).toContain('Победитель боя 2-10')
    expect(svg).toMatch(/<path /)
  })
})
