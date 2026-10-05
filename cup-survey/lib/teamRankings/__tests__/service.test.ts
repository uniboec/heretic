import { beforeEach, describe, expect, it, vi } from 'vitest'
import { filterBoutResultsForTournamentScope } from '../service'

const mocks = vi.hoisted(() => ({
  getBracketPageSettings: vi.fn(),
  getTeamRankingSettings: vi.fn(),
  getActivePublishedGeneration: vi.fn(),
  getPublicVisiblePublishedDraws: vi.fn(),
}))

vi.mock('@/lib/brackets/service', () => ({
  getBracketPageSettings: mocks.getBracketPageSettings,
}))

vi.mock('@/lib/teamRankings/settings', () => ({
  getTeamRankingSettings: mocks.getTeamRankingSettings,
  toTeamRankingPointSettings: (settings: {
    firstPlacePoints: number
    secondPlacePoints: number
    thirdPlacePoints: number
    soloParticipantPointsMode: string
    soloParticipantFirstPlacePoints: number | null
  }) => ({
    first: settings.firstPlacePoints,
    second: settings.secondPlacePoints,
    third: settings.thirdPlacePoints,
    soloParticipant: {
      mode: settings.soloParticipantPointsMode,
      points: settings.soloParticipantFirstPlacePoints,
    },
  }),
}))

vi.mock('@/lib/brackets/generation/publishedDraws', () => ({
  getActivePublishedGeneration: mocks.getActivePublishedGeneration,
  getPublicVisiblePublishedDraws: mocks.getPublicVisiblePublishedDraws,
}))

vi.mock('@/lib/brackets/lazyReconcilePublishedStructure', () => ({
  maybeLazyReconcileCategoryPublishedStructure: vi.fn(),
}))

vi.mock('@/lib/bouts/boutResultQueries', () => ({
  listActiveBoutResultsForBoutIds: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: vi.fn(async (callback: (tx: unknown) => Promise<void>) => callback({})),
  },
}))

describe('filterBoutResultsForTournamentScope', () => {
  it('keeps only results from the active tournament scope', () => {
    const filtered = filterBoutResultsForTournamentScope(
      [
        { id: 'a', tournamentScopeId: 'cup-2026' },
        { id: 'b', tournamentScopeId: 'other' },
      ],
      'cup-2026',
    )

    expect(filtered).toEqual([{ id: 'a', tournamentScopeId: 'cup-2026' }])
  })
})

describe('getPublicTeamRankings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getBracketPageSettings.mockResolvedValue({ publicEnabled: true })
    mocks.getTeamRankingSettings.mockResolvedValue({
      tournamentScopeId: 'cup-2026',
      firstPlacePoints: 5,
      secondPlacePoints: 3,
      thirdPlacePoints: 2,
      soloParticipantPointsMode: 'STANDARD',
      soloParticipantFirstPlacePoints: null,
    })
    mocks.getActivePublishedGeneration.mockResolvedValue({
      publishedAt: new Date('2026-10-03T10:00:00.000Z'),
    })
    mocks.getPublicVisiblePublishedDraws.mockResolvedValue([])
  })

  it('returns null when public brackets are disabled', async () => {
    mocks.getBracketPageSettings.mockResolvedValue({ publicEnabled: false })
    const { getPublicTeamRankings } = await import('../service')
    await expect(getPublicTeamRankings('all')).resolves.toBeNull()
  })

  it('returns unpublished payload when brackets are not published', async () => {
    mocks.getActivePublishedGeneration.mockResolvedValue(null)
    const { getPublicTeamRankings } = await import('../service')
    const result = await getPublicTeamRankings('all')
    expect(result?.published).toBe(false)
    expect(result?.rows).toEqual([])
    expect(result?.rankingStatus).toBe('in_progress')
  })
})
