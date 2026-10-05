/**
 * Phase 4.3: mark tournament as finalized (mat control read-only).
 * Run once on prod after migration 20261004143000_event_finalized.
 */
import { prisma } from '../lib/prisma'
import { recalculateNormQualifications } from '../lib/rankQualifications/recalculate'

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const before = await prisma.boutsPageSetting.findUnique({ where: { id: 'default' } })
  if (!before) {
    throw new Error('BoutsPageSetting missing')
  }
  console.log(JSON.stringify({ dryRun, eventFinalizedBefore: before.eventFinalized }, null, 2))
  if (dryRun) return
  const after = await prisma.boutsPageSetting.update({
    where: { id: 'default' },
    data: { eventFinalized: true },
    select: { eventFinalized: true, scheduleLegacyGap: true },
  })

  const normsRecalculated = await recalculateNormQualifications()
  console.log(JSON.stringify({ ok: true, ...after, normsRecalculated }, null, 2))
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
