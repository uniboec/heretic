#!/usr/bin/env npx tsx
process.env.CUP_SURVEY_SCRIPT_MODE = '1'
/**
 * Add Nikiforov (#37) to Close-Control · Опытные · 10–11 лет · до 41 кг
 * and confirm early-registration payment on prod.
 */
import { prisma } from '../lib/prisma'
import {
  confirmEntryPaymentAsAdmin,
  getDefaultPaidAtDate,
} from '../lib/registration/manualPayment'
import { fingerprintConfirmPayment } from '../lib/registration/adminImpact'
import { syncBracketDraft } from '../lib/brackets/generation/sync'
import { requireWorkingGeneration } from '../lib/brackets/live/generation'
import { setCategoriesPublicVisibility } from '../lib/brackets/generation/categoryVisibility'
import { previewBracketImpact } from '../lib/brackets/live/impactPreview'
import {
  getRegistrationCategoryKey,
  getRegistrationCategoryIdentity,
  getCategoryTitleFromKey,
} from '../lib/registration/categoryIdentity'
import {
  bumpRegistrationRevisionInTransaction,
  runPostCommitBracketSync,
} from '../lib/registration/bracketImpactCoordinator'
import { collectCategoryKeysFromAthletes } from '../lib/registration/bracketAutoSync'
import { listActiveCategoryDiscountRules } from '../lib/registration/categoryDiscounts'
import { resolveEntryPrice } from '../lib/registration/pricing'
import { loadRegistrationSchedule } from '../lib/registration/schedule'

const ATHLETE_ID = 'fc74d575-12f5-4865-8c89-7629c4b26945'
const PUBLIC_NUMBER = 37
const EARLY_STAGE_ID = 'early'
const TARGET = {
  discipline: 'close_control' as const,
  experienceLevel: 'experienced' as const,
  ageDivisionId: 'm_youths_1',
  weightCategoryId: 'm_youths_1_w_le_41',
}

async function syncCategories(categoryKeys: string[]) {
  const keys = [...new Set(categoryKeys)]
  const draft = await requireWorkingGeneration(prisma)
  const synced = await syncBracketDraft({
    draftId: draft.id,
    expectedVersion: draft.version,
    scope: 'all',
    categoryKeys: keys,
    afterRegistrationChange: true,
  })
  for (const categoryKey of keys) {
    const draw = await prisma.bracketCategoryDraw.findFirst({
      where: { generationId: synced.draft.id, categoryKey },
    })
    if (!draw) continue
    await setCategoriesPublicVisibility({
      scope: 'category',
      categoryKey,
      visible: true,
    })
  }
  return synced.draft.version
}

async function verify(entryId: string, categoryKey: string) {
  const entry = await prisma.athleteEntry.findUnique({
    where: { id: entryId },
    include: {
      athlete: {
        include: {
          registration: { select: { publicNumber: true } },
          entries: true,
        },
      },
    },
  })
  const gen = await requireWorkingGeneration(prisma)
  const participant = await prisma.bracketDrawParticipant.findFirst({
    where: { entryId, draw: { generationId: gen.id, categoryKey } },
    include: {
      draw: {
        include: {
          participants: true,
          publicationState: true,
        },
      },
    },
  })

  return {
    publicNumber: entry?.athlete.registration.publicNumber,
    categoryTitle: getCategoryTitleFromKey(categoryKey),
    entries: entry?.athlete.entries.map((item) => ({
      discipline: item.discipline,
      experienceLevel: item.experienceLevel,
      ageDivisionId: item.ageDivisionId,
      weightCategoryId: item.weightCategoryId,
      paymentStatus: item.paymentStatus,
      paymentStage: item.paymentStage,
      price: item.price,
    })),
    targetEntry: entry
      ? {
          paymentStatus: entry.paymentStatus,
          paymentStage: entry.paymentStage,
          price: entry.price,
          paidAt: entry.paidAt?.toISOString() ?? null,
        }
      : null,
    bracket: participant
      ? {
          categoryKey,
          participantCount: participant.draw.participants.length,
          visible: participant.draw.publicationState?.visible ?? false,
          boutsReleased: participant.draw.publicationState?.boutsReleased ?? false,
          autoSystemId: participant.draw.autoSystemId,
        }
      : null,
  }
}

