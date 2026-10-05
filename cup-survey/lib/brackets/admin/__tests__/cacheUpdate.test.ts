import { describe, expect, it } from 'vitest'
import { applyDraftMutationToDashboard } from '../cacheUpdate'
import type { AdminCategoryMetadata } from '../types'

const baseCategory = (overrides: Partial<AdminCategoryMetadata> = {}): AdminCategoryMetadata => ({
  id: 'draw-1',
  categoryKey: 'cat-a',
  title: 'Category A',
  status: 'ACTIVE',
  statusReason: null,
  autoSystemId: 'olympic',
  systemOverride: null,
  autoBronzeMode: null,
  bronzeModeOverride: null,
  effectiveSystemId: 'olympic',
  effectiveBronzeMode: 'TWO',
  allowedSystemIds: ['olympic'],
  formatRuleLabel: null,
  compositionStale: false,
  seedingStale: false,
  balanceStale: false,
  publicVisible: false,
  matIndex: null,
  publicationState: {
    categoryKey: 'cat-a',
    visible: false,
    boutsReleased: false,
    matCountAtRelease: null,
    publishedDrawId: null,
    publishedGenerationId: null,
    controlsEnabled: false,
  },
  participants: [
    {
      id: 'p1',
      entryId: 'e1',
      seedPosition: 1,
      seedLocked: false,
      displayName: 'Athlete',
      clubName: 'Club',
      clubKey: 'club-a',
      isManualMove: false,
    },
  ],
  ...overrides,
})

describe('applyDraftMutationToDashboard', () => {
  it('merges a single category without full refetch', () => {
    const previous = {
      settings: { publicEnabled: false, includePaid: true, includeUnpaid: false },
      draft: { id: 'draft-1', version: 1 },
      published: null,
      controlsEnabled: false,
      autoSyncFailures: [],
      diff: {
        globalCompositionStale: false,
        registrationDataStale: false,
        eligibilityCriteriaStale: false,
      },
      categories: [baseCategory()],
      allCategoryKeys: [{ key: 'cat-a', title: 'Category A', participantCount: 1 }],
    }

    const updated = baseCategory({
      balanceStale: true,
      participants: [
        {
          id: 'p1',
          entryId: 'e1',
          seedPosition: 2,
          seedLocked: true,
          displayName: 'Athlete',
          clubName: 'Club',
          clubKey: 'club-a',
          isManualMove: false,
        },
      ],
    })

    const next = applyDraftMutationToDashboard(previous, {
      draft: { id: 'draft-1', version: 2 },
      category: updated,
    })

    expect(next?.draft?.version).toBe(2)
    expect(next?.categories[0]?.balanceStale).toBe(true)
    expect(next?.categories[0]?.participants[0]?.seedPosition).toBe(2)
  })

  it('replaces the full category list on sync all', () => {
    const previous = {
      settings: { publicEnabled: false, includePaid: true, includeUnpaid: false },
      draft: { id: 'draft-1', version: 1 },
      published: null,
      controlsEnabled: false,
      autoSyncFailures: [],
      diff: {
        globalCompositionStale: false,
        registrationDataStale: false,
        eligibilityCriteriaStale: false,
      },
      categories: [baseCategory()],
      allCategoryKeys: [{ key: 'cat-a', title: 'Category A', participantCount: 1 }],
    }

    const next = applyDraftMutationToDashboard(previous, {
      draft: { id: 'draft-1', version: 2 },
      replaceCategories: true,
      categories: [],
    })

    expect(next?.categories).toEqual([])
  })

  it('updates allCategoryKeys after moving into a target category', () => {
    const participant = (entryId: string, displayName: string) => ({
      id: `p-${entryId}`,
      entryId,
      seedPosition: 1,
      seedLocked: false,
      displayName,
      clubName: 'Club',
      clubKey: 'club-a',
      isManualMove: false,
    })

    const previous = {
      settings: { publicEnabled: false, includePaid: true, includeUnpaid: false },
      draft: { id: 'draft-1', version: 1 },
      published: null,
      controlsEnabled: false,
      autoSyncFailures: [],
      diff: {
        globalCompositionStale: false,
        registrationDataStale: false,
        eligibilityCriteriaStale: false,
      },
      categories: [
        baseCategory({
          categoryKey: 'cat-a',
          title: 'Category A',
          participants: [participant('e1', 'Athlete One'), participant('e2', 'Athlete Two')],
        }),
      ],
      allCategoryKeys: [
        { key: 'cat-a', title: 'Category A', participantCount: 2 },
        { key: 'cat-b', title: 'Category B', participantCount: 0 },
      ],
    }

    const firstMove = applyDraftMutationToDashboard(previous, {
      draft: { id: 'draft-1', version: 2 },
      categories: [
        baseCategory({
          categoryKey: 'cat-a',
          title: 'Category A',
          participants: [participant('e2', 'Athlete Two')],
        }),
        baseCategory({
          categoryKey: 'cat-b',
          title: 'Category B',
          participants: [{ ...participant('e1', 'Athlete One'), isManualMove: true }],
        }),
      ],
    })

    expect(firstMove?.allCategoryKeys).toEqual([
      { key: 'cat-a', title: 'Category A', participantCount: 1 },
      { key: 'cat-b', title: 'Category B', participantCount: 1 },
    ])

    const secondMove = applyDraftMutationToDashboard(firstMove, {
      draft: { id: 'draft-1', version: 3 },
      categories: [
        baseCategory({
          categoryKey: 'cat-a',
          title: 'Category A',
          participants: [],
        }),
        baseCategory({
          categoryKey: 'cat-b',
          title: 'Category B',
          participants: [
            { ...participant('e1', 'Athlete One'), isManualMove: true },
            { ...participant('e2', 'Athlete Two'), seedPosition: 2, isManualMove: true },
          ],
        }),
      ],
    })

    expect(secondMove?.allCategoryKeys).toEqual([
      { key: 'cat-a', title: 'Category A', participantCount: 0 },
      { key: 'cat-b', title: 'Category B', participantCount: 2 },
    ])
    expect(secondMove?.categories).toHaveLength(1)
    expect(secondMove?.categories[0]?.categoryKey).toBe('cat-b')
  })
})
