#!/usr/bin/env npx tsx
process.env.CUP_SURVEY_SCRIPT_MODE = '1'
import { prisma } from '../lib/prisma'
import { TOURNAMENT_SCOPE_ID } from '../lib/config/tournament'
import { getEffectiveBronzeMode, getEffectiveSystemId } from '../lib/brackets/core/formatRules'
import { readPublishedStructure } from '../lib/brackets/core/readPublishedStructure'
import { readCategoryResult } from '../lib/brackets/core/readCategoryResult'
import { getCategoryTitleFromKey } from '../lib/registration/categoryIdentity'

const CATEGORY_KEY = 'close_control:novice:m_youths_2:m_youths_2_w_le_48'

async function main() {
  const draw = await prisma.bracketCategoryDraw.findFirst({
    where: { categoryKey: CATEGORY_KEY },
    include: { participants: { orderBy: { seedPosition: 'asc' } } },
    orderBy: { updatedAt: 'desc' },
  })
  if (!draw) throw new Error('draw not found')

  const systemId = getEffectiveSystemId(draw.autoSystemId, draw.systemOverride)
  const bronzeMode = getEffectiveBronzeMode(draw.autoBronzeMode, draw.bronzeModeOverride)
  const structure = readPublishedStructure({
    publishedStructureJson: draw.publishedStructureJson,
    autoSystemId: draw.autoSystemId,
    systemOverride: draw.systemOverride,
    systemVersion: draw.systemVersion,
    autoBronzeMode: draw.autoBronzeMode,
    bronzeModeOverride: draw.bronzeModeOverride,
    drawSeed: draw.drawSeed,
    participants: draw.participants,
    effectiveBronzeMode: bronzeMode,
  })
  const result = readCategoryResult(structure, systemId, {
    participantCount: draw.participants.length,
    bronzeMode,
  })

  const award = await prisma.awardCeremonyQueue.findUnique({
    where: {
      tournamentScopeId_categoryKey: {
        tournamentScopeId: TOURNAMENT_SCOPE_ID,
        categoryKey: CATEGORY_KEY,
      },
    },
    include: { placements: { orderBy: { placementIndex: 'asc' } } },
  })

  const name = (id: string) => draw.participants.find((p) => p.entryId === id)?.snapshotDisplayName ?? id

  console.log(
    JSON.stringify(
      {
        categoryKey: CATEGORY_KEY,
        title: getCategoryTitleFromKey(CATEGORY_KEY),
        systemId,
        participantCount: draw.participants.length,
        resultStatus: result?.status,
        placements: (result?.placements ?? []).map((p) => ({
          placement: p.placement,
          name: name(p.entryId),
        })),
        awardQueue: award
          ? {
              status: award.status,
              queueGroup: award.queueGroup,
              queueOrder: award.queueOrder,
              needsReview: award.needsReview,
              conflictReason: award.conflictReason,
              placements: award.placements.map((p) => ({
                placement: p.placement,
                name: `${p.lastName} ${p.firstName}`.trim(),
                status: p.status,
              })),
            }
          : null,
      },
      null,
      2,
    ),
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => prisma.$disconnect())