function matchesTarget(entry: {
  discipline: string
  experienceLevel: string
  ageDivisionId: string | null
  weightCategoryId: string | null
}) {
  return (
    entry.discipline === TARGET.discipline &&
    entry.experienceLevel === TARGET.experienceLevel &&
    entry.ageDivisionId === TARGET.ageDivisionId &&
    entry.weightCategoryId === TARGET.weightCategoryId
  )
}

async function main() {
  const athlete = await prisma.athlete.findUnique({
    where: { id: ATHLETE_ID },
    include: {
      entries: true,
      registration: { include: { club: true } },
    },
  })
  if (!athlete) throw new Error('Athlete not found')
  if (athlete.registration.publicNumber !== PUBLIC_NUMBER) {
    throw new Error(`Unexpected public number: ${athlete.registration.publicNumber}`)
  }

  const targetCategoryKey = getRegistrationCategoryKey(
    getRegistrationCategoryIdentity(TARGET, athlete)!,
  )

  let targetEntry = athlete.entries.find(matchesTarget)
  let action = 'existing_target_entry'

  if (!targetEntry) {
    await loadRegistrationSchedule()
    const { getRegistrationScheduleSync } = await import('../lib/registration/schedule')
    const basePrice =
      getRegistrationScheduleSync().stagesById[EARLY_STAGE_ID]?.pricePerDiscipline ?? 1500
    const discountRules = await listActiveCategoryDiscountRules()
    const price = resolveEntryPrice(
      basePrice,
      TARGET,
      discountRules,
      athlete.registration.club?.discountPercent ?? null,
    )

    targetEntry = await prisma.athleteEntry.create({
      data: {
        athleteId: athlete.id,
        ...TARGET,
        price,
        paymentStatus: 'UNPAID',
      },
    })

    const categoryKeys = collectCategoryKeysFromAthletes([
      { gender: athlete.gender, entries: [...athlete.entries, targetEntry] },
    ])
    await bumpRegistrationRevisionInTransaction()
    await runPostCommitBracketSync(categoryKeys)
    action = 'added_target_entry'
  }

  let payment:
    | { price: number; paymentStageId: string; paidAt: string }
    | { skipped: string } = { skipped: 'already_paid' }

  if (targetEntry.paymentStatus !== 'PAID') {
    const mutationFingerprint = fingerprintConfirmPayment({
      entryId: targetEntry.id,
      paymentStageId: EARLY_STAGE_ID,
    })
    const preview = await previewBracketImpact({
      operation: 'admin_registration_mutation',
      registrationId: athlete.registrationId,
      mutationFingerprint,
      categoryKeys: [targetCategoryKey],
      entryIds: [targetEntry.id],
    })

    payment = await confirmEntryPaymentAsAdmin({
      entryId: targetEntry.id,
      paymentStageId: EARLY_STAGE_ID,
      paidAt: getDefaultPaidAtDate(EARLY_STAGE_ID),
      withoutProof: true,
      comment: 'Оплата по ранней регистрации (организатор).',
      impactToken: preview.impactToken,
    })
    action = action === 'added_target_entry' ? 'added_and_paid_early' : 'paid_early'
  } else if (targetEntry.paymentStage !== EARLY_STAGE_ID) {
    throw new Error(
      `Target entry already PAID with unexpected stage: ${targetEntry.paymentStage ?? 'null'}`,
    )
  }

  const bracketVersion = await syncCategories([targetCategoryKey])

  console.log(
    JSON.stringify(
      {
        ok: true,
        action,
        publicNumber: PUBLIC_NUMBER,
        targetCategoryKey,
        targetCategoryTitle: getCategoryTitleFromKey(targetCategoryKey),
        payment,
        bracketVersion,
        verify: await verify(targetEntry.id, targetCategoryKey),
      },
      null,
      2,
    ),
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
