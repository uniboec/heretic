import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BracketExportError } from '../errors'

vi.mock('@/lib/brackets/service', () => ({
  getAdminBracketsDashboard: vi.fn(),
  getAdminLiveCategoryStructure: vi.fn(),
}))

vi.mock('@/lib/registration/categoryIdentity', () => ({
  parseRegistrationCategoryKey: vi.fn(() => ({ discipline: 'tactic_control' })),
}))

vi.mock('@/lib/config/tournament', () => ({
  getDisciplineShortLabel: vi.fn(() => 'TC'),
}))

import { getAdminBracketsDashboard, getAdminLiveCategoryStructure } from '@/lib/brackets/service'
import { loadBracketExportCategories } from '../loadExportCategories'

const championStructure = {
  systemId: 'champion',
  systemVersion: 1,
  rounds: [],
  champion: { entryId: 'e1', displayName: 'A', clubName: 'C', city: '', publicNumber: 1 },
}

function dashboardCategory(partial: Record<string, unknown>) {
  return {
    categoryKey: 'cat-a',
    title: 'Alpha',
    status: 'ACTIVE',
    publicVisible: false,
    matIndex: null,
    competitionStage: 1,
    participants: [{ entryId: 'e1' }],
    ...partial,
  }
}

function livePayload(categoryKey: string): NonNullable<Awaited<ReturnType<typeof getAdminLiveCategoryStructure>>> {
  return {
    categoryKey,
    effectiveSystemId: 'champion',
    effectiveBronzeMode: null,
    structure: championStructure,
    result: null,
    boutOutcomes: {},
    isLive: true as const,
    participants: [
      { entryId: 'e1', seedPosition: 1, seedLocked: false, displayName: 'A', clubName: 'C', city: '' },
    ],
  }
}

describe('loadBracketExportCategories', () => {
  beforeEach(() => {
    vi.mocked(getAdminBracketsDashboard).mockReset()
    vi.mocked(getAdminLiveCategoryStructure).mockReset()
  })

  it('includes ACTIVE categories regardless of publicVisible and sorts export list', async () => {
    vi.mocked(getAdminBracketsDashboard).mockResolvedValue({
      categories: [
        dashboardCategory({ categoryKey: 'cat-b', title: 'Bravo', matIndex: 2, competitionStage: 2, publicVisible: false }),
        dashboardCategory({ categoryKey: 'cat-a', title: 'Alpha', matIndex: 1, competitionStage: 1, publicVisible: true }),
        dashboardCategory({ categoryKey: 'cat-x', title: 'Hidden', status: 'INACTIVE', publicVisible: false }),
      ],
    } as never)

    vi.mocked(getAdminLiveCategoryStructure).mockImplementation(async (key: string) => livePayload(key))

    const result = await loadBracketExportCategories()
    expect(result.map((c) => c.categoryKey)).toEqual(['cat-a', 'cat-b'])
  })

  it('aborts bulk export when ACTIVE category has no formed structure', async () => {
    vi.mocked(getAdminBracketsDashboard).mockResolvedValue({
      categories: [
        dashboardCategory({ categoryKey: 'ok', title: 'OK' }),
        dashboardCategory({ categoryKey: 'bad', title: 'Broken' }),
      ],
    } as never)

    vi.mocked(getAdminLiveCategoryStructure).mockImplementation(async (key: string) => {
      if (key === 'bad') return null
      return livePayload(key)
    })

    await expect(loadBracketExportCategories()).rejects.toMatchObject({
      status: 500,
      categoryKey: 'bad',
    })
  })

  it('returns 422 for inactive single export', async () => {
    vi.mocked(getAdminBracketsDashboard).mockResolvedValue({
      categories: [dashboardCategory({ categoryKey: 'inactive', status: 'INACTIVE' })],
    } as never)

    await expect(loadBracketExportCategories('inactive')).rejects.toMatchObject({ status: 422 })
  })
})
