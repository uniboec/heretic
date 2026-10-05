#!/usr/bin/env npx tsx
/**
 * Rebuild publishedStructureJson for all ACTIVE draws from current seed positions.
 * Use after deploying the seed-swap public sync fix, or to repair stale snapshots.
 *
 * npx tsx scripts/recompute-published-structures.ts [--dry-run]
 */
import { prisma } from '../lib/prisma'
import { requireWorkingGeneration } from '../lib/brackets/live/generation'
import { recomputeGenerationStructures } from '../lib/brackets/generation/recomputeDrawStructure'
import '../lib/brackets/systems'

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const generation = await requireWorkingGeneration(prisma)
  const draws = await prisma.bracketCategoryDraw.findMany({
    where: { generationId: generation.id, status: 'ACTIVE' },
    select: { id: true, categoryKey: true, systemVersion: true },
    orderBy: { categoryKey: 'asc' },
  })

  console.log(`Generation ${generation.id} v${generation.version}`)
  console.log(`ACTIVE draws: ${draws.length}`)
  for (const draw of draws) {
    console.log(`  · ${draw.categoryKey} (systemVersion=${draw.systemVersion ?? 'null'})`)
  }

  if (dryRun) {
    console.log('\nDry run — no changes applied.')
    return
  }

  await prisma.$transaction(async (tx) => {
    await recomputeGenerationStructures(tx, generation.id)
  })

  console.log('\nPublished structures recomputed.')
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
