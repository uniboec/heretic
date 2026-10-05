/**
 * Final backfill for bouts release fields (run after Phase-1 instances are gone).
 * Applies legacy compatibility gate per category.
 */
import { prisma } from '../lib/prisma'
import { computeLegacyReleaseFields } from '../lib/bouts/legacyReleaseGate'
import { extractPlayableBoutsForPair } from '../lib/bouts/extractForPair'
import { toPlayableBouts } from '../lib/bouts/toPlayableBouts'
import { getCurrentPublishedDraws } from '../lib/brackets/generation/publishedDraws'

async function main() {
  const published = await prisma.bracketGeneration.findFirst({
    where: { singletonKey: 'live', status: 'ACTIVE' },
    orderBy: { publishedAt: 'desc' },
  })
  if (!published) {
    console.log('No published generation — skipped')
    return
  }

  const settings = await prisma.boutsPageSetting.findUnique({ where: { id: 'default' } })
  const matCount = settings?.matCount ?? 1
  const pairs = await getCurrentPublishedDraws({ activeGeneration: published })

  let updated = 0
  for (const pair of pairs) {
    const autoBoutIds = toPlayableBouts(
      extractPlayableBoutsForPair(pair),
      pair.draw.participants.length,
    ).map((bout) => bout.id)

    const fields = computeLegacyReleaseFields({
      visible: pair.publicationState.visible,
      storedMatIndex: pair.draw.matIndex ?? null,
      matCount,
      autoBoutIds,
    })

    await prisma.bracketPublicationState.update({
      where: { categoryKey: pair.draw.categoryKey },
      data: {
        boutsReleased: fields.boutsReleased,
        boutMatAssignments: fields.boutMatAssignments as never,
        matCountAtRelease: fields.matCountAtRelease,
      },
    })
    updated++
  }

  console.log(`Backfilled bouts release fields for ${updated} categories (matCount=${matCount})`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
