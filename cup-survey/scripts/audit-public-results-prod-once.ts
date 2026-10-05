#!/usr/bin/env npx tsx
process.env.CUP_SURVEY_SCRIPT_MODE = '1'
import { prisma } from '../lib/prisma'
import { getActivePublishedGeneration, getPublicVisiblePublishedDraws } from '../lib/brackets/generation/publishedDraws'
import { getEffectiveBronzeMode, getEffectiveSystemId } from '../lib/brackets/core/formatRules'
import { readPublishedStructure } from '../lib/brackets/core/readPublishedStructure'
import { readCategoryResult } from '../lib/brackets/core/readCategoryResult'
import { buildPublicResultRows, buildPublicResultsStats } from '../lib/brackets/publicResults'
import { getCategoryTitleFromKey } from '../lib/registration/categoryIdentity'
import { getBracketPageSettings } from '../lib/brackets/generation/bracketPageSettings'

async function main() {
  const settings = await getBracketPageSettings(prisma)
  const published = await getActivePublishedGeneration(prisma)
  if (!published) throw new Error('no generation')

  const visiblePairs = await getPublicVisiblePublishedDraws(published)
  const categorySources = visiblePairs.map((pair) => {
    const draw = pair.draw
    const effectiveSystemId = getEffectiveSystemId(draw.autoSystemId, draw.systemOverride)
    const effectiveBronzeMode = getEffectiveBronzeMode(draw.autoBronzeMode, draw.bronzeModeOverride)
    const structure = readPublishedStructure({
      publishedStructureJson: draw.publishedStructureJson,
      autoSystemId: draw.autoSystemId,
      systemOverride: draw.systemOverride,
      systemVersion: draw.systemVersion,
      autoBronzeMode: draw.autoBronzeMode,
      bronzeModeOverride: draw.bronzeModeOverride,
      drawSeed: draw.drawSeed,
      participants: draw.participants,
      effectiveBronzeMode,
    })
    const result = readCategoryResult(structure, effectiveSystemId, {
      participantCount: draw.participants.length,
      bronzeMode: effectiveBronzeMode,
    })
    return {
      categoryKey: draw.categoryKey,
      discipline: draw.discipline,
      title: getCategoryTitleFromKey(draw.categoryKey),
      participants: draw.participants.map((p) => ({
        entryId: p.entryId,
        displayName: p.snapshotDisplayName ?? '',
        clubName: p.snapshotClubName ?? '',
        city: p.snapshotCity ?? '',
      })),
      result,
      participantCount: draw.participants.length,
      systemId: effectiveSystemId,
      status: result?.status ?? null,
      placementCount: result?.placements?.length ?? 0,
    }
  })

  const rows = buildPublicResultRows(categorySources)
  const stats = buildPublicResultsStats(rows)

  const byStatus = {
    complete: categorySources.filter((c) => c.status === 'complete').length,
    in_progress: categorySources.filter((c) => c.status === 'in_progress').length,
    other: categorySources.filter((c) => c.status !== 'complete' && c.status !== 'in_progress').length,
  }

  const noThirdBecauseTwoParticipants = categorySources.filter(
    (c) => c.status === 'complete' && c.participantCount === 2 && c.placementCount === 2,
  )
  const championSingle = categorySources.filter(
    (c) => c.systemId === 'champion' || c.participantCount === 1,
  )

  console.log(
    JSON.stringify(
      {
        publicEnabled: settings.publicEnabled,
        visibleCategories: categorySources.length,
        byStatus,
        publicResultRows: rows.length,
        stats,
        championOrSingle: championSingle.map((c) => ({
          title: c.title,
          participants: c.participantCount,
          placements: c.placementCount,
        })),
        twoParticipantComplete: noThirdBecauseTwoParticipants.map((c) => c.title),
        missingFromResults: categorySources
          .filter((c) => c.status !== 'complete')
          .map((c) => ({
            title: c.title,
            status: c.status,
            participants: c.participantCount,
            placements: c.placementCount,
          })),
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
