#!/usr/bin/env npx tsx
process.env.CUP_SURVEY_SCRIPT_MODE = '1'
/**
 * Add Close Control for Mavlikayev (admitted without payment),
 * move Bahtin Close Control bracket entries to Mavlikayev's category.
 */
import { prisma } from '../lib/prisma'
import { syncBracketDraft } from '../lib/brackets/generation/sync'
import { publishBracketDraft } from '../lib/brackets/generation/publish'
import { requireWorkingGeneration } from '../lib/brackets/live/generation'
import { moveBracketEntry } from '../lib/brackets/placements'
import { setCategoriesPublicVisibility } from '../lib/brackets/generation/categoryVisibility'
import { bumpRegistrationRevisionInTransaction, runPostCommitBracketSync } from '../lib/registration/bracketImpactCoordinator'
import { collectCategoryKeysFromAthletes } from '../lib/registration/bracketAutoSync'
import {
  getRegistrationCategoryKey,
  getRegistrationCategoryIdentity,
} from '../lib/registration/categoryIdentity'

const PUBLIC_NUMBER = 46

const CLOSE_ENTRY = {
  discipline: 'close_control' as const,
  experienceLevel: 'experienced' as const,
  ageDivisionId: 'm_youths_3',
  weightCategoryId: 'm_youths_3_w_le_52',
}

const BAHTIN_ENTRY_IDS = [
  '7ea2a17a-f069-4853-a3d3-ce953ab0bfa4', // experienced
  'c20a6935-9187-442b-80d7-2f6a3751c9fd', // novice
]

const OLD_BAHTIN_KEYS = [
  'close_control:experienced:m_youths_2:m_youths_2_w_le_48',
  'close_control:novice:m_youths_2:m_youths_2_w_le_48',
]

async function syncAndPublish(categoryKeys: string[]) {
  const keys = [...new Set(categoryKeys)]
  let draft = await requireWorkingGeneration(prisma)
  const synced = await syncBracketDraft({
    draftId: draft.id,
    expectedVersion: draft.version,
    scope: 'all',
    categoryKeys: keys,
    afterRegistrationChange: true,
  })
  draft = synced.draft
  const published = await publishBracketDraft({
    draftId: draft.id,
    expectedVersion: draft.version,
  })
  for (const categoryKey of keys) {
    const exists = await prisma.bracketCategoryDraw.findFirst({
      where: { generationId: published.draft.id, categoryKey },
    })
    if (exists) {
      await setCategoriesPublicVisibility({ scope: 'category', categoryKey, visible: true })
    }
  }
  return published
}

async function main() {
  const athlete = await prisma.athlete.findFirst({
    where: {
      lastName: { equals: 'Мавликаев', mode: 'insensitive' },
      firstName: { equals: 'Даниил', mode: 'insensitive' },
      registration: { status: { not: 'CANCELLED' } },
    },
    include: { entries: true, registration: true },
  })
  if (!athlete) throw new Error('Mavlikayev not found')
  if (athlete.registration.publicNumber !== PUBLIC_NUMBER) {
    throw new Error(`Unexpected public number: ${athlete.registration.publicNumber}`)
  }

  const targetCategoryKey = getRegistrationCategoryKey(
    getRegistrationCategoryIdentity(CLOSE_ENTRY, athlete)!,
  )

  let closeEntry = athlete.entries.find((e) => e.discipline === 'close_control')

  if (!closeEntry) {
    const tacticEntry = athlete.entries.find((e) => e.discipline === 'tactic_control')
    closeEntry = await prisma.athleteEntry.create({
      data: {
        athleteId: athlete.id,
        discipline: CLOSE_ENTRY.discipline,
        experienceLevel: CLOSE_ENTRY.experienceLevel,
        ageDivisionId: CLOSE_ENTRY.ageDivisionId,
        weightCategoryId: CLOSE_ENTRY.weightCategoryId,
        price: tacticEntry?.price ?? 1200,
        paymentStatus: 'ADMITTED_WITHOUT_PAYMENT',
      },
    })

    const categoryKeys = collectCategoryKeysFromAthletes([
      { gender: athlete.gender, entries: [...athlete.entries, closeEntry] },
    ])
    await bumpRegistrationRevisionInTransaction()
    await runPostCommitBracketSync(categoryKeys)
  } else if (closeEntry.paymentStatus !== 'ADMITTED_WITHOUT_PAYMENT') {
    await prisma.athleteEntry.update({
      where: { id: closeEntry.id },
      data: {
        paymentStatus: 'ADMITTED_WITHOUT_PAYMENT',
        paidAt: null,
        paymentStage: null,
      },
    })
    await runPostCommitBracketSync([targetCategoryKey])
  }

  await syncAndPublish([targetCategoryKey])

  const bahtinMoves: Array<{ entryId: string; from: string | null }> = []
  for (const entryId of BAHTIN_ENTRY_IDS) {
    const placement = await prisma.bracketEntryPlacement.findUnique({ where: { entryId } })
    const from = placement?.categoryKey ?? null
    if (from === targetCategoryKey) {
      bahtinMoves.push({ entryId, from })
      continue
    }

    let draft = await requireWorkingGeneration(prisma)
    await moveBracketEntry({
      draftId: draft.id,
      expectedVersion: draft.version,
      entryId,
      targetCategoryKey,
      movedBy: 'script:mavlikayev-bahtin-prod-once',
    })
    bahtinMoves.push({ entryId, from })
  }

  await syncAndPublish([targetCategoryKey, ...OLD_BAHTIN_KEYS])

  const gen = await requireWorkingGeneration(prisma)
  const draw = await prisma.bracketCategoryDraw.findFirst({
    where: { generationId: gen.id, categoryKey: targetCategoryKey },
    include: { participants: true, publicationState: true },
  })

  const closeFinal = await prisma.athleteEntry.findUnique({ where: { id: closeEntry.id } })

  console.log(
    JSON.stringify(
      {
        ok: true,
        mavlikayevAthleteId: athlete.id,
        mavlikayevCloseEntryId: closeEntry.id,
        closePaymentStatus: closeFinal?.paymentStatus,
        targetCategoryKey,
        bahtinMoves,
        bracket: draw
          ? {
              participantCount: draw.participants.length,
              participants: draw.participants.map((p) => ({
                entryId: p.entryId,
                name: p.snapshotDisplayName,
              })),
              visible: draw.publicationState?.visible ?? false,
              autoSystemId: draw.autoSystemId,
            }
          : null,
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
