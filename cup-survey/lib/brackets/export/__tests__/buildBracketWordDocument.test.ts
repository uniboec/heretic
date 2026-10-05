import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BracketExportCategory } from '../types'
import { BracketExportRenderError } from '../errors'

vi.mock('../renderCategoryDocx', () => ({
  renderCategorySectionChildren: vi.fn(async (category: BracketExportCategory) => {
    if (category.categoryKey === 'bad') {
      throw new BracketExportRenderError('Renderer failed', 'bad')
    }
    return [{ mock: true, categoryKey: category.categoryKey }]
  }),
}))

vi.mock('../resolveCategoryPageLayout', () => ({
  resolveCategoryPageLayout: vi.fn((category: BracketExportCategory) => {
    if (category.categoryKey === 'landscape') return { orientation: 'landscape' as const }
    return { orientation: 'portrait' as const }
  }),
}))

vi.mock('../../print/buildBracketPrintModel', () => ({
  buildBracketPrintModel: vi.fn((category: BracketExportCategory) => ({
    orientation: category.categoryKey === 'landscape' ? 'landscape' : 'portrait',
    pages: [{ layoutKind: 'champion' }],
  })),
}))

import { SectionType } from 'docx'
import {
  buildBracketWordDocument,
  buildExportDocumentSectionSpecs,
} from '../buildBracketWordDocument'
import { renderCategorySectionChildren } from '../renderCategoryDocx'

function sampleCategory(key: string): BracketExportCategory {
  return {
    categoryKey: key,
    title: key,
    discipline: null,
    matIndex: null,
    competitionStage: 1,
    effectiveSystemId: 'champion',
    participantCount: 1,
    structure: {
      systemId: 'champion',
      systemVersion: 1,
      rounds: [],
      champion: { entryId: 'x', displayName: 'A', clubName: 'C', city: '', publicNumber: 1 },
    },
    participants: [{ entryId: 'x', seedPosition: 1, displayName: 'A', clubName: 'C' }],
    boutOutcomes: {},
    result: null,
  }
}

describe('buildBracketWordDocument', () => {
  beforeEach(() => {
    vi.mocked(renderCategorySectionChildren).mockClear()
  })

  it('builds buffer when all categories succeed', async () => {
    const buffer = await buildBracketWordDocument([sampleCategory('ok1'), sampleCategory('ok2')])
    expect(buffer.byteLength).toBeGreaterThan(1000)
    expect(renderCategorySectionChildren).toHaveBeenCalledTimes(2)
  })

  it('aborts bulk export when any category fails', async () => {
    await expect(
      buildBracketWordDocument([sampleCategory('ok1'), sampleCategory('bad'), sampleCategory('ok3')]),
    ).rejects.toMatchObject({ categoryKey: 'bad', status: 500 })
    expect(renderCategorySectionChildren).toHaveBeenCalledTimes(2)
  })

  it('omits title section by default', () => {
    const specs = buildExportDocumentSectionSpecs([sampleCategory('a'), sampleCategory('b')])
    expect(specs).toHaveLength(2)
    expect(specs[0]?.orientation).toBe('portrait')
  })

  it('adds title section when includeTitlePage is true', () => {
    const specs = buildExportDocumentSectionSpecs([sampleCategory('a')], { includeTitlePage: true })
    expect(specs).toHaveLength(2)
    expect(specs[0]?.orientation).toBe('portrait')
    expect(specs[1]?.sectionType).toBe(SectionType.NEXT_PAGE)
  })
})
