#!/usr/bin/env npx tsx
process.env.CUP_SURVEY_SCRIPT_MODE = '1'
/**
 * Move Rassvetayev (#43) and Maltsev (#54) from Close-Control to Tactic-Control
 * · Опытные · Юноши 2 · до 61 кг on prod.
 */
import { prisma } from '../lib/prisma'
import { updateAthleteAsAdmin } from '../lib/registration/service'
import { markEntryDebtAsAdmin } from '../lib/registration/manualPayment'
import { redrawBracketDraft } from '../lib/brackets/generation/redraw'
import { requireWorkingGeneration } from '../lib/brackets/live/generation'
import { setCategoriesPublicVisibility } from '../lib/brackets/generation/categoryVisibility'
import { setCategoriesBoutsReleased } from '../lib/bouts/release'
import { resetBracketEntryPlacement } from '../lib/brackets/placements'
import { previewBracketImpact } from '../lib/brackets/live/impactPreview'
import { stableJsonHash } from '../lib/brackets/live/impactToken'
import { collectCategoryKeysFromAthletes } from '../lib/registration/bracketAutoSync'

const ATHLETES = [
  { id: '340c0fce-228e-43ff-a207-18888f312276', publicNumber: 43 },
  { id: 'ef8103c6-9fea-49ec-80aa-01534ffc5f77', publicNumber: 54 },
] as const

const SOURCE_CATEGORY_KEY = 'close_control:experienced:m_youths_2:m_youths_2_w_le_61'
const TARGET = {
  discipline: 'tactic_control' as const,
  experienceLevel: 'experienced' as const,
  ageDivisionId: 'm_youths_2',
  weightCategoryId: 'm_youths_2_w_le_61',
}
const TARGET_CATEGORY_KEY = 'tactic_control:experienced:m_youths_2:m_youths_2_w_le_61'

async function moveAthlete(athleteId: string, publicNumber: number) {
  const athlete = await prisma.athlete.findUnique({
    where: { id: athleteId },
    include: { entries: true, registration: true },
  })
  if (!athlete) throw new Error(`Athlete not found: ${athleteId}`)
  if (athlete.registration.publicNumber !== publicNumber) {
    throw new Error(`Unexpected public number for ${athleteId}: ${athlete.registration.publicNumber}`)
  }

  const entry = athlete.entries[0]
  if (!entry) throw new Error(`No entries for #${publicNumber}`)

  const birthDate = athlete.birthDate.toISOString().slice(0, 10)
  const alreadyTactic =
    entry.discipline === TARGET.discipline &&
    entry.experienceLevel === TARGET.experienceLevel &&
    entry.ageDivisionId === TARGET.ageDivisionId &&
    entry.weightCategoryId === TARGET.weightCategoryId

  const savedPayment = {
    status: entry.paymentStatus,
    stage: entry.paymentStage,
  }

  let entryId = entry.id
  let action: string = 'already_tactic_control'

  if (!alreadyTactic) {
    const body = {
      lastName: athlete.lastName,
      firstName: athlete.firstName,
      middleName: athlete.middleName ?? undefined,
      birthDate,
      gender: athlete.gender,
      rank: (athlete.rank ?? 'none') as 'none',
      disciplineEntries: [TARGET],
    }

    const mutationFingerprint = stableJsonHash({
      kind: 'athlete_update',
      athleteId,
      registrationId: athlete.registrationId,
      body: {
        lastName: body.lastName.trim(),
        firstName: body.firstName.trim(),
        middleName: body.middleName?.trim() || null,
        birthDate: body.birthDate,
        gender: body.gender,
        rank: body.rank ?? null,
        disciplineEntries: body.disciplineEntries.map((disciplineEntry) => ({
          discipline: disciplineEntry.discipline,
          ageDivisionId: disciplineEntry.ageDivisionId,
          weightCategoryId: disciplineEntry.weightCategoryId,
          experienceLevel: disciplineEntry.experienceLevel,
        })),
      },
    })
    const categoryKeys = collectCategoryKeysFromAthletes([
      { gender: athlete.gender, entries: athlete.entries },
      { gender: body.gender, entries: body.disciplineEntries },
    ])
    const preview = await previewBracketImpact({
      operation: 'admin_registration_mutation',
      registrationId: athlete.registrationId,
      mutationFingerprint,
      categoryKeys,
      entryIds: athlete.entries.map((item) => item.id),
    })

    await updateAthleteAsAdmin(athleteId, body, { impactToken: preview.impactToken })

    const updated = await prisma.athlete.findUnique({
      where: { id: athleteId },
      include: { entries: true },
    })
    const newEntry = updated?.entries[0]
    if (!newEntry) throw new Error(`Entry missing after update for #${publicNumber}`)
    entryId = newEntry.id
    action = 'moved_to_tactic_control'

    if (newEntry.paymentStatus !== savedPayment.status && savedPayment.status === 'DEBT') {
      await markEntryDebtAsAdmin({
        entryId: newEntry.id,
        paymentStageId: savedPayment.stage ?? 'late',
      })
    }
  }

  const draft = await requireWorkingGeneration(prisma)
  const placement = await prisma.bracketEntryPlacement.findUnique({ where: { entryId } })
  let resetResult: { draft: { id: string; version: number } } | null = null
  if (placement) {
    resetResult = await resetBracketEntryPlacement({
      draftId: draft.id,
      expectedVersion: draft.version,
      entryId,
    })
    action = `${action}_reset_placement`
  }

  return {
    publicNumber,
    action,
    entryId,
    resetFrom: placement?.categoryKey ?? null,
    resetResult,
  }
}

