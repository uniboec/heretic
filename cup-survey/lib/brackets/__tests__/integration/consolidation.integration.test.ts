import { beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '../../../prisma'
import { getRegistrationCategoryKey } from '../../../registration/categoryIdentity'
import {
  createIsolatedDraft,
  ensureBracketDefaults,
  publishActiveForIntegration,
  purgeBracketIntegrationState,
  syncRedrawAll,
} from './helpers'
import { previewConsolidation, applyConsolidation } from '../../consolidation/apply'
import { legacyPolicy, legacyStep, TEST_CONSOLIDATION_POLICY } from '../../consolidation/__tests__/fixtures'
import { syncBracketDraft } from '../../generation/sync'

const W48 = 'm_juniors_1_w_le_48'
const W52 = 'm_juniors_1_w_le_52'

const CAT_48 = getRegistrationCategoryKey({
  discipline: 'tactic_control',
  experienceLevel: 'beginner',
  ageDivisionId: 'm_juniors_1',
  weightCategoryId: W48,
})
const CAT_52 = getRegistrationCategoryKey({
  discipline: 'tactic_control',
  experienceLevel: 'beginner',
  ageDivisionId: 'm_juniors_1',
  weightCategoryId: W52,
})

type SeedOptions = {
  birthDate?: Date
  ageDivisionId?: string
}

async function seedSinglePaid(
  weightCategoryId: string,
  suffix: string,
  options: SeedOptions = {},
) {
  const birthDate = options.birthDate ?? new Date('2012-01-01')
  const ageDivisionId = options.ageDivisionId ?? 'm_juniors_1'
  const registration = await prisma.teamRegistration.create({
    data: {
      clubName: `Club ${suffix}`,
      city: `City ${suffix}`,
      phone: `+7903${String(Date.now()).slice(-7)}${suffix}`,
      registrationStage: 'main',
      pricePerDiscipline: 1000,
      totalAmount: 1000,
      consentPersonalData: true,
      consentPublication: true,
      status: 'PAID',
      athletes: {
        create: {
          lastName: 'Single',
          firstName: suffix,
          birthDate,
          gender: 'male',
          entries: {
            create: {
              discipline: 'tactic_control',
              experienceLevel: 'beginner',
              ageDivisionId,
              weightCategoryId,
              price: 1000,
              paymentStatus: 'PAID',
            },
          },
        },
      },
    },
    include: { athletes: { include: { entries: true } } },
  })
  return {
    registrationId: registration.id,
    entryId: registration.athletes[0].entries[0].id,
  }
}

async function seedPairPaid(
  weightCategoryId: string,
  suffix: string,
  options: SeedOptions = {},
) {
  const birthDate = options.birthDate ?? new Date('2012-01-01')
  const ageDivisionId = options.ageDivisionId ?? 'm_juniors_1'
  const registration = await prisma.teamRegistration.create({
    data: {
      clubName: `Pair Club ${suffix}`,
      city: `City ${suffix}`,
      phone: `+7904${String(Date.now()).slice(-7)}${suffix}`,
      registrationStage: 'main',
      pricePerDiscipline: 2000,
      totalAmount: 2000,
      consentPersonalData: true,
      consentPublication: true,
      status: 'PAID',
      athletes: {
        create: ['A', 'B'].map((firstName) => ({
          lastName: 'Pair',
          firstName: `${firstName}${suffix}`,
          birthDate,
          gender: 'male',
          entries: {
            create: {
              discipline: 'tactic_control',
              experienceLevel: 'beginner',
              ageDivisionId,
              weightCategoryId,
              price: 1000,
              paymentStatus: 'PAID',
            },
          },
        })),
      },
    },
    include: { athletes: { include: { entries: true } } },
  })
  return registration.athletes.flatMap((athlete) => athlete.entries.map((entry) => entry.id))
}

describe('consolidation integration', () => {
  beforeEach(async () => {
    await purgeBracketIntegrationState()
    await ensureBracketDefaults()
  })

  it('apply moves athlete to target draw via placements and forceRebuild', async () => {
    const single = await seedSinglePaid(W48, 'solo')
    await seedPairPaid(W52, 'pair')

    const draft = await createIsolatedDraft()
    const ready = await syncRedrawAll(draft.id, draft.version)

    const preview = await previewConsolidation({
      expectedVersion: ready.draft.version,
      policy: legacyPolicy({ steps: [legacyStep('WEIGHT_UP')] }),
    })

    expect(preview.plan.finalPlacements.some((item) => item.entryId === single.entryId)).toBe(true)

    const applied = await applyConsolidation({
      expectedVersion: ready.draft.version,
      policy: preview.policy,
      consolidationPlanToken: preview.consolidationPlanToken,
    })

    const targetDraw = await prisma.bracketCategoryDraw.findUnique({
      where: {
        generationId_categoryKey: {
          generationId: applied.draft.id,
          categoryKey: CAT_52,
        },
      },
      include: { participants: true },
    })
    const sourceDraw = await prisma.bracketCategoryDraw.findUnique({
      where: {
        generationId_categoryKey: {
          generationId: applied.draft.id,
          categoryKey: CAT_48,
        },
      },
    })
    const placement = await prisma.bracketEntryPlacement.findUnique({
      where: { entryId: single.entryId },
    })

    expect(sourceDraw).toBeNull()
    expect(targetDraw?.participants.some((participant) => participant.entryId === single.entryId)).toBe(
      true,
    )
    expect(placement?.categoryKey).toBe(CAT_52)

    const audit = await prisma.bracketMoveAudit.findFirst({
      where: { entryId: single.entryId, action: 'CONSOLIDATION' },
    })
    expect(audit?.metadata).toBeTruthy()
  })

  it('apply moves athlete with composite wave policy', async () => {
    const W66_J2 = 'm_juniors_2_w_le_66'
    const CAT_J2_66 = getRegistrationCategoryKey({
      discipline: 'tactic_control',
      experienceLevel: 'beginner',
      ageDivisionId: 'm_juniors_2',
      weightCategoryId: W66_J2,
    })

    const single = await seedSinglePaid(W48, 'composite', {
      birthDate: new Date('2008-01-01'),
    })
    await seedPairPaid(W66_J2, 'target', {
      ageDivisionId: 'm_juniors_2',
      birthDate: new Date('2008-01-01'),
    })

    const draft = await createIsolatedDraft()
    const ready = await syncRedrawAll(draft.id, draft.version)

    const compositePolicy = {
      incompleteThreshold: 1 as const,
      steps: [
        {
          enabled: true,
          actions: [
            { type: 'AGE_UP' as const, weightMapping: 'SAME_INDEX' as const },
            { type: 'WEIGHT_UP' as const, repeat: 2 as const },
          ],
        },
      ],
    }

    const preview = await previewConsolidation({
      expectedVersion: ready.draft.version,
      policy: compositePolicy,
    })

    expect(preview.plan.trace).toHaveLength(1)
    expect(preview.plan.trace[0]?.actions).toHaveLength(2)
    expect(preview.plan.trace[0]?.step).toBeUndefined()
    expect(preview.plan.finalPlacements.some((item) => item.entryId === single.entryId)).toBe(true)
    expect(preview.plan.finalPlacements[0]?.finalCategoryKey).toBe(CAT_J2_66)

    const applied = await applyConsolidation({
      expectedVersion: ready.draft.version,
      policy: preview.policy,
      consolidationPlanToken: preview.consolidationPlanToken,
    })

    const targetDraw = await prisma.bracketCategoryDraw.findUnique({
      where: {
        generationId_categoryKey: {
          generationId: applied.draft.id,
          categoryKey: CAT_J2_66,
        },
      },
      include: { participants: true },
    })
    const placement = await prisma.bracketEntryPlacement.findUnique({
      where: { entryId: single.entryId },
    })

    expect(
      targetDraw?.participants.some((participant) => participant.entryId === single.entryId),
    ).toBe(true)
    expect(placement?.categoryKey).toBe(CAT_J2_66)
  })

  it('returns no moves on second preview after apply', async () => {
    const single = await seedSinglePaid(W48, 'again')
    await seedPairPaid(W52, 'again2')

    const draft = await createIsolatedDraft()
    const ready = await syncRedrawAll(draft.id, draft.version)

    const policy = legacyPolicy({ steps: [legacyStep('WEIGHT_UP')] })

    const preview = await previewConsolidation({
      expectedVersion: ready.draft.version,
      policy,
    })
    expect(preview.plan.finalPlacements.length).toBeGreaterThan(0)

    const applied = await applyConsolidation({
      expectedVersion: ready.draft.version,
      policy: preview.policy,
      consolidationPlanToken: preview.consolidationPlanToken,
    })

    const secondPreview = await previewConsolidation({
      expectedVersion: applied.draft.version,
      policy,
    })

    expect(secondPreview.plan.finalPlacements).toHaveLength(0)
    expect(secondPreview.plan.trace).toHaveLength(0)
  })

  it('auto-sync preserves manual placements', async () => {
    const single = await seedSinglePaid(W48, 'keep')
    await seedPairPaid(W52, 'target')

    const draft = await createIsolatedDraft()
    const ready = await syncRedrawAll(draft.id, draft.version)

    await prisma.bracketEntryPlacement.create({
      data: {
        entryId: single.entryId,
        categoryKey: CAT_52,
        isManualMove: true,
      },
    })

    const synced = await syncBracketDraft({
      draftId: ready.draft.id,
      expectedVersion: ready.draft.version,
      scope: 'category',
      categoryKey: CAT_52,
    })

    const placement = await prisma.bracketEntryPlacement.findUnique({
      where: { entryId: single.entryId },
    })

    expect(placement?.categoryKey).toBe(CAT_52)
    expect(synced.ok).toBe(true)
  })

  it('teardowns released source publication and preserves target visibility', async () => {
    const single = await seedSinglePaid(W48, 'rel')
    await seedPairPaid(W52, 'vis')

    const draft = await createIsolatedDraft()
    const ready = await syncRedrawAll(draft.id, draft.version)
    const published = await publishActiveForIntegration({
      draftId: ready.draft.id,
      expectedVersion: ready.draft.version,
    })
    const workingVersion = published.draft.version

    const sourceDraw = await prisma.bracketCategoryDraw.findFirst({
      where: { generationId: ready.draft.id, categoryKey: CAT_48 },
    })
    const targetDraw = await prisma.bracketCategoryDraw.findFirst({
      where: { generationId: ready.draft.id, categoryKey: CAT_52 },
    })
    if (!sourceDraw || !targetDraw) throw new Error('Expected source and target draws')

    await prisma.bracketPublicationState.upsert({
      where: { categoryKey: CAT_48 },
      create: {
        categoryKey: CAT_48,
        publishedDrawId: sourceDraw.id,
        visible: true,
        boutsReleased: true,
        matCountAtRelease: 2,
      },
      update: {
        publishedDrawId: sourceDraw.id,
        visible: true,
        boutsReleased: true,
        matCountAtRelease: 2,
      },
    })
    await prisma.bracketPublicationState.upsert({
      where: { categoryKey: CAT_52 },
      create: {
        categoryKey: CAT_52,
        publishedDrawId: targetDraw.id,
        visible: true,
        boutsReleased: true,
        matCountAtRelease: 2,
      },
      update: {
        publishedDrawId: targetDraw.id,
        visible: true,
        boutsReleased: true,
        matCountAtRelease: 2,
      },
    })

    const preview = await previewConsolidation({
      expectedVersion: workingVersion,
      policy: TEST_CONSOLIDATION_POLICY,
    })

    await applyConsolidation({
      expectedVersion: workingVersion,
      policy: preview.policy,
      consolidationPlanToken: preview.consolidationPlanToken,
      impactToken: preview.impactToken,
    })

    const sourcePublication = await prisma.bracketPublicationState.findUnique({
      where: { categoryKey: CAT_48 },
    })
    const targetPublication = await prisma.bracketPublicationState.findUnique({
      where: { categoryKey: CAT_52 },
    })

    expect(sourcePublication).toBeNull()
    expect(targetPublication?.visible).toBe(true)
    expect(targetPublication?.boutsReleased).toBe(false)
    expect(targetPublication?.matCountAtRelease).toBeNull()
  })
})
