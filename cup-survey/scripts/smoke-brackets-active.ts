/**
 * Post-cutover smoke checks on the main DATABASE_URL (ACTIVE-only path).
 * Usage: npx tsx scripts/smoke-brackets-active.ts
 */
import { prisma } from '../lib/prisma'
import { isBracketsActiveOnlyEnabled } from '../lib/brackets/config'
import { getLiveGeneration } from '../lib/brackets/live/generation'
import { getCurrentPublishedDraws } from '../lib/brackets/generation/publishedDraws'

async function main() {
  const checks: Array<{ name: string; ok: boolean; detail?: string }> = []

  checks.push({
    name: 'BRACKETS_ACTIVE_ONLY flag',
    ok: isBracketsActiveOnlyEnabled(),
    detail: String(process.env.BRACKETS_ACTIVE_ONLY),
  })

  const activeCount = await prisma.bracketGeneration.count({
    where: { status: 'ACTIVE', singletonKey: 'live' },
  })
  checks.push({
    name: 'single ACTIVE singleton',
    ok: activeCount === 1,
    detail: `count=${activeCount}`,
  })

  let liveId = ''
  try {
    const live = await getLiveGeneration()
    liveId = live.id
    checks.push({ name: 'getLiveGeneration()', ok: true, detail: live.id })
  } catch (error) {
    checks.push({
      name: 'getLiveGeneration()',
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    })
  }

  if (liveId) {
    const pairs = await getCurrentPublishedDraws({
      db: prisma,
      activeGeneration: await prisma.bracketGeneration.findUniqueOrThrow({ where: { id: liveId } }),
    })
    checks.push({
      name: 'getCurrentPublishedDraws()',
      ok: pairs.length > 0,
      detail: `categories=${pairs.length}`,
    })

    const nullDrawRows = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count FROM "BracketPublicationState" WHERE "publishedDrawId" IS NULL
    `
    const stale = Number(nullDrawRows[0]?.count ?? 0)
    checks.push({
      name: 'publication pointers',
      ok: stale === 0,
      detail: `nullDrawId=${stale}`,
    })
  }

  const legacyRows = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count FROM "BracketGeneration" WHERE status::text IN ('DRAFT', 'PUBLISHED')
  `
  const legacy = Number(legacyRows[0]?.count ?? 0)
  checks.push({
    name: 'no legacy DRAFT/PUBLISHED rows',
    ok: legacy === 0,
    detail: `legacy=${legacy}`,
  })

  console.log(JSON.stringify(checks, null, 2))

  if (checks.some((check) => !check.ok)) {
    process.exitCode = 1
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
