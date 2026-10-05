import { describe, expect, it, vi, beforeEach } from 'vitest'

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    bracketPageSetting: { findUnique: vi.fn() },
    bracketGeneration: { findFirst: vi.fn() },
    bracketPublicationState: { findMany: vi.fn() },
    boutResult: { findMany: vi.fn() },
    bracketCategoryDraw: { findFirst: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
  },
}))

vi.mock('../../prisma', () => ({
  prisma: prismaMock,
}))

import { prisma } from '../../prisma'
import { patchStructureWithBoutResult } from '../applyResult/patchPublishedStructure'
import { serializePublishedStructure } from '../core/snapshot'
import {
  countBracketCategoriesByCompletion,
  matchesBracketCompletionMode,
} from '../publicCategoryFilters'
import { buildThreeWayV1 } from '../systems/three-way/v1/build'
import { getPublicBrackets, getPublicResults } from '../service'
import '../systems'

const DEFAULT_PAGE_SETTINGS = {
  id: 'default',
  publicEnabled: false,
  includePaid: true,
  includeUnpaid: false,
  consolidationEnabled: false,
  consolidationPolicy: null,
  migrationPendingVisibleKeys: [] as string[],
  updatedAt: new Date(),
}

describe('getPublicBrackets', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prismaMock.$transaction).mockImplementation(async (fn) =>
      typeof fn === 'function' ? fn(prismaMock as never) : fn,
    )
    vi.mocked(prismaMock.bracketCategoryDraw.findFirst).mockResolvedValue(null)
  })

  it('returns null when public page disabled', async () => {
    vi.mocked(prisma.bracketPageSetting.findUnique).mockResolvedValue({
      ...DEFAULT_PAGE_SETTINGS,
      publicEnabled: false,
    })

    expect(await getPublicBrackets()).toBeNull()
  })

  it('returns only ACTIVE categories from published generation', async () => {
    vi.mocked(prisma.bracketPageSetting.findUnique).mockResolvedValue({
      ...DEFAULT_PAGE_SETTINGS,
      publicEnabled: true,
    })

    vi.mocked(prisma.bracketGeneration.findFirst).mockResolvedValue({
      id: 'pub-1',
      status: 'PUBLISHED',
      baseSeed: 'seed',
      sourceRevision: BigInt(0),
      sourceFingerprint: 'fp',
      version: 3,
      generatedAt: new Date(),
      publishedAt: new Date(),
    } as never)

    const publishedDraw = {
      id: 'draw-active',
      generationId: 'pub-1',
      categoryKey: 'cat:active',
      discipline: 'tactic_control',
      title: 'Active',
      status: 'ACTIVE',
      statusReason: null,
      autoSystemId: 'olympic',
      systemOverride: null,
      autoBronzeMode: null,
      bronzeModeOverride: null,
      systemVersion: 1,
      drawSeed: 'draw-seed',
      redrawRevision: 1,
      sourceFingerprint: 'cfp',
      seedingFingerprint: 'sfp',
      drawPolicyId: null,
      drawPolicyVersion: null,
      drawInputFingerprint: null,
      publishedStructureJson: null,
      updatedAt: new Date(),
      generation: { id: 'pub-1', status: 'PUBLISHED' },
      participants: [
        {
          id: 'p1',
          drawId: 'draw-active',
          entryId: 'e1',
          seedPosition: 1,
          seedLocked: false,
          snapshotDisplayName: 'Athlete 1',
          snapshotClubName: 'Club',
          snapshotCity: 'City',
          snapshotPublicNumber: 1,
        },
        {
          id: 'p2',
          drawId: 'draw-active',
          entryId: 'e2',
          seedPosition: 2,
          seedLocked: false,
          snapshotDisplayName: 'Athlete 2',
          snapshotClubName: 'Club 2',
          snapshotCity: 'City',
          snapshotPublicNumber: 2,
        },
      ],
    }

    vi.mocked(prisma.boutResult.findMany).mockResolvedValue([])

    vi.mocked(prisma.bracketPublicationState.findMany).mockResolvedValue([
      {
        id: 'state-1',
        categoryKey: 'cat:active',
        visible: true,
        publishedDrawId: 'draw-active',
        updatedAt: new Date(),
        publishedDraw: publishedDraw,
      },
    ] as never)

    const result = await getPublicBrackets()
    expect(result?.published).toBe(true)
    expect(result?.categories).toHaveLength(1)
    expect(result?.categories[0].categoryKey).toBe('cat:active')
    expect(result?.categories[0].structure?.systemId).toBe('olympic')
    expect(result?.categories[0].result?.status).toBe('in_progress')

    expect(prisma.boutResult.findMany).toHaveBeenCalledWith({
      where: {
        boutId: { in: expect.any(Array) },
        isCurrent: true,
        resultStatus: 'ACTIVE',
      },
    })

    expect(prisma.bracketPublicationState.findMany).toHaveBeenCalledWith({
      include: {
        publishedDraw: {
          include: {
            generation: true,
            participants: { orderBy: { seedPosition: 'asc' } },
          },
        },
      },
    })
  })

  it('returns three_way stored complete without slotSource as completed, not active', async () => {
    vi.mocked(prisma.bracketPageSetting.findUnique).mockResolvedValue({
      ...DEFAULT_PAGE_SETTINGS,
      publicEnabled: true,
    })

    vi.mocked(prisma.bracketGeneration.findFirst).mockResolvedValue({
      id: 'pub-1',
      status: 'PUBLISHED',
      baseSeed: 'seed',
      sourceRevision: BigInt(0),
      sourceFingerprint: 'fp',
      version: 3,
      generatedAt: new Date(),
      publishedAt: new Date(),
    } as never)

    const participants = [
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
    ]

    let structure = buildThreeWayV1({
      participants,
      drawSeed: 'seed',
      options: { bronzeMode: null },
    })

    const drawParticipants = participants.map((participant, index) => ({
      id: `p-${index + 1}`,
      drawId: 'draw-three-way',
      entryId: participant.entryId,
      seedPosition: participant.seedPosition,
      seedLocked: participant.seedLocked,
      snapshotDisplayName: participant.displayName,
      snapshotClubName: participant.clubName,
      snapshotCity: participant.city,
      snapshotPublicNumber: participant.publicNumber,
    }))

    for (const [boutId, winner, loser] of [
      ['cat:three::bout-1', 'a1', 'a2'],
      ['cat:three::bout-2', 'a1', 'a3'],
      ['cat:three::bout-3', 'a1', 'a2'],
    ] as const) {
      structure = patchStructureWithBoutResult({
        structure,
        boutId,
        winnerEntryId: winner,
        loserEntryId: loser,
        participants: drawParticipants,
        systemId: 'three_way',
        bronzeMode: null,
        participantCount: 3,
      }).structure
    }

    const prodLike = {
      ...structure,
      rounds: structure.rounds.map((match) => ({
        ...match,
        slotSourceA: null,
        slotSourceB: null,
      })),
      result: {
        status: 'complete' as const,
        placements: [
          { entryId: 'a1', placement: 1, reason: 'FINAL_WINNER' as const },
          { entryId: 'a2', placement: 2, reason: 'FINAL_LOSER' as const },
          { entryId: 'a3', placement: 3, reason: 'BRONZE_LOSER' as const },
        ],
      },
    }

    const publishedDraw = {
      id: 'draw-three-way',
      generationId: 'pub-1',
      categoryKey: 'cat:three',
      discipline: 'close_control',
      title: 'Three way',
      status: 'ACTIVE',
      statusReason: null,
      autoSystemId: 'three_way',
      systemOverride: null,
      autoBronzeMode: null,
      bronzeModeOverride: null,
      systemVersion: 1,
      drawSeed: 'draw-seed',
      redrawRevision: 1,
      sourceFingerprint: 'cfp',
      seedingFingerprint: 'sfp',
      drawPolicyId: null,
      drawPolicyVersion: null,
      drawInputFingerprint: null,
      publishedStructureJson: serializePublishedStructure({
        systemId: 'three_way',
        systemVersion: 1,
        structure: prodLike,
      }),
      updatedAt: new Date(),
      generation: { id: 'pub-1', status: 'PUBLISHED' },
      participants: drawParticipants,
    }

    vi.mocked(prisma.boutResult.findMany).mockResolvedValue([])
    vi.mocked(prisma.bracketPublicationState.findMany).mockResolvedValue([
      {
        id: 'state-three-way',
        categoryKey: 'cat:three',
        visible: true,
        publishedDrawId: 'draw-three-way',
        updatedAt: new Date(),
        publishedDraw,
      },
    ] as never)

    const result = await getPublicBrackets()
    const category = result?.categories[0]
    expect(category?.result?.status).toBe('complete')
    expect(category?.result?.placements).toHaveLength(3)
    expect(matchesBracketCompletionMode(category!, 'active')).toBe(false)
    expect(matchesBracketCompletionMode(category!, 'completed')).toBe(true)
    expect(countBracketCategoriesByCompletion(result?.categories ?? [])).toEqual({
      active: 0,
      completed: 1,
      all: 1,
    })
  })
})

describe('getPublicResults', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prismaMock.$transaction).mockImplementation(async (fn) =>
      typeof fn === 'function' ? fn(prismaMock as never) : fn,
    )
    vi.mocked(prismaMock.bracketCategoryDraw.findFirst).mockResolvedValue(null)
  })

  it('returns null when public page disabled', async () => {
    vi.mocked(prisma.bracketPageSetting.findUnique).mockResolvedValue({
      ...DEFAULT_PAGE_SETTINGS,
      publicEnabled: false,
    })

    expect(await getPublicResults()).toBeNull()
  })

  it('returns empty rows when no published generation exists', async () => {
    vi.mocked(prisma.bracketPageSetting.findUnique).mockResolvedValue({
      ...DEFAULT_PAGE_SETTINGS,
      publicEnabled: true,
    })
    vi.mocked(prisma.bracketGeneration.findFirst).mockResolvedValue(null)

    const result = await getPublicResults()
    expect(result).toEqual({
      published: false,
      publishedAt: null,
      rows: [],
      filterCategories: [],
      stats: { medalists: 0, categoriesWithResults: 0 },
    })
  })
})
