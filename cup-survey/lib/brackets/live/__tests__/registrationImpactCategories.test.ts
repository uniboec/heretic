import { describe, expect, it } from 'vitest'
import { getRegistrationCategoryKey } from '../../../registration/categoryIdentity'

const SOURCE_KEY = getRegistrationCategoryKey({
  discipline: 'close_control',
  experienceLevel: 'novice',
  ageDivisionId: 'm_juniors_1',
  weightCategoryId: 'm_juniors_1_w_le_71',
})

const PLACED_KEY = getRegistrationCategoryKey({
  discipline: 'close_control',
  experienceLevel: 'experienced',
  ageDivisionId: 'm_juniors_1',
  weightCategoryId: 'm_juniors_1_w_gt_71',
})

function collectEffectiveCategoryKeys(input: {
  entries: Array<{ entryId: string; sourceKey: string | null }>
  placements: Map<string, string>
  participantCategoryKeys: string[]
  entryIds?: string[]
  seedCategoryKeys?: string[]
}): string[] {
  const entryIdFilter = input.entryIds ? new Set(input.entryIds) : null
  const keys = new Set(input.seedCategoryKeys ?? [])

  for (const entry of input.entries) {
    if (entryIdFilter && !entryIdFilter.has(entry.entryId)) continue
    if (!entry.sourceKey) continue
    keys.add(input.placements.get(entry.entryId) ?? entry.sourceKey)
  }

  if (entryIdFilter) {
    for (const categoryKey of input.participantCategoryKeys) {
      keys.add(categoryKey)
    }
  } else {
    for (const categoryKey of input.participantCategoryKeys) {
      keys.add(categoryKey)
    }
  }

  return [...keys].sort()
}

describe('registration impact category keys', () => {
  it('uses placement category instead of duplicate source key after manual move', () => {
    const entryId = 'entry-1'
    const keys = collectEffectiveCategoryKeys({
      entries: [{ entryId, sourceKey: SOURCE_KEY }],
      placements: new Map([[entryId, PLACED_KEY]]),
      participantCategoryKeys: [PLACED_KEY],
      entryIds: [entryId],
    })

    expect(keys).toEqual([PLACED_KEY])
  })

  it('scopes payment impact to the changed entry only', () => {
    const keys = collectEffectiveCategoryKeys({
      entries: [
        { entryId: 'entry-1', sourceKey: SOURCE_KEY },
        { entryId: 'entry-2', sourceKey: PLACED_KEY },
      ],
      placements: new Map([['entry-1', PLACED_KEY]]),
      participantCategoryKeys: [PLACED_KEY],
      entryIds: ['entry-1'],
    })

    expect(keys).toEqual([PLACED_KEY])
    expect(keys).not.toContain(SOURCE_KEY)
  })
})
