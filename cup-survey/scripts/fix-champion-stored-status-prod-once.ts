#!/usr/bin/env npx tsx
process.env.CUP_SURVEY_SCRIPT_MODE = '1'
/**
 * Acceptance B data fix: persist result.status=complete for champion / single-participant categories
 * when placements are already present but stored status is missing or in_progress.
 */
import { prisma } from '../lib/prisma'
import { getActivePublishedGeneration, getPublicVisiblePublishedDraws } from '../lib/brackets/generation/publishedDraws'
import { getEffectiveBronzeMode, getEffectiveSystemId } from '../lib/brackets/core/formatRules'
import { deserializePublishedStructure, serializePublishedStructure } from '../lib/brackets/core/snapshot'
import { deriveCategoryPlacements } from '../lib/brackets/deriveCategoryPlacements'
import { getCategoryTitleFromKey } from '../lib/registration/categoryIdentity'

const dryRun = process.argv.includes('--dry-run')

async function main() {
  const published = await getActivePublishedGeneration(prisma)
  if (!published) throw new Error('no published generation')

  const visiblePairs = await getPublicVisiblePublishedDraws(published)
  const fixed: string[] = []

  for (const pair of visiblePairs) {
    const draw = pair.draw
    const systemId = getEffectiveSystemId(draw.autoSystemId, draw.systemOverride)
    const bronzeMode = getEffectiveBronzeMode(draw.autoBronzeMode, draw.bronzeModeOverride)
    if (systemId !== 'champion' && draw.participants.length !== 1) continue

    const snapshot = deserializePublishedStructure(draw.publishedStructureJson)
    if (!snapshot) continue
    if (snapshot.structure.result?.status === 'complete') continue

    const derived = deriveCategoryPlacements(snapshot.structure, {
      systemId,
      bronzeMode,
      participantCount: draw.participants.length,
    })
    if (derived.status !== 'complete' || !derived.placements.length) continue

    const nextStructure = {
      ...snapshot.structure,
      result: derived,
    }
    const nextJson = serializePublishedStructure({
      systemId: snapshot.systemId,
      systemVersion: snapshot.systemVersion,
      structure: nextStructure,
    })

    if (!dryRun) {
      await prisma.bracketCategoryDraw.update({
        where: { id: draw.id },
        data: { publishedStructureJson: nextJson },
      })
    }

    fixed.push(getCategoryTitleFromKey(draw.categoryKey))
  }

  console.log(JSON.stringify({ dryRun, fixedCount: fixed.length, fixed }, null, 2))
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => prisma.$disconnect())
