import { prisma } from '../lib/prisma'
import { loadEligibleEntries } from '../lib/brackets/core/eligibility'
import { getCategoryTitleFromKey } from '../lib/registration/categoryIdentity'

async function main() {
  const eligible = await loadEligibleEntries({ includePaid: true, includeUnpaid: false })
  const experienced = eligible.filter((e) => e.experienceLevel === 'experienced')

  const gen = await prisma.bracketGeneration.findFirst({
    where: { status: 'ACTIVE', singletonKey: 'live' },
  })
  if (!gen) {
    console.log('no live generation')
    return
  }

  const draws = await prisma.bracketCategoryDraw.findMany({
    where: { generationId: gen.id, status: 'ACTIVE' },
    include: { participants: true },
  })
  const inDraw = new Set(draws.flatMap((d) => d.participants.map((p) => p.entryId)))

  const missing = experienced.filter((e) => !inDraw.has(e.entryId))
  console.log(`paid experienced: ${experienced.length}, in draws: ${experienced.length - missing.length}, missing: ${missing.length}`)
  for (const e of missing) {
    console.log(`  ! ${e.displayName} · ${e.discipline} · ${getCategoryTitleFromKey(e.effectiveCategoryKey)} · ${e.paymentStatus}`)
  }

  const odinaev = await prisma.athlete.findMany({
    where: { lastName: 'Одинаев' },
    include: { entries: true },
  })
  for (const a of odinaev) {
    console.log(`\n${a.lastName} ${a.firstName}`)
    for (const e of a.entries) {
      console.log(`  ${e.discipline} ${e.experienceLevel} ${e.paymentStatus} ${e.ageDivisionId} ${e.weightCategoryId}`)
    }
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
