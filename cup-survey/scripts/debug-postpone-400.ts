#!/usr/bin/env npx tsx
process.env.CUP_SURVEY_SCRIPT_MODE = '1'

import { prisma } from '../lib/prisma'
import { getActivePublishedGeneration, getCurrentPublishedDraws } from '../lib/brackets/generation/publishedDraws'
import {
  buildScheduleOverridesFromPairs,
  getGroupedBoutsForSchedule,
} from '../lib/bouts/schedulePipeline'
import { normalizeBoutsPageSettings } from '../lib/bouts/normalizeBoutsPageSettings'
import { applyMatQueueAfterOverrides } from '../lib/bouts/applyMatQueueAfterOverrides'
import {
  applyMatQueueAfterOnRuntimeOrder,
  orderMatBoutsForRuntime,
  stabilizeMatQueueAfterOverrides,
} from '../lib/bouts/matRuntimeOrder'
import { listRunnableMatBoutIds, resolvePostponeAnchorId } from '../lib/bouts/resolvePostponeAnchor'
import {
  assertCascadeBeforeAnchor,
  assertRunnableOrderRespectsSportDependencies,
  buildPostponeCascadeOverrides,
  collectMatPostponeCascadeBoutIds,
  filterCascadeForPostponeAnchor,
} from '../lib/bouts/postponeCascade'
import { buildSportDependencyGraph, sportPredecessors } from '../lib/bouts/sportDependencies'

const BOUT_ID = 'close_control:experienced:m_youths_3:m_youths_3_w_le_52::bout-1'
const POSTPONE_BY = 1

function sideName(bout: { sideA: { kind: string; displayName?: string; label?: string }; sideB: { kind: string; displayName?: string; label?: string } }) {
  const a = bout.sideA.kind === 'athlete' ? bout.sideA.displayName : bout.sideA.label
  const b = bout.sideB.kind === 'athlete' ? bout.sideB.displayName : bout.sideB.label
  return `${a} vs ${b}`
}

