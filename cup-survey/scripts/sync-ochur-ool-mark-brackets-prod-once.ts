#!/usr/bin/env npx tsx
process.env.CUP_SURVEY_SCRIPT_MODE = '1'
/**
 * Sync Очур-Оол Марк (#55) into published experienced brackets on prod.
 */
import { prisma } from '../lib/prisma'
import { syncBracketDraft } from '../lib/brackets/generation/sync'
import { requireWorkingGeneration } from '../lib/brackets/live/generation'
import { setCategoriesPublicVisibility } from '../lib/brackets/generation/categoryVisibility'
import {
  getRegistrationCategoryKey,
  getRegistrationCategoryIdentity,
  getCategoryTitleFromKey,
} from '../lib/registration/categoryIdentity'
import { getCategoryLockLevel } from '../lib/brackets/live/guard'

const ATHLETE_ID = '23b1f76a-5b15-424d-83be-4d9510507288'
const PUBLIC_NUMBER = 55

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
    await setCategoriesPublicVisibility({ scope: 'category', categoryKey, visible: true })
  }
  return synced.draft.version
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

  const categoryKeys = athlete.entries.map((entry) =>
    getRegistrationCategoryKey(getRegistrationCategoryIdentity(entry, athlete)!),
  )

  const pubStates = await prisma.bracketPublicationState.findMany({
    where: { categoryKey: { in: categoryKeys } },
  })
  const lockInfo = categoryKeys.map((categoryKey) => {
    const state = pubStates.find((row) => row.categoryKey === categoryKey)
    return {
      categoryKey,
      categoryTitle: getCategoryTitleFromKey(categoryKey),
      lockLevel: getCategoryLockLevel(state),
      visible: state?.visible ?? false,
      boutsReleased: state?.boutsReleased ?? false,
    }
  })

  const bracketVersion = await syncCategories(categoryKeys)

  const gen = await requireWorkingGeneration(prisma)
  const brackets = []
  for (const entry of athlete.entries) {
    const categoryKey = getRegistrationCategoryKey(getRegistrationCategoryIdentity(entry, athlete)!)
    const participant = await prisma.bracketDrawParticipant.findFirst({
      where: { entryId: entry.id, draw: { generationId: gen.id, categoryKey } },
      include: {
        draw: {
          include: {
            participants: true,
            publicationState: true,
          },
        },
      },
    })
    brackets.push({
      discipline: entry.discipline,
      categoryKey,
      categoryTitle: getCategoryTitleFromKey(categoryKey),
      inBracket: Boolean(participant),
      participantCount: participant?.draw.participants.length ?? 0,
      participants: participant?.draw.participants.map((row) => row.snapshotDisplayName) ?? [],
      visible: participant?.draw.publicationState?.visible ?? false,
      boutsReleased: participant?.draw.publicationState?.boutsReleased ?? false,
    })
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        publicNumber: PUBLIC_NUMBER,
        lockInfo,
        bracketVersion,
        brackets,
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
