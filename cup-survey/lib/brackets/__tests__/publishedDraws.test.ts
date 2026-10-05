import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('../../prisma', () => ({
  prisma: {
    bracketGeneration: { findFirst: vi.fn() },
    bracketPublicationState: { findMany: vi.fn() },
    $queryRaw: vi.fn().mockResolvedValue([{ exists: false }]),
  },
}))

import { prisma } from '../../prisma'
import {
  getActivePublishedDraws,
  getActivePublishedGeneration,
  getBoutsReleasedPublishedDraws,
  getPublicVisiblePublishedDraws,
} from '../generation/publishedDraws'

describe('publishedDraws helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getActivePublishedGeneration resolves ACTIVE singleton first', async () => {
    vi.mocked(prisma.bracketGeneration.findFirst).mockResolvedValue(null)

    await getActivePublishedGeneration()

    expect(prisma.bracketGeneration.findFirst).toHaveBeenCalledWith({
      where: { singletonKey: 'live', status: 'ACTIVE' },
    })
  })

  it('getActivePublishedDraws applies exact join without visible filter', async () => {
    const activeGeneration = {
      id: 'pub-1',
      status: 'ACTIVE',
      singletonKey: 'live',
      baseSeed: 'seed',
      sourceRevision: BigInt(0),
      sourceFingerprint: 'fp',
      version: 1,
      generatedAt: new Date(),
      publishedAt: new Date(),
    } as const

    const activeDraw = {
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
      generation: activeGeneration,
      participants: [],
    }

    const hiddenDraw = {
      ...activeDraw,
      id: 'draw-hidden',
      categoryKey: 'cat:hidden',
      title: 'Hidden',
    }

    vi.mocked(prisma.bracketPublicationState.findMany).mockResolvedValue([
      {
        id: 'state-visible',
        categoryKey: 'cat:active',
        visible: true,
        boutsReleased: true,
        boutMatAssignments: null,
        matCountAtRelease: 1,
        publishedDrawId: 'draw-active',
        scheduleOverrides: {
          'cat:active::bout-1': { queueAfterBoutId: 'cat:active::bout-2' },
        },
        updatedAt: new Date(),
        publishedDraw: activeDraw,
      },
      {
        id: 'state-hidden',
        categoryKey: 'cat:hidden',
        visible: false,
        boutsReleased: false,
        boutMatAssignments: null,
        matCountAtRelease: null,
        publishedDrawId: 'draw-hidden',
        scheduleOverrides: null,
        updatedAt: new Date(),
        publishedDraw: hiddenDraw,
      },
      {
        id: 'state-stale',
        categoryKey: 'cat:stale',
        visible: true,
        boutsReleased: false,
        boutMatAssignments: null,
        matCountAtRelease: null,
        publishedDrawId: 'draw-stale',
        scheduleOverrides: null,
        updatedAt: new Date(),
        publishedDraw: {
          ...activeDraw,
          id: 'draw-stale',
          generationId: 'old-pub',
          categoryKey: 'cat:stale',
          generation: { ...activeGeneration, id: 'old-pub' },
        },
      },
    ] as never)

    const pairs = await getActivePublishedDraws(activeGeneration)
    expect(pairs).toHaveLength(2)
    expect(pairs.map((pair) => pair.draw.categoryKey).sort()).toEqual(['cat:active', 'cat:hidden'])

    const visiblePairs = await getPublicVisiblePublishedDraws(activeGeneration)
    expect(visiblePairs).toHaveLength(1)
    expect(visiblePairs[0]?.draw.categoryKey).toBe('cat:active')

    const releasedPairs = await getBoutsReleasedPublishedDraws(activeGeneration)
    expect(releasedPairs).toHaveLength(1)
    expect(releasedPairs[0]?.draw.categoryKey).toBe('cat:active')
    expect(visiblePairs[0]?.publicationState.publishedDrawId).toBe('draw-active')
    expect(visiblePairs[0]?.publicationState.scheduleOverrides).toEqual({
      'cat:active::bout-1': { queueAfterBoutId: 'cat:active::bout-2' },
    })
  })
})