async function verifyAthlete(entryId: string, publicNumber: number) {
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
    where: { entryId, draw: { generationId: gen.id, categoryKey: TARGET_CATEGORY_KEY } },
    include: {
      draw: {
        include: {
          participants: true,
          publicationState: true,
        },
      },
    },
  })
  const staleClose = await prisma.bracketDrawParticipant.findFirst({
    where: {
      entryId,
      draw: { generationId: gen.id, categoryKey: SOURCE_CATEGORY_KEY },
    },
  })

  return {
    publicNumber,
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
          categoryKey: TARGET_CATEGORY_KEY,
          participantCount: participant.draw.participants.length,
          autoSystemId: participant.draw.autoSystemId,
          visible: participant.draw.publicationState?.visible ?? false,
          boutsReleased: participant.draw.publicationState?.boutsReleased ?? false,
        }
      : null,
    removedFromCloseControl: !staleClose,
  }
}

async function main() {
  const moves = []
  for (const athlete of ATHLETES) {
    moves.push(await moveAthlete(athlete.id, athlete.publicNumber))
  }

  let draft = await requireWorkingGeneration(prisma)

  const redrawn = await redrawBracketDraft({
    draftId: draft.id,
    expectedVersion: draft.version,
    scope: 'category',
    categoryKey: TARGET_CATEGORY_KEY,
    onlyStale: true,
  })
  draft = redrawn.draft

  await setCategoriesPublicVisibility({
    scope: 'category',
    categoryKey: TARGET_CATEGORY_KEY,
    visible: true,
  })

  const draw = await prisma.bracketCategoryDraw.findUnique({
    where: {
      generationId_categoryKey: { generationId: draft.id, categoryKey: TARGET_CATEGORY_KEY },
    },
    include: { participants: true, publicationState: true },
  })
  if (!draw?.publicationState?.publishedDrawId) {
    throw new Error(`Category not published: ${TARGET_CATEGORY_KEY}`)
  }

  const release =
    draw.participants.length >= 2
      ? await setCategoriesBoutsReleased({
          scope: 'category',
          categoryKey: TARGET_CATEGORY_KEY,
          released: true,
          expectedPublishedDrawId: draw.publicationState.publishedDrawId,
          expectedPublishedGenerationId: draft.id,
        })
      : { skipped: true, reason: 'fewer_than_2_participants' }

  const finalDraw = await prisma.bracketCategoryDraw.findUnique({
    where: {
      generationId_categoryKey: { generationId: draft.id, categoryKey: TARGET_CATEGORY_KEY },
    },
    include: { participants: true, publicationState: true },
  })

  const verify = []
  for (const move of moves) {
    verify.push(await verifyAthlete(move.entryId, move.publicNumber))
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        sourceCategoryKey: SOURCE_CATEGORY_KEY,
        targetCategoryKey: TARGET_CATEGORY_KEY,
        moves,
        draftVersion: draft.version,
        release,
        category: {
          participantCount: finalDraw?.participants.length ?? 0,
          autoSystemId: finalDraw?.autoSystemId ?? null,
          visible: finalDraw?.publicationState?.visible ?? false,
          boutsReleased: finalDraw?.publicationState?.boutsReleased ?? false,
        },
        verify,
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
