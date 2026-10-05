#!/usr/bin/env npx tsx
process.env.CUP_SURVEY_SCRIPT_MODE = '1'
/**
 * Align Rassvetayev (#43) with Опытные · Юноши 2 · до 61 кг (tactic_control).
 */
import { prisma } from '../lib/prisma'
import { updateAthleteAsAdmin } from '../lib/registration/service'
import { markEntryDebtAsAdmin } from '../lib/registration/manualPayment'
import { syncBracketDraft } from '../lib/brackets/generation/sync'
import { requireWorkingGeneration } from '../lib/brackets/live/generation'
import { getRegistrationCategoryKey, getRegistrationCategoryIdentity } from '../lib/registration/categoryIdentity'
import { resetBracketEntryPlacement } from '../lib/brackets/placements'

const ATHLETE_ID = '340c0fce-228e-43ff-a207-18888f312276'
const PUBLIC_NUMBER = 43
const TARGET = {
  discipline: 'tactic_control' as const,
  experienceLevel: 'experienced' as const,
  ageDivisionId: 'm_youths_2',
  weightCategoryId: 'm_youths_2_w_le_61',
}
const STALE_CATEGORY_KEY = 'tactic_control:experienced:m_youths_3:m_youths_3_w_le_66'

async function syncCategories(categoryKeys: string[]) {
  const draft = await requireWorkingGeneration(prisma)
  const synced = await syncBracketDraft({
    draftId: draft.id,
    expectedVersion: draft.version,
    scope: 'all',
    categoryKeys: [...new Set(categoryKeys)],
    afterRegistrationChange: true,
  })
  return synced.draft.version
}

async function verify(entryId: string, categoryKey: string) {
  const entry = await prisma.athleteEntry.findUnique({
    where: { id: entryId },
    include: {
      athlete: {
        include: {
          registration: { select: { publicNumber: true } },
        },
      },
    },
  })
  const gen = await requireWorkingGeneration(prisma)
  const participant = await prisma.bracketDrawParticipant.findFirst({
    where: { entryId, draw: { generationId: gen.id } },
    include: {
      draw: {
        include: {
          participants: true,
          publicationState: true,
        },
      },
    },
  })
  const stale = await prisma.bracketDrawParticipant.findFirst({
    where: {
      entryId,
      draw: { generationId: gen.id, categoryKey: STALE_CATEGORY_KEY },
    },
  })

  return {
    entry: entry
      ? {
          discipline: entry.discipline,
          experienceLevel: entry.experienceLevel,
          ageDivisionId: entry.ageDivisionId,
          weightCategoryId: entry.weightCategoryId,
          paymentStatus: entry.paymentStatus,
          paymentStage: entry.paymentStage,
          price: entry.price,
        }
      : null,
    bracket: participant
      ? {
          categoryKey: participant.draw.categoryKey,
          expectedCategoryKey: categoryKey,
          matches: participant.draw.categoryKey === categoryKey,
          participantCount: participant.draw.participants.length,
          visible: participant.draw.publicationState?.visible ?? false,
          boutsReleased: participant.draw.publicationState?.boutsReleased ?? false,
        }
      : null,
    removedFromStale: stale ? false : true,
  }
}

async function main() {
  const athlete = await prisma.athlete.findUnique({
    where: { id: ATHLETE_ID },
    include: { entries: true, registration: true },
  })
  if (!athlete) throw new Error('Athlete not found')
  if (athlete.registration.publicNumber !== PUBLIC_NUMBER) {
    throw new Error(`Unexpected public number: ${athlete.registration.publicNumber}`)
  }

  const entry = athlete.entries[0]
  if (!entry) throw new Error('No entries')

  const birthDate = athlete.birthDate.toISOString().slice(0, 10)
  const newCategoryKey = getRegistrationCategoryKey(
    getRegistrationCategoryIdentity(
      {
        discipline: TARGET.discipline,
        experienceLevel: TARGET.experienceLevel,
        ageDivisionId: TARGET.ageDivisionId,
        weightCategoryId: TARGET.weightCategoryId,
      },
      athlete,
    )!,
  )

  const alreadyCorrect =
    entry.discipline === TARGET.discipline &&
    entry.experienceLevel === TARGET.experienceLevel &&
    entry.ageDivisionId === TARGET.ageDivisionId &&
    entry.weightCategoryId === TARGET.weightCategoryId

  const savedPayment = {
    status: entry.paymentStatus,
    stage: entry.paymentStage,
    price: entry.price,
  }

  let entryId = entry.id

  if (!alreadyCorrect) {
    await updateAthleteAsAdmin(ATHLETE_ID, {
      lastName: athlete.lastName,
      firstName: athlete.firstName,
      middleName: athlete.middleName ?? undefined,
      birthDate,
      gender: athlete.gender,
      rank: (athlete.rank ?? 'none') as 'youth_1',
      disciplineEntries: [TARGET],
    })

    const updated = await prisma.athlete.findUnique({
      where: { id: ATHLETE_ID },
      include: { entries: true },
    })
    entryId = updated?.entries[0]?.id ?? entryId

    const newEntry = updated?.entries[0]
    if (newEntry && newEntry.paymentStatus !== savedPayment.status && savedPayment.status === 'DEBT') {
      await markEntryDebtAsAdmin({
        entryId: newEntry.id,
        paymentStageId: savedPayment.stage ?? 'early',
      })
    }
  }

  let resetResult: { draft: { id: string; version: number } } | null = null
  const draft = await requireWorkingGeneration(prisma)
  const placement = await prisma.bracketEntryPlacement.findUnique({ where: { entryId } })
  if (placement) {
    resetResult = await resetBracketEntryPlacement({
      draftId: draft.id,
      expectedVersion: draft.version,
      entryId,
    })
  }

  const bracketVersion = await syncCategories([STALE_CATEGORY_KEY, newCategoryKey])

  await prisma.$executeRaw`
    UPDATE "BracketPublicationState"
    SET visible = true, "updatedAt" = NOW()
    WHERE "categoryKey" = ${newCategoryKey}
  `

  console.log(
    JSON.stringify(
      {
        ok: true,
        action: placement
          ? 'reset_manual_move_and_synced'
          : alreadyCorrect
            ? 'synced_brackets'
            : 'updated_and_synced',
        resetFrom: placement?.categoryKey ?? null,
        resetResult,
        publicNumber: PUBLIC_NUMBER,
        targetCategoryKey: newCategoryKey,
        bracketVersion,
        verify: await verify(entryId, newCategoryKey),
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
