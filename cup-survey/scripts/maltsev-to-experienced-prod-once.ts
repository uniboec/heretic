#!/usr/bin/env npx tsx
process.env.CUP_SURVEY_SCRIPT_MODE = '1'
/**
 * Move Maltsev (public #54) from novice to experienced on prod.
 */
import { prisma } from '../lib/prisma'
import { updateAthleteAsAdmin } from '../lib/registration/service'
import { markEntryDebtAsAdmin } from '../lib/registration/manualPayment'
import { syncBracketDraft } from '../lib/brackets/generation/sync'
import { requireWorkingGeneration } from '../lib/brackets/live/generation'
import { setCategoriesPublicVisibility } from '../lib/brackets/generation/categoryVisibility'
import { entryCategoryKey } from '../lib/registration/entryPayment'
import { getRegistrationCategoryKey, getRegistrationCategoryIdentity } from '../lib/registration/categoryIdentity'

const ATHLETE_ID = 'ef8103c6-9fea-49ec-80aa-01534ffc5f77'
const PUBLIC_NUMBER = 54

async function syncCategories(categoryKeys: string[]) {
  const draft = await requireWorkingGeneration(prisma)
  const synced = await syncBracketDraft({
    draftId: draft.id,
    expectedVersion: draft.version,
    scope: 'all',
    categoryKeys,
    afterRegistrationChange: true,
  })
  for (const categoryKey of categoryKeys) {
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
    experienceLevel: entry?.experienceLevel,
    paymentStatus: entry?.paymentStatus,
    paymentStage: entry?.paymentStage,
    price: entry?.price,
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

async function main() {
  const athlete = await prisma.athlete.findUnique({
    where: { id: ATHLETE_ID },
    include: { entries: true, registration: true },
  })
  if (!athlete) throw new Error('Athlete not found')
  if (athlete.registration.publicNumber !== PUBLIC_NUMBER) {
    throw new Error(`Unexpected public number: ${athlete.registration.publicNumber}`)
  }

  const entry = athlete.entries.find((e) => e.discipline === 'close_control')
  if (!entry?.ageDivisionId || !entry.weightCategoryId) {
    throw new Error('Close-control entry missing')
  }

  const oldCategoryKey = getRegistrationCategoryKey(
    getRegistrationCategoryIdentity(entry, athlete)!,
  )

  if (entry.experienceLevel === 'experienced') {
    const categoryKey = oldCategoryKey
    console.log(
      JSON.stringify(
        {
          ok: true,
          action: 'already_experienced',
          verify: await verify(entry.id, categoryKey),
        },
        null,
        2,
      ),
    )
    return
  }

  const birthDate = athlete.birthDate.toISOString().slice(0, 10)
  const body = {
    lastName: athlete.lastName,
    firstName: athlete.firstName,
    middleName: athlete.middleName ?? undefined,
    birthDate,
    gender: athlete.gender,
    rank: (athlete.rank ?? 'none') as 'none',
    disciplineEntries: [
      {
        discipline: entry.discipline,
        ageDivisionId: entry.ageDivisionId,
        weightCategoryId: entry.weightCategoryId,
        experienceLevel: 'experienced' as const,
      },
    ],
  }

  const savedPayment = {
    status: entry.paymentStatus,
    stage: entry.paymentStage,
    price: entry.price,
  }

  await updateAthleteAsAdmin(ATHLETE_ID, body)

  const updated = await prisma.athlete.findUnique({
    where: { id: ATHLETE_ID },
    include: { entries: true, registration: true },
  })
  if (!updated) throw new Error('Athlete missing after update')

  const newEntry = updated.entries.find((e) => e.discipline === 'close_control')
  if (!newEntry?.ageDivisionId || !newEntry.weightCategoryId) {
    throw new Error('Updated entry missing')
  }

  const newCategoryKey = getRegistrationCategoryKey(
    getRegistrationCategoryIdentity(newEntry, updated)!,
  )

  let debt: { price: number; paymentStageId: string } | null = null
  if (newEntry.paymentStatus !== savedPayment.status && savedPayment.status === 'DEBT') {
    debt = await markEntryDebtAsAdmin({
      entryId: newEntry.id,
      paymentStageId: savedPayment.stage ?? 'late',
    })
  }

  const bracketVersion = await syncCategories([oldCategoryKey, newCategoryKey])

  console.log(
    JSON.stringify(
      {
        ok: true,
        action: 'moved_to_experienced',
        oldCategoryKey,
        newCategoryKey,
        debt,
        bracketVersion,
        verify: await verify(newEntry.id, newCategoryKey),
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
