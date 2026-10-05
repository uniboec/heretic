import { afterEach, describe, expect, it } from 'vitest'
import { prisma } from '../../../prisma'
import { BracketOperationError } from '../../core/errors'
import { moveBracketEntry } from '../../placements'
import {
  CAT_A,
  CAT_B,
  cleanupBracketIntegrationData,
  createIsolatedDraft,
  resetRegistrationRevision,
  seedTwoPaidEntriesDifferentClubs,
  syncRedrawAll,
} from './helpers'
import { dbAvailable, useIntegrationDb } from './setup'

const FEMALE_TARGET = 'tactic_control:beginner:f_juniors_1:w_44'
const INVALID_TARGET = 'unknown:beginner:m_juniors_1:w_66'

describe('brackets move validation integration', () => {
  const generationIds: string[] = []
  const registrationIds: string[] = []
  const entryIds: string[] = []

  useIntegrationDb()

  afterEach(async () => {
    if (!dbAvailable) return
    await cleanupBracketIntegrationData({ generationIds, registrationIds, entryIds })
    generationIds.length = 0
    registrationIds.length = 0
    entryIds.length = 0
    await resetRegistrationRevision()
  })

  async function prepareDraft() {
    const seeded = await seedTwoPaidEntriesDifferentClubs()
    registrationIds.push(...seeded.registrationIds)
    entryIds.push(...seeded.entryIds)

    const draft = await createIsolatedDraft()
    generationIds.push(draft.id)
    const ready = await syncRedrawAll(draft.id, draft.version)
    return { ready, entryId: seeded.entryIds[0] }
  }

  async function expectNoMoveSideEffects(draftId: string, beforeParticipants: number, beforePlacements: number) {
    const afterParticipants = await prisma.bracketDrawParticipant.count({
      where: { draw: { generationId: draftId } },
    })
    const afterPlacements = await prisma.bracketEntryPlacement.count()
    expect(afterParticipants).toBe(beforeParticipants)
    expect(afterPlacements).toBe(beforePlacements)
  }

  it('rejects same target category without side effects', async () => {
    const { ready, entryId } = await prepareDraft()
    const beforeParticipants = await prisma.bracketDrawParticipant.count({
      where: { draw: { generationId: ready.draft.id } },
    })
    const beforePlacements = await prisma.bracketEntryPlacement.count()

    await expect(
      moveBracketEntry({
        draftId: ready.draft.id,
        expectedVersion: ready.draft.version,
        entryId,
        targetCategoryKey: CAT_A,
      }),
    ).rejects.toMatchObject({
      code: 'SAME_TARGET_CATEGORY',
    } satisfies Partial<BracketOperationError>)

    await expectNoMoveSideEffects(ready.draft.id, beforeParticipants, beforePlacements)
  })

  it('rejects invalid target category without side effects', async () => {
    const { ready, entryId } = await prepareDraft()
    const beforeParticipants = await prisma.bracketDrawParticipant.count({
      where: { draw: { generationId: ready.draft.id } },
    })
    const beforePlacements = await prisma.bracketEntryPlacement.count()

    await expect(
      moveBracketEntry({
        draftId: ready.draft.id,
        expectedVersion: ready.draft.version,
        entryId,
        targetCategoryKey: INVALID_TARGET,
      }),
    ).rejects.toMatchObject({
      code: 'INVALID_TARGET_CATEGORY',
    } satisfies Partial<BracketOperationError>)

    await expectNoMoveSideEffects(ready.draft.id, beforeParticipants, beforePlacements)
  })

  it('rejects gender mismatch without side effects', async () => {
    const { ready, entryId } = await prepareDraft()
    const beforeParticipants = await prisma.bracketDrawParticipant.count({
      where: { draw: { generationId: ready.draft.id } },
    })
    const beforePlacements = await prisma.bracketEntryPlacement.count()

    await expect(
      moveBracketEntry({
        draftId: ready.draft.id,
        expectedVersion: ready.draft.version,
        entryId,
        targetCategoryKey: FEMALE_TARGET,
      }),
    ).rejects.toMatchObject({
      code: 'GENDER_MISMATCH',
    } satisfies Partial<BracketOperationError>)

    await expectNoMoveSideEffects(ready.draft.id, beforeParticipants, beforePlacements)
  })

  it('allows move to another valid category', async () => {
    const { ready, entryId } = await prepareDraft()

    const result = await moveBracketEntry({
      draftId: ready.draft.id,
      expectedVersion: ready.draft.version,
      entryId,
      targetCategoryKey: CAT_B,
    })

    expect(result.draft.version).toBe(ready.draft.version + 1)
    const placement = await prisma.bracketEntryPlacement.findUnique({ where: { entryId } })
    expect(placement?.categoryKey).toBe(CAT_B)
  })

  it('move redraws source and target so seeding is not stale', async () => {
    const { ready, entryId } = await prepareDraft()
    const moved = await moveBracketEntry({
      draftId: ready.draft.id,
      expectedVersion: ready.draft.version,
      entryId,
      targetCategoryKey: CAT_B,
    })

    const { computeDiffForDraft } = await import('../../dashboardDiff')
    await import('../../systems')
    const diff = await computeDiffForDraft(moved.draft.id)
    expect(diff?.categories[CAT_A]?.seedingStale).toBe(false)
    expect(diff?.categories[CAT_B]?.seedingStale).toBe(false)
    expect(diff?.categories[CAT_A]?.balanceStale).toBe(false)
    expect(diff?.categories[CAT_B]?.balanceStale).toBe(false)
  })
})
