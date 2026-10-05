#!/usr/bin/env npx tsx
process.env.CUP_SURVEY_SCRIPT_MODE = '1'

import { prisma } from '../lib/prisma'
import { loadFullScheduleSnapshot, buildScheduledMats } from '../lib/bouts/scheduleService'
import {
  frozenNumberFromExecution,
  hasFrozenPrefixViolation,
} from '../lib/bouts/scheduleDisplayNumber'
import type { ScheduleExecutionRecord } from '../lib/bouts/scheduleTypes'

async function main() {
  const settings = await prisma.boutsPageSetting.findUniqueOrThrow({ where: { id: 'default' } })
  const fullSnapshot = await loadFullScheduleSnapshot(prisma, { adminPreview: true })
  const scheduled = buildScheduledMats({
    grouped: fullSnapshot.grouped,
    snapshot: fullSnapshot,
    now: new Date(),
  })

  const executionRows = await prisma.boutScheduleExecution.findMany({
    select: {
      boutId: true,
      actualStartAt: true,
      actualEndAt: true,
      frozenScheduleFormatted: true,
      frozenScheduleMatNumber: true,
      frozenSchedulePosition: true,
      boutPhase: true,
    },
  })
  const executions = new Map<string, ScheduleExecutionRecord>(
    executionRows.map((row) => [row.boutId, row]),
  )

  const violated = hasFrozenPrefixViolation({
    matsEnabled: fullSnapshot.settings.matsEnabled,
    mats: scheduled.mats,
    executions,
  })

  console.log(
    JSON.stringify(
      {
        matsEnabled: fullSnapshot.settings.matsEnabled,
        scheduleLegacyGap: settings.scheduleLegacyGap,
        matCount: scheduled.mats.length,
        violated,
        frozenCount: executionRows.filter((r) => r.frozenScheduleFormatted).length,
      },
      null,
      2,
    ),
  )

  for (const mat of scheduled.mats) {
    const queue = mat.bouts.map((bout) => {
      const execution = executions.get(bout.id)
      const frozen = frozenNumberFromExecution(
        execution ?? { boutId: bout.id, actualStartAt: null, actualEndAt: null },
      )
      return {
        boutId: bout.id,
        label: bout.label,
        frozen: frozen?.formatted ?? null,
        phase: execution?.boutPhase ?? null,
        isFrozen: frozen != null,
      }
    })

    let seenNonFrozen = false
    const violations: Array<{ index: number; boutId: string; label: string; frozen: string | null }> =
      []
    queue.forEach((entry, index) => {
      if (seenNonFrozen && entry.isFrozen) {
        violations.push({
          index,
          boutId: entry.boutId,
          label: entry.label,
          frozen: entry.frozen,
        })
      }
      if (!entry.isFrozen) seenNonFrozen = true
    })

    if (violations.length > 0) {
      console.log(`\n=== Mat ${mat.matIndex} violations ===`)
      const start = Math.max(0, violations[0].index - 3)
      console.log(JSON.stringify(queue.slice(start, violations[0].index + 2), null, 2))
      console.log('violations:', JSON.stringify(violations.slice(0, 10), null, 2))
    }
  }
}

main().finally(async () => prisma.$disconnect())
