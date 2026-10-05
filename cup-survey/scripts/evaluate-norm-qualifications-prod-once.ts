#!/usr/bin/env npx tsx
/**
 * Cup 2026: verify EVSK norm qualifications against prod data.
 */
process.env.CUP_SURVEY_SCRIPT_MODE = '1'

import { isEventFinalized } from '../lib/bouts/eventFinalized'
import { getDisciplineShortLabel, TOURNAMENT_SCOPE_ID } from '../lib/config/tournament'
import { formatNormRankLabel } from '../lib/rankQualifications/formatResultLabel'
import { recalculateNormQualifications } from '../lib/rankQualifications/recalculate'
import { buildNormQualificationPublicRows, getPublicNormQualifications } from '../lib/rankQualifications/service'
import { getNormQualificationSettings, hasNormQualificationData } from '../lib/rankQualifications/settings'
import { prisma } from '../lib/prisma'

async function loadScopeData() {
  const [results, bracketDetails, settingRow] = await Promise.all([
    prisma.rankQualificationResult.findMany({
      where: {
        tournamentScopeId: TOURNAMENT_SCOPE_ID,
        achievedNormRank: { not: null },
      },
      orderBy: [{ athleteId: 'asc' }, { discipline: 'asc' }],
    }),
    prisma.rankQualificationBracketDetail.findMany({
      where: { tournamentScopeId: TOURNAMENT_SCOPE_ID },
    }),
    prisma.rankQualificationSetting.findUnique({
      where: { tournamentScopeId: TOURNAMENT_SCOPE_ID },
      select: { calculatedAt: true },
    }),
  ])

  return {
    calculatedAt: settingRow?.calculatedAt ?? null,
    results,
    bracketDetails,
  }
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const skipRecalculate = process.argv.includes('--skip-recalculate')

  const settingsBefore = await getNormQualificationSettings()
  const eventFinalized = await isEventFinalized()

  console.log(
    JSON.stringify(
      {
        dryRun,
        skipRecalculate,
        eventFinalized,
        settingsBefore,
      },
      null,
      2,
    ),
  )

  if (dryRun) return

  if (!skipRecalculate) {
    const ok = await recalculateNormQualifications()
    if (!ok) {
      throw new Error('recalculateNormQualifications returned false (no published brackets?)')
    }
  }

  if (!(await hasNormQualificationData())) {
    throw new Error('no norm qualification results in database')
  }

  const scopeData = await loadScopeData()
  const rows = await buildNormQualificationPublicRows(scopeData)
  const publicData = await getPublicNormQualifications()

  const summary = rows.map((row) => ({
    athlete: row.athleteName,
    discipline: getDisciplineShortLabel(row.discipline),
    result: row.resultLabel,
    placement: row.placement,
    wins: row.wins,
    matchingBrackets: row.matchingBrackets.length,
  }))

  console.log(
    JSON.stringify(
      {
        eventFinalized,
        publicPageAvailable: publicData.available,
        publicPageRowCount: publicData.rows.length,
        calculatedAt: scopeData.calculatedAt?.toISOString() ?? null,
        rowCount: summary.length,
        rows: summary,
      },
      null,
      2,
    ),
  )

  console.log('\n--- Cup 2026 norm qualifications (final list) ---\n')
  for (const row of rows) {
    const placementWins =
      row.placement != null && row.wins != null ? ` (${row.placement} место · ${row.wins} побед)` : ''
    console.log(
      `${row.athleteName} | ${getDisciplineShortLabel(row.discipline)} | ${formatNormRankLabel(row.achievedNormRank)}${placementWins}`,
    )
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
