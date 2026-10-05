import { describe, expect, it } from 'vitest'
import { buildOlympicV1 } from '../../systems/olympic/v1/build'
import { buildBracketPrintModel } from '../buildBracketPrintModel'
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

describe('splitPrintPages anchors', () => {
  it('assigns outgoing and incoming anchors for olympic 16', () => {
    const built = buildOlympicV1({
      participants: participants(16),
      drawSeed: 'seed',
      options: { bronzeMode: 'ONE' },
    })
    const model = buildBracketPrintModel({
      categoryKey: 'cat',
      title: 'Test',
      discipline: null,
      matIndex: 1,
      competitionStage: 1,
      effectiveSystemId: 'olympic',
      effectiveBronzeMode: 'ONE',
      participantCount: 16,
      structure: built,
      participants: participants(16),
      boutOutcomes: {},
      result: null,
    })
    expect(model.pages.length).toBeGreaterThan(1)
    expect(model.pages[0]?.chrome.outgoingAnchors[0]?.label).toBe('A1')
    expect(model.pages[1]?.chrome.incomingAnchors[0]?.label).toBe('A1')
  })
})
