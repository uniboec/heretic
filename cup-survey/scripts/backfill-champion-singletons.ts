/**
 * One-time backfill: INACTIVE singleton draws → ACTIVE champion via rebuildDrawAfterCompositionChange.
 * Run after migration 20260926160000_bracket_champion_system.
 */
import { prisma } from '../lib/prisma'
import { acquireBracketWriteLocks } from '../lib/brackets/live/locks'
import { getLiveGeneration } from '../lib/brackets/live/generation'
import { rebuildDrawAfterCompositionChange } from '../lib/brackets/generation/rebuildDraw'

async function main() {
  await prisma.$transaction(async (tx) => {
    await acquireBracketWriteLocks(tx, { scope: 'destructive_admin' })

    const generation = await getLiveGeneration(tx)
    const rules = await tx.bracketFormatRule.findMany({ orderBy: { sortOrder: 'asc' } })
    const draws = await tx.bracketCategoryDraw.findMany({
      where: { generationId: generation.id },
      include: { participants: true },
    })

    let updated = 0
    for (const draw of draws) {
      if (draw.participants.length !== 1) continue
      await rebuildDrawAfterCompositionChange(tx, draw.id, rules, 1)
      updated++
    }

    console.log(`Backfilled ${updated} singleton draw(s) to champion`)
  })
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
