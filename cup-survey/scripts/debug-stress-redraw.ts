import { prisma } from '../lib/prisma'
import '../lib/brackets/systems'
import {
  cleanupBracketIntegrationData,
  createIsolatedDraft,
  ensureBracketDefaults,
  purgeBracketIntegrationState,
  seedCategoryWithAthletes,
  syncRedrawAll,
} from '../lib/brackets/__tests__/integration/helpers'
import { assertIntegrationTestDatabase } from '../lib/db/integrationDatabaseUrl'

async function main() {
  assertIntegrationTestDatabase()
  await purgeBracketIntegrationState()
  await ensureBracketDefaults()

  const size = Number(process.argv[2] ?? 20)
  const seeded = await seedCategoryWithAthletes({ participantCount: size })
  const draft = await createIsolatedDraft()

  console.log('category', seeded.categoryKey, 'entries', seeded.entryIds.length)

  try {
    const ready = await syncRedrawAll(draft.id, draft.version)
    const draw = await prisma.bracketCategoryDraw.findFirst({
      where: { generationId: ready.draft.id, categoryKey: seeded.categoryKey },
      include: { participants: true },
    })
    console.log('draw', draw?.id, 'participants', draw?.participants.length, 'system', draw?.autoSystemId)
    console.log('success version', ready.draft.version)
  } catch (error) {
    console.error('FAILED', error)
    const draw = await prisma.bracketCategoryDraw.findFirst({
      where: { generationId: draft.id, categoryKey: seeded.categoryKey },
      include: { participants: true },
    })
    console.log('after fail draw', draw?.id, 'participants', draw?.participants.length)
  }

  await cleanupBracketIntegrationData({
    generationIds: [draft.id],
    registrationIds: seeded.registrationIds,
    entryIds: seeded.entryIds,
  })
  await prisma.$disconnect()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
