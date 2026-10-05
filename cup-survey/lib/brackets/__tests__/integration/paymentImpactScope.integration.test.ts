import { afterEach, describe, expect, it } from 'vitest'
import { prisma } from '../../../prisma'
import { getRegistrationCategoryIdentity, getRegistrationCategoryKey } from '../../../registration/categoryIdentity'
import { loadCategoryKeysForEntryIds, computeImpactForRegistrationMutation } from '../../live/impact'
import {
  CAT_A,
  CAT_B,
  cleanupBracketIntegrationData,
  createIsolatedDraft,
  resetRegistrationRevision,
  seedTwoPaidEntriesDifferentClubs,
  seedTwoPaidEntriesSameRegistration,
  syncRedrawAll,
} from './helpers'
import { dbAvailable, useIntegrationDb } from './setup'
import { moveBracketEntry } from '../../placements'

describe('payment impact category scoping integration', () => {
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

  it('scopes category keys to moved entry placement, not sibling entry', async () => {
    const seeded = await seedTwoPaidEntriesDifferentClubs()
    registrationIds.push(...seeded.registrationIds)
    entryIds.push(...seeded.entryIds)

    const draft = await createIsolatedDraft()
    generationIds.push(draft.id)
    const ready = await syncRedrawAll(draft.id, draft.version)

    const [entryA, entryB] = seeded.entryIds
    await moveBracketEntry({
      draftId: ready.draft.id,
      expectedVersion: ready.draft.version,
      entryId: entryA,
      targetCategoryKey: CAT_B,
    })

    const keysForA = await prisma.$transaction((tx) =>
      loadCategoryKeysForEntryIds(tx, [entryA]),
    )
    expect(keysForA).toEqual([CAT_B])
    expect(keysForA).not.toContain(CAT_A)

    const keysForB = await prisma.$transaction((tx) =>
      loadCategoryKeysForEntryIds(tx, [entryB]),
    )
    expect(keysForB).toEqual([CAT_A])
    expect(keysForB).not.toContain(CAT_B)
  })

  it('resolves category keys from registration when bracket generation is absent', async () => {
    const seeded = await seedTwoPaidEntriesDifferentClubs()
    registrationIds.push(...seeded.registrationIds)
    entryIds.push(...seeded.entryIds)

    const entry = await prisma.athleteEntry.findUniqueOrThrow({
      where: { id: seeded.entryIds[0] },
      include: { athlete: true },
    })
    const expectedKey = getRegistrationCategoryKey(
      getRegistrationCategoryIdentity(entry, entry.athlete)!,
    )

    const keys = await prisma.$transaction((tx) =>
      loadCategoryKeysForEntryIds(tx, [seeded.entryIds[0]]),
    )
    expect(keys).toEqual([expectedKey])
  })

  it('keeps manual placement but removes participant when entry becomes ineligible', async () => {
    const seeded = await seedTwoPaidEntriesDifferentClubs()
    registrationIds.push(...seeded.registrationIds)
    entryIds.push(...seeded.entryIds)

    const draft = await createIsolatedDraft()
    generationIds.push(draft.id)
    const ready = await syncRedrawAll(draft.id, draft.version)
    const entryId = seeded.entryIds[0]

    await moveBracketEntry({
      draftId: ready.draft.id,
      expectedVersion: ready.draft.version,
      entryId,
      targetCategoryKey: CAT_B,
    })

    await prisma.athleteEntry.update({
      where: { id: entryId },
      data: { paymentStatus: 'UNPAID' },
    })

    const { forceRebuildCategories } = await import('../../live/forceRebuild')
    await prisma.$transaction(async (tx) => {
      await forceRebuildCategories(tx, {
        generationId: draft.id,
        categoryKeys: [CAT_B],
        preserveVisible: true,
      })
    })

    const participant = await prisma.bracketDrawParticipant.findFirst({
      where: { entryId, draw: { generationId: draft.id } },
    })
    const placement = await prisma.bracketEntryPlacement.findUnique({ where: { entryId } })

    expect(participant).toBeNull()
    expect(placement?.categoryKey).toBe(CAT_B)
  })

  it('scopes registration mutation impact to provided entryIds on same team', async () => {
    const seeded = await seedTwoPaidEntriesSameRegistration()
    registrationIds.push(seeded.registrationId)
    entryIds.push(...seeded.entryIds)

    const draft = await createIsolatedDraft()
    generationIds.push(draft.id)
    await syncRedrawAll(draft.id, draft.version)

    const [entryA, entryB] = seeded.entryIds
    const scoped = await prisma.$transaction((tx) =>
      computeImpactForRegistrationMutation(
        tx,
        seeded.registrationId,
        'test-scope',
        [],
        { entryIds: [entryA] },
      ),
    )
    const broad = await prisma.$transaction((tx) =>
      computeImpactForRegistrationMutation(tx, seeded.registrationId, 'test-scope', []),
    )

    expect(scoped.affectedCategoryKeys).toEqual([CAT_A])
    expect(broad.affectedCategoryKeys).toEqual(expect.arrayContaining([CAT_A, CAT_B]))
    expect(scoped.affectedCategoryKeys).not.toContain(CAT_B)

    const keysForB = await prisma.$transaction((tx) =>
      loadCategoryKeysForEntryIds(tx, [entryB]),
    )
    expect(keysForB).toEqual([CAT_B])
  })
})
