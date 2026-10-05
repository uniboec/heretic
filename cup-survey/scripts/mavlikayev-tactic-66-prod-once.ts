#!/usr/bin/env npx tsx
process.env.CUP_SURVEY_SCRIPT_MODE = '1'
/**
 * Add Tactic Control · Опытные · 14–15 · до 66 кг for Mavlikayev (#46)
 * with ADMITTED_WITHOUT_PAYMENT so he appears as 3rd in the bracket.
 */
import { prisma } from '../lib/prisma'
import { syncBracketDraft } from '../lib/brackets/generation/sync'
import { redrawBracketDraft } from '../lib/brackets/generation/redraw'
import { publishBracketDraft } from '../lib/brackets/generation/publish'
import '../lib/brackets/systems'
import { requireWorkingGeneration } from '../lib/brackets/live/generation'
import { setCategoriesPublicVisibility } from '../lib/brackets/generation/categoryVisibility'
import { bumpRegistrationRevisionInTransaction, runPostCommitBracketSync } from '../lib/registration/bracketImpactCoordinator'
import { collectCategoryKeysFromAthletes } from '../lib/registration/bracketAutoSync'
import {
  getRegistrationCategoryKey,
  getRegistrationCategoryIdentity,
} from '../lib/registration/categoryIdentity'

const PUBLIC_NUMBER = 46

const TACTIC_ENTRY = {
  discipline: 'tactic_control' as const,
  experienceLevel: 'experienced' as const,
  ageDivisionId: 'm_youths_3',
  weightCategoryId: 'm_youths_3_w_le_66',
}

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
  const redrawn = await redrawBracketDraft({
    draftId: draft.id,
    expectedVersion: draft.version,
    scope: 'all',
    categoryKeys: keys,
    onlyStale: true,
  })
  draft = redrawn.draft
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
    getRegistrationCategoryIdentity(TACTIC_ENTRY, athlete)!,
  )

  let tactic66Entry = athlete.entries.find(
    (e) =>
      e.discipline === TACTIC_ENTRY.discipline &&
      e.experienceLevel === TACTIC_ENTRY.experienceLevel &&
      e.ageDivisionId === TACTIC_ENTRY.ageDivisionId &&
      e.weightCategoryId === TACTIC_ENTRY.weightCategoryId,
  )

  if (!tactic66Entry) {
    const referenceEntry = athlete.entries.find((e) => e.discipline === 'tactic_control')
    tactic66Entry = await prisma.athleteEntry.create({
      data: {
        athleteId: athlete.id,
        discipline: TACTIC_ENTRY.discipline,
        experienceLevel: TACTIC_ENTRY.experienceLevel,
        ageDivisionId: TACTIC_ENTRY.ageDivisionId,
        weightCategoryId: TACTIC_ENTRY.weightCategoryId,
        price: referenceEntry?.price ?? 1200,
        paymentStatus: 'ADMITTED_WITHOUT_PAYMENT',
      },
    })

    const categoryKeys = collectCategoryKeysFromAthletes([
      { gender: athlete.gender, entries: [...athlete.entries, tactic66Entry] },
    ])
    await bumpRegistrationRevisionInTransaction()
    await runPostCommitBracketSync(categoryKeys)
  } else if (tactic66Entry.paymentStatus !== 'ADMITTED_WITHOUT_PAYMENT') {
    await prisma.athleteEntry.update({
      where: { id: tactic66Entry.id },
      data: {
        paymentStatus: 'ADMITTED_WITHOUT_PAYMENT',
        paidAt: null,
        paymentStage: null,
      },
    })
    await runPostCommitBracketSync([targetCategoryKey])
  }

  await syncAndPublish([targetCategoryKey])
  await setCategoriesPublicVisibility({ scope: 'all', visible: true })

  const gen = await requireWorkingGeneration(prisma)
  const draw = await prisma.bracketCategoryDraw.findFirst({
    where: { generationId: gen.id, categoryKey: targetCategoryKey },
    include: { participants: true, publicationState: true },
  })

  const finalEntry = await prisma.athleteEntry.findUnique({ where: { id: tactic66Entry.id } })

  console.log(
    JSON.stringify(
      {
        ok: true,
        mavlikayevAthleteId: athlete.id,
        tactic66EntryId: tactic66Entry.id,
        paymentStatus: finalEntry?.paymentStatus,
        targetCategoryKey,
        bracket: draw
          ? {
              participantCount: draw.participants.length,
              participants: draw.participants.map((p) => ({
                entryId: p.entryId,
                name: p.snapshotDisplayName,
                publicNumber: p.snapshotPublicNumber,
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