async function main() {
  const settings = await prisma.boutsPageSetting.findUniqueOrThrow({ where: { id: 'default' } })
  const published = await getActivePublishedGeneration(prisma)
  const pairs = await getCurrentPublishedDraws({ db: prisma, activeGeneration: published! })
  const grouped = await getGroupedBoutsForSchedule(prisma, settings.matCount, { adminPreview: true })
  const overrides = buildScheduleOverridesFromPairs(pairs, grouped)
  const norm = normalizeBoutsPageSettings(settings)
  const mat1 = grouped.mats.find((m) => m.matIndex === 1)!
  const ordered = orderMatBoutsForRuntime({
    groupedMats: grouped.mats,
    matIndex: 1,
    overrides,
    settings: norm,
  })
  const executionRows = await prisma.boutScheduleExecution.findMany({
    where: { boutId: { in: mat1.bouts.map((b) => b.id) } },
    select: { boutId: true, actualEndAt: true, boutPhase: true },
  })
  const completedBoutIds = new Set(
    executionRows.filter((r) => r.actualEndAt != null).map((r) => r.boutId),
  )
  const runnableIds = listRunnableMatBoutIds(ordered.map((b) => b.id), completedBoutIds)
  const bout = mat1.bouts.find((b) => b.id === BOUT_ID)!

  console.log('Pair:', sideName(bout))
  console.log('Index:', runnableIds.indexOf(BOUT_ID))
  console.log(
    'First 8:',
    runnableIds.slice(0, 8).map((id, i) => `${i}:${id.split('::').slice(-2).join('::')}`),
  )
  const preliminary = collectMatPostponeCascadeBoutIds({
    rootBoutId: BOUT_ID,
    matBouts: mat1.bouts,
    completedBoutIds,
    runnableMatBoutIds: runnableIds,
    overrides,
  })
  const anchor = resolvePostponeAnchorId(runnableIds, BOUT_ID, POSTPONE_BY, new Set(preliminary))
  const orderedBefore = orderMatBoutsForRuntime({
    groupedMats: grouped.mats,
    matIndex: 1,
    overrides,
    settings: norm,
  })
  const cascade = filterCascadeForPostponeAnchor({
    cascadeBoutIds: preliminary,
    rootBoutId: BOUT_ID,
    postponeAfterBoutId: anchor,
    overrides,
    groupedMats: grouped.mats,
    matIndex: 1,
    settings: norm,
    matBouts: mat1.bouts,
    runnableMatBoutIds: runnableIds,
    completedBoutIds,
    orderedMatBoutsBefore: orderedBefore,
  })

  for (const id of preliminary) {
    console.log('override', id.split('::').pop(), '->', overrides[id]?.queueAfterBoutId?.split('::').pop() ?? 'none')
  }
  console.log('Phase:', executionRows.find((r) => r.boutId === BOUT_ID)?.boutPhase ?? 'none')
  console.log('Preliminary:', preliminary.length, 'Filtered:', cascade.length)
  console.log('Cascade:', cascade.map((id) => id.split('::').slice(-2).join('::')))
  console.log('Anchor:', anchor.split('::').pop(), '@', runnableIds.indexOf(anchor))

  const withQueueAfter = Object.entries(overrides)
    .filter(([, v]) => v?.queueAfterBoutId)
    .map(([id, v]) => `${id.split('::').pop()} -> ${v!.queueAfterBoutId!.split('::').pop()}`)
  console.log('All queueAfter overrides:', withQueueAfter.length ? withQueueAfter.join(', ') : 'none')

  for (const size of [preliminary.length, 3, 2, 1]) {
    const subset = preliminary.slice(0, size)
    try {
      const nextOverrides = buildPostponeCascadeOverrides({
        rootBoutId: BOUT_ID,
        cascadeBoutIds: subset,
        postponeAfterBoutId: anchor,
        overrides,
        matBouts: mat1.bouts,
        runnableMatBoutIds: runnableIds,
        completedBoutIds,
      })
      const orderedBefore = orderMatBoutsForRuntime({
        groupedMats: grouped.mats,
        matIndex: 1,
        overrides,
        settings: norm,
      })
      const orderedAfter = orderMatBoutsForRuntime({
        groupedMats: grouped.mats,
        matIndex: 1,
        overrides: nextOverrides,
        settings: norm,
      })
      const surgicalAfter = applyMatQueueAfterOverrides(orderedBefore, nextOverrides)
      const simpleAfter = applyMatQueueAfterOverrides(mat1.bouts, nextOverrides)
      const runnableSurgical = listRunnableMatBoutIds(surgicalAfter.map((b) => b.id), completedBoutIds)
      const runnableAfter = listRunnableMatBoutIds(orderedAfter.map((b) => b.id), completedBoutIds)
      const closeIdx = runnableAfter
        .map((id, i) => `${i}:${id.split('::').slice(-2).join('::')}`)
        .filter((s) => s.includes('close_control'))
        .slice(0, 6)
      console.log('  close positions (runtime):', closeIdx.join(', '))
      const closeSimple = simpleAfter
        .map((b, i) => `${i}:${b.id.split('::').slice(-2).join('::')}`)
        .filter((s) => s.includes('close_control'))
        .slice(0, 6)
      console.log('  close positions (simple):', closeSimple.join(', '))
      console.log(
        '  first 12 (full):',
        runnableAfter.slice(0, 12).map((id, i) => `${i}:${id.split('::').slice(-2).join('::')}`).join(', '),
      )
      console.log(
        '  first 12 (surgical):',
        runnableSurgical.slice(0, 12).map((id, i) => `${i}:${id.split('::').slice(-2).join('::')}`).join(', '),
      )
      const distributeBase = orderMatBoutsForRuntime({
        groupedMats: grouped.mats,
        matIndex: 1,
        overrides: {},
        settings: norm,
      })
      let fixed = distributeBase
      for (let pass = 0; pass < 16; pass += 1) {
        const next = applyMatQueueAfterOverrides(fixed, nextOverrides)
        if (next.map((b) => b.id).join('|') === fixed.map((b) => b.id).join('|')) break
        fixed = next
      }
      const reloadMatches =
        orderedAfter.map((b) => b.id).join('|') === surgicalAfter.map((b) => b.id).join('|')
      const fixedMatches =
        fixed.map((b) => b.id).join('|') === surgicalAfter.map((b) => b.id).join('|')
      console.log('  reload matches surgical:', reloadMatches, 'fixed matches:', fixedMatches)
      try {
        assertRunnableOrderRespectsSportDependencies({
          matBouts: mat1.bouts,
          runnableBoutIds: runnableSurgical,
          completedBoutIds,
        })
        console.log('  surgical sport deps: OK')
      } catch (sportError) {
        console.log('  surgical sport deps: FAIL', sportError instanceof Error ? sportError.message : sportError)
      }
      assertRunnableOrderRespectsSportDependencies({
        matBouts: mat1.bouts,
        runnableBoutIds: runnableAfter,
        completedBoutIds,
      })
      console.log(
        'Subset size',
        size,
        'OK, first 6:',
        runnableAfter.slice(0, 6).map((id) => id.split('::').pop()),
      )
    } catch (e) {
      const subset = preliminary.slice(0, size)
      const nextOverrides = buildPostponeCascadeOverrides({
        rootBoutId: BOUT_ID,
        cascadeBoutIds: subset,
        postponeAfterBoutId: anchor,
        overrides,
        matBouts: mat1.bouts,
        runnableMatBoutIds: runnableIds,
        completedBoutIds,
      })
      const orderedAfter = orderMatBoutsForRuntime({
        groupedMats: grouped.mats,
        matIndex: 1,
        overrides: nextOverrides,
        settings: norm,
      })
      const runnableAfter = listRunnableMatBoutIds(orderedAfter.map((b) => b.id), completedBoutIds)
      const graph = buildSportDependencyGraph(mat1.bouts, new Set(mat1.bouts.map((b) => b.id)))
      const indexBy = new Map(runnableAfter.map((id, i) => [id, i]))
      for (const boutId of runnableAfter) {
        for (const predId of sportPredecessors(graph, boutId)) {
          if (completedBoutIds.has(predId)) continue
          const pi = indexBy.get(predId)
          const bi = indexBy.get(boutId)
          if (pi != null && bi != null && pi >= bi) {
            console.log('  viol:', boutId, 'idx', bi, 'pred', predId, 'idx', pi)
          }
        }
      }
      console.log('Subset size', size, 'FAIL:', e instanceof Error ? e.message : e)
    }
  }

  try {
    const resolvedAnchor = resolvePostponeAnchorId(
      runnableIds,
      BOUT_ID,
      POSTPONE_BY,
      new Set(cascade),
    )
    assertCascadeBeforeAnchor({
      rootBoutId: BOUT_ID,
      runnableMatBoutIds: runnableIds,
      anchorIndex: runnableIds.indexOf(resolvedAnchor),
    })
    const nextOverrides = buildPostponeCascadeOverrides({
      rootBoutId: BOUT_ID,
      cascadeBoutIds: cascade,
      postponeAfterBoutId: resolvedAnchor,
      overrides,
      matBouts: mat1.bouts,
      runnableMatBoutIds: runnableIds,
      completedBoutIds,
    })
    const orderedAfter = applyMatQueueAfterOnRuntimeOrder(orderedBefore, nextOverrides)
    const runnableAfter = listRunnableMatBoutIds(orderedAfter.map((b) => b.id), completedBoutIds)
    console.log('Resolved anchor:', resolvedAnchor.split('::').pop(), '@', runnableIds.indexOf(resolvedAnchor))
    console.log('Index before/after:', runnableIds.indexOf(BOUT_ID), runnableAfter.indexOf(BOUT_ID))
    console.log(
      'After first 6:',
      runnableAfter.slice(0, 6).map((id, i) => `${i}:${id.split('::').slice(-2).join('::')}`).join(', '),
    )

    const graph = buildSportDependencyGraph(mat1.bouts, new Set(mat1.bouts.map((b) => b.id)))
    const indexBy = new Map(runnableAfter.map((id, i) => [id, i]))
    for (const boutId of runnableAfter) {
      for (const predId of sportPredecessors(graph, boutId)) {
        if (completedBoutIds.has(predId)) continue
        const predIndex = indexBy.get(predId)
        const boutIndex = indexBy.get(boutId)
        if (predIndex != null && boutIndex != null && predIndex >= boutIndex) {
          console.error('Violation:', boutId.split('::').pop(), 'before', predId.split('::').pop())
        }
      }
    }
    assertRunnableOrderRespectsSportDependencies({
      matBouts: mat1.bouts,
      runnableBoutIds: runnableAfter,
      completedBoutIds,
    })
    const stabilizedOverrides = stabilizeMatQueueAfterOverrides({
      groupedMats: grouped.mats,
      matIndex: 1,
      settings: norm,
      targetOrder: orderedAfter,
      overrides: nextOverrides,
    })
    const reloadAfter = orderMatBoutsForRuntime({
      groupedMats: grouped.mats,
      matIndex: 1,
      overrides: stabilizedOverrides,
      settings: norm,
    })
    const reloadIds = listRunnableMatBoutIds(reloadAfter.map((b) => b.id), completedBoutIds)
    console.log(
      'Reload first 6:',
      reloadIds.slice(0, 6).map((id, i) => `${i}:${id.split('::').slice(-2).join('::')}`).join(', '),
    )
    console.log(
      'Reload matches surgical:',
      reloadIds.join('|') === runnableAfter.join('|'),
    )
    console.log('OK')
  } catch (error) {
    console.error('FAIL:', error instanceof Error ? error.message : error)
  }
}

main().finally(() => prisma.$disconnect())
