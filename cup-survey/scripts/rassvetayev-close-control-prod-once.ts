#!/usr/bin/env npx tsx
process.env.CUP_SURVEY_SCRIPT_MODE = '1'
/**
 * Move Rassvetayev (#43) to Close-Control · Опытные · Юноши 2 · до 61 кг.
 */
import { prisma } from '../lib/prisma'
import { updateAthleteAsAdmin } from '../lib/registration/service'
import { markEntryDebtAsAdmin } from '../lib/registration/manualPayment'
import { syncBracketDraft } from '../lib/brackets/generation/sync'
import { requireWorkingGeneration } from '../lib/brackets/live/generation'
import { getRegistrationCategoryKey, getRegistrationCategoryIdentity } from '../lib/registration/categoryIdentity'

const ATHLETE_ID = '340c0fce-228e-43ff-a207-18888f312276'
const PUBLIC_NUMBER = 43
const TARGET = {
  discipline: 'close_control' as const,
  experienceLevel: 'experienced' as const,
  ageDivisionId: 'm_youths_2',
  weightCategoryId: 'm_youths_2_w_le_61',
}

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
  const entry = await prisma.athleteEntry.findUnique({ where: { id: entryId } })
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
          categoryKey,
          participantCount: participant.draw.participants.length,
          autoSystemId: participant.draw.autoSystemId,
          visible: participant.draw.publicationState?.visible ?? false,
          boutsReleased: participant.draw.publicationState?.boutsReleased ?? false,
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

  const entry = athlete.entries[0]
  if (!entry) throw new Error('No entries')

  const birthDate = athlete.birthDate.toISOString().slice(0, 10)
  const oldCategoryKey = getRegistrationCategoryKey(
    getRegistrationCategoryIdentity(entry, athlete)!,
  )
  const newCategoryKey = getRegistrationCategoryKey(
    getRegistrationCategoryIdentity({ ...TARGET }, athlete)!,
  )

  const alreadyClose =
    entry.discipline === TARGET.discipline &&
    entry.experienceLevel === TARGET.experienceLevel &&
    entry.ageDivisionId === TARGET.ageDivisionId &&
    entry.weightCategoryId === TARGET.weightCategoryId

  const savedPayment = {
    status: entry.paymentStatus,
    stage: entry.paymentStage,
  }

  let entryId = entry.id

  if (!alreadyClose) {
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
    const newEntry = updated?.entries[0]
    if (!newEntry) throw new Error('Entry missing after update')
    entryId = newEntry.id

    if (newEntry.paymentStatus !== savedPayment.status && savedPayment.status === 'DEBT') {
      await markEntryDebtAsAdmin({
        entryId: newEntry.id,
        paymentStageId: savedPayment.stage ?? 'early',
      })
    }
  }

  const bracketVersion = await syncCategories([oldCategoryKey, newCategoryKey])

  await prisma.$executeRaw`
    UPDATE "BracketPublicationState"
    SET visible = true, "updatedAt" = NOW()
    WHERE "categoryKey" = ${newCategoryKey}
  `

  console.log(
    JSON.stringify(
      {
        ok: true,
        action: alreadyClose ? 'already_close_control' : 'moved_to_close_control',
        publicNumber: PUBLIC_NUMBER,
        oldCategoryKey,
        newCategoryKey,
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
