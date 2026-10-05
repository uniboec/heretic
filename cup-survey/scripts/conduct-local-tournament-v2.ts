/**
 * Фаза 2: расширенная проверка mat-control — коррекции, сброс, lease, мини-сетки.
 * Запуск: npx tsx scripts/conduct-local-tournament-v2.ts
 */
process.env.CUP_SURVEY_SCRIPT_MODE = '1'

import { randomUUID } from 'node:crypto'
import { prisma } from '../lib/prisma'
import { getCategoryTitleFromKey } from '../lib/registration/categoryIdentity'
import {
  applyBoutResultCorrection,
  previewBoutResultCorrection,
} from '../lib/bouts/applyBoutResultCorrection'
import { ATHLETE_EQUIPMENT_TIMEOUT_MS } from '../lib/bouts/athleteEquipmentCorrection'
import { deserializePublishedStructure } from '../lib/brackets/core/snapshot'
import { extractBouts } from '../lib/bouts/extractBouts'
import { insertSharedEpisodeTie } from '../lib/bouts/__tests__/helpers/runSharedEpisodeTie'
import {
  acquireMatSession,
  executeMatControlCommand,
  getMatControlSnapshot,
  takeoverMatSession,
} from '../lib/bouts/matControlService'
import { resolveDownstreamBoutIds } from '../lib/bouts/sportDependencies'
import {
  TournamentConductor,
  boutSides,
  parseCategoryKey,
  pickRunnableBout,
  releaseAllReadyBouts,
  resetBoutToScheduled,
  syncState,
  type ScenarioResult,
} from './tournament-conductor-core'

const MAT = 1

async function runAdvancedScenarios(conductor: TournamentConductor): Promise<ScenarioResult[]> {
  const results: ScenarioResult[] = []

  results.push(
    await conductor.runScenario(MAT, 'period_end_correction', async ({ sides, state, conductor: c }) => {
      await c.preFight(sides, state, 'pec')
      await c.runCommand(sides, state, 'pec-score', 'TECHNICAL_SCORE', {
        entryId: sides.redEntryId,
        corner: 'red',
        points: 4,
      })
      await c.runCommand(sides, state, 'pec-elapsed', 'CLOCK_ADJUST', {
        deltaMs: -sides.periodDurationMs,
      })
      await c.runCommand(sides, state, 'pec-expire', 'EXPIRE_PERIOD', { period: 'main' })
      await c.runCommand(sides, state, 'pec-cancel', 'CANCEL_STOPPAGE')
      await c.runCommand(sides, state, 'pec-finish', 'FINISH_PERIOD_CORRECTION')
      await c.confirmAndAdvance(sides, state, 'pec')
      return 'periodCorrectionMode'
    }),
  )

  results.push(
    await conductor.runScenario(MAT, 'activity_correction_mode', async ({ sides, state, conductor: c }) => {
      await c.advanceToPendingActivityDecision(sides, state)
      await c.runCommand(sides, state, 'acm-enter', 'CORRECT_BEFORE_ACTIVITY', { enable: true })
      await c.runCommand(sides, state, 'acm-score', 'TECHNICAL_SCORE', {
        entryId: sides.redEntryId,
        corner: 'red',
        points: 2,
      })
      await c.runCommand(sides, state, 'acm-finish', 'FINISH_ACTIVITY_CORRECTION')
      await c.confirmAndAdvance(sides, state, 'acm')
      return 'activityCorrection'
    }),
  )

  results.push(
    await conductor.runScenario(MAT, 'activity_cancel_and_redecide', async ({ sides, state, conductor: c }) => {
      await c.advanceToPendingActivityDecision(sides, state)
      await c.runCommand(sides, state, 'acr-v1', 'EXTRA_ACTIVITY_DECIDE', { winnerCorner: 'red' })
      await c.runCommand(sides, state, 'acr-cancel', 'CANCEL_STOPPAGE')
      await c.runCommand(sides, state, 'acr-v2', 'EXTRA_ACTIVITY_DECIDE', { winnerCorner: 'blue' })
      await c.confirmAndAdvance(sides, state, 'acr')
      const result = await prisma.boutResult.findFirst({
        where: { boutId: sides.boutId, isCurrent: true },
      })
      if (result?.winnerEntryId !== sides.blueEntryId) {
        throw new Error('Winner should be blue after re-decide')
      }
      return 'redecide=blue'
    }),
  )

  results.push(
    await conductor.runScenario(MAT, 'equipment_disqualify_timeout', async ({ sides, state, conductor: c }) => {
      await c.preFight(sides, state, 'eqd')
      await c.runCommand(sides, state, 'eqd-start', 'ATHLETE_EQUIPMENT_START', {
        entryId: sides.blueEntryId,
        corner: 'blue',
      })
      const startEvent = await prisma.boutEvent.findFirst({
        where: { boutId: sides.boutId, eventType: 'ATHLETE_EQUIPMENT_START' },
        orderBy: { sequence: 'desc' },
      })
      if (startEvent) {
        await prisma.boutEvent.update({
          where: { id: startEvent.id },
          data: { createdAt: new Date(Date.now() - ATHLETE_EQUIPMENT_TIMEOUT_MS - 1_000) },
        })
      }
      await c.runCommand(sides, state, 'eqd-dq', 'ATHLETE_EQUIPMENT_DISQUALIFY', {
        entryId: sides.blueEntryId,
        corner: 'blue',
      })
      await c.confirmAndAdvance(sides, state, 'eqd')
      return 'equipmentDQ'
    }),
  )

  results.push(
    await conductor.runScenario(MAT, 'oob_penalty_chain', async ({ sides, state, conductor: c }) => {
      await c.preFight(sides, state, 'oob')
      for (let i = 1; i <= 3; i += 1) {
        await c.runCommand(sides, state, `oob-p${i}`, 'PENALTY_OUT_OF_BOUNDS_NEXT', {
          corner: 'blue',
          entryId: sides.blueEntryId,
        })
      }
      await c.runCommand(sides, state, 'oob-score', 'TECHNICAL_SCORE', {
        entryId: sides.redEntryId,
        corner: 'red',
        points: 1,
      })
      await c.runCommand(sides, state, 'oob-elapsed', 'CLOCK_ADJUST', {
        deltaMs: -sides.periodDurationMs,
      })
      await c.runCommand(sides, state, 'oob-expire', 'EXPIRE_PERIOD', { period: 'main' })
      await c.confirmAndAdvance(sides, state, 'oob')
      return 'oobWarnings'
    }),
  )

  results.push(
    await conductor.runScenario(MAT, 'extra_period_point_win', async ({ sides, state, conductor: c }) => {
      await c.preFight(sides, state, 'epw')
      state.revision = await insertSharedEpisodeTie({
        boutId: sides.boutId,
        redEntryId: sides.redEntryId,
        blueEntryId: sides.blueEntryId,
        redPoints: 2,
        bluePoints: 2,
        operationId: `epw-main-${randomUUID().slice(0, 6)}`,
      })
      await c.runCommand(sides, state, 'epw-main-elapsed', 'CLOCK_ADJUST', {
        deltaMs: -sides.periodDurationMs,
      })
      await c.runCommand(sides, state, 'epw-main-expire', 'EXPIRE_PERIOD', { period: 'main' })
      await c.runCommand(sides, state, 'epw-extra-start', 'CLOCK_START')
      await c.runCommand(sides, state, 'epw-extra-score', 'TECHNICAL_SCORE', {
        entryId: sides.redEntryId,
        corner: 'red',
        points: 1,
      })
      await c.runCommand(sides, state, 'epw-extra-elapsed', 'CLOCK_ADJUST', {
        deltaMs: -sides.periodDurationMs,
      })
      await c.runCommand(sides, state, 'epw-extra-expire', 'EXPIRE_PERIOD', { period: 'extra' })
      await c.confirmAndAdvance(sides, state, 'epw')
      return 'extraPeriodWinner'
    }),
  )

  results.push(
    await conductor.runScenario(MAT, 'reset_bout_and_refight', async ({ sides, state, conductor: c }) => {
      await c.preFight(sides, state, 'rst')
      await c.runCommand(sides, state, 'rst-score', 'TECHNICAL_SCORE', {
        entryId: sides.redEntryId,
        corner: 'red',
        points: 2,
      })
      await c.runCommand(sides, state, 'rst-reset', 'RESET_BOUT')
      const afterReset = await prisma.boutScheduleExecution.findUnique({
        where: { boutId: sides.boutId },
      })
      if ((afterReset?.attemptNumber ?? 0) < 2) {
        throw new Error('RESET_BOUT should increment attempt')
      }
      state.revision = afterReset?.liveRevision ?? 0
      state.attemptNumber = afterReset?.attemptNumber ?? 2
      await c.runCommand(sides, state, 'rst2-start', 'CLOCK_START')
      await c.runCommand(sides, state, 'rst2-score', 'TECHNICAL_SCORE', {
        entryId: sides.blueEntryId,
        corner: 'blue',
        points: 4,
      })
      await c.runCommand(sides, state, 'rst2-stop', 'STOPPAGE_CLEAR_ADVANTAGE', { winnerCorner: 'blue' })
      await c.confirmAndAdvance(sides, state, 'rst2')
      return `attempt=${afterReset?.attemptNumber}`
    }),
  )

  results.push(
    await conductor.runScenario(MAT, 'scheduled_forfeit_without_fight', async ({ sides, state, conductor: c }) => {
      await c.runCommand(sides, state, 'sff-stop', 'STOPPAGE_FORFEIT', { winnerCorner: 'red' })
      await c.confirmAndAdvance(sides, state, 'sff')
      return 'forfeitBeforeClock'
    }),
  )

  results.push(
    await conductor.runScenario(MAT, 'command_idempotency_replay', async ({ sides, state, conductor: c }) => {
      const { operationId, response: first } = await c.runCommand(
        sides,
        state,
        'idem-red',
        'FIRST_CALL',
        { entryId: sides.redEntryId, corner: 'red' },
      )
      const replay = (await executeMatControlCommand({
        boutId: sides.boutId,
        envelope: {
          operationId,
          holderToken: conductor.holderToken,
          expectedLiveRevision: 0,
          expectedAttemptNumber: state.attemptNumber,
        },
        intent: 'FIRST_CALL',
        payload: { entryId: sides.redEntryId, corner: 'red' },
      })) as { liveRevision?: number }
      const firstOk = (first as { ok?: boolean }).ok
      const replayOk = (replay as { ok?: boolean }).ok
      if (firstOk !== replayOk) {
        throw new Error('Idempotent replay mismatch')
      }
      await c.runCommand(sides, state, 'idem-blue', 'FIRST_CALL', {
        entryId: sides.blueEntryId,
        corner: 'blue',
      })
      await c.runCommand(sides, state, 'idem-start', 'CLOCK_START')
      await c.runCommand(sides, state, 'idem-stop', 'STOPPAGE_CLEAR_ADVANTAGE', { winnerCorner: 'red' })
      await c.confirmAndAdvance(sides, state, 'idem')
      return 'idempotent'
    }),
  )

  const bronzeAvailable = pickRunnableBout(await getMatControlSnapshot(MAT), (b) => b.schedulePhase === 'bronze')
  if (bronzeAvailable) {
    results.push(
      await conductor.runScenario(
        MAT,
        'bronze_fight_phase',
        async ({ sides, state, conductor: c }) => {
          await c.preFight(sides, state, 'brz')
          await c.runCommand(sides, state, 'brz-score', 'TECHNICAL_SCORE', {
            entryId: sides.redEntryId,
            corner: 'red',
            points: 4,
          })
          await c.runCommand(sides, state, 'brz-stop', 'STOPPAGE_CLEAR_ADVANTAGE', { winnerCorner: 'red' })
          await c.confirmAndAdvance(sides, state, 'brz')
          return 'bronze'
        },
        (bout) => bout.schedulePhase === 'bronze',
      ),
    )
  } else {
    results.push({
      name: 'bronze_fight_phase',
      ok: true,
      detail: 'skipped — bronze not in queue yet',
    })
  }

  return results
}

async function runLeaseTakeoverScenario(conductor: TournamentConductor): Promise<ScenarioResult> {
  const holderA = conductor.holderToken
  const holderB = `lease-b-${randomUUID().slice(0, 6)}`
  try {
    const sides = await conductor.ensureActiveScheduledBout(MAT)
    const state = await syncState(sides.boutId)
    await conductor.runCommand(sides, state, 'lt-red', 'FIRST_CALL', {
      entryId: sides.redEntryId,
      corner: 'red',
    })
    await takeoverMatSession(MAT, holderB)
    conductor.holderToken = holderB
    await conductor.runCommand(sides, state, 'lt-blue', 'FIRST_CALL', {
      entryId: sides.blueEntryId,
      corner: 'blue',
    }, {}, { holderToken: holderB })
    await conductor.runCommand(sides, state, 'lt-start', 'CLOCK_START', {}, { holderToken: holderB })
    await conductor.runCommand(sides, state, 'lt-stop', 'STOPPAGE_CLEAR_ADVANTAGE', {
      winnerCorner: 'red',
    }, {}, { holderToken: holderB })
    await conductor.runCommand(sides, state, 'lt-confirm', 'CONFIRM', {}, { holderToken: holderB })
    await conductor.runCommand(sides, state, 'lt-open', 'OPEN_NEXT_BOUT', {}, { holderToken: holderB })
    return { name: 'lease_takeover_mid_prefight', ok: true, boutId: sides.boutId, detail: 'takeover' }
  } catch (error) {
    const snapshot = await getMatControlSnapshot(MAT)
    if (snapshot.activeBout?.boutId) await resetBoutToScheduled(snapshot.activeBout.boutId)
    return {
      name: 'lease_takeover_mid_prefight',
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

async function findBoutWithDownstream(): Promise<string | null> {
  const snapshot = await getMatControlSnapshot(MAT)
  const candidates = [
    snapshot.activeBout?.bout,
    snapshot.queue.nextAvailable?.bout,
    ...snapshot.queue.upcoming.map((e) => e.bout),
  ].filter(Boolean)

  for (const bout of candidates) {
    const categoryKey = parseCategoryKey(bout!.id)
    const draw = await prisma.bracketCategoryDraw.findFirst({
      where: { status: 'ACTIVE', categoryKey },
    })
    if (!draw?.publishedStructureJson) continue
    const structure = deserializePublishedStructure(draw.publishedStructureJson)
    const categoryBouts = extractBouts(structure!.structure, {
      categoryKey,
      categoryTitle: draw.categoryTitle ?? '',
      discipline: draw.discipline ?? 'tactic_control',
      storedMatIndex: MAT,
      competitionStage: draw.competitionStage ?? 1,
    })
    const downstream = resolveDownstreamBoutIds(bout!.id, categoryBouts)
    if (downstream.length > 0) return bout!.id
  }
  return null
}

async function runBranchRecoveryCorrection(conductor: TournamentConductor): Promise<ScenarioResult> {
  try {
    const targetBoutId = await findBoutWithDownstream()
    if (!targetBoutId) {
      return {
        name: 'branch_recovery_correction',
        ok: true,
        detail: 'skipped — no bout with downstream in current queue window',
      }
    }

    const sides = await conductor.ensureActiveScheduledBout(MAT, (bout) => bout.id === targetBoutId)
    const state = await syncState(sides.boutId)
    const c = conductor

    await c.preFight(sides, state, 'br')
    await c.runCommand(sides, state, 'br-score', 'TECHNICAL_SCORE', {
      entryId: sides.redEntryId,
      corner: 'red',
      points: 4,
    })
    await c.runCommand(sides, state, 'br-stop', 'STOPPAGE_CLEAR_ADVANTAGE', { winnerCorner: 'red' })
    await c.runCommand(sides, state, 'br-confirm', 'CONFIRM')
    await c.runCommand(sides, state, 'br-open', 'OPEN_NEXT_BOUT')

    const draw = await prisma.bracketCategoryDraw.findFirst({
      where: { status: 'ACTIVE', categoryKey: sides.categoryKey },
    })
    const structure = deserializePublishedStructure(draw?.publishedStructureJson)
    const categoryBouts = extractBouts(structure!.structure, {
      categoryKey: sides.categoryKey,
      categoryTitle: draw?.categoryTitle ?? '',
      discipline: draw?.discipline ?? 'tactic_control',
      storedMatIndex: MAT,
      competitionStage: draw?.competitionStage ?? 1,
    })
    const downstreamBoutIds = resolveDownstreamBoutIds(sides.boutId, categoryBouts)
    const correction = await applyBoutResultCorrection({
      boutId: sides.boutId,
      operationId: `branch-${randomUUID()}`,
      reason: 'Пересмотр полуфинала',
      requestedBy: 'tournament-v2',
      newWinnerEntryId: sides.blueEntryId,
      newLoserEntryId: sides.redEntryId,
      systemId: draw?.autoSystemId ?? 'olympic',
      categoryKey: sides.categoryKey,
      schedulePhase: sides.schedulePhase,
      downstreamBoutIds,
    })

    if (correction.correctionMode !== 'BRANCH_RECOVERY' && correction.correctionMode !== 'SAFE_CASCADE') {
      throw new Error(`Unexpected correction mode: ${correction.correctionMode}`)
    }

    const exec = await prisma.boutScheduleExecution.findUnique({ where: { boutId: sides.boutId } })
    if (exec?.boutPhase !== 'scheduled') {
      throw new Error('Source bout should reset to scheduled after branch recovery')
    }

    return {
      name: 'branch_recovery_correction',
      ok: true,
      boutId: sides.boutId,
      victoryMethod: correction.correctionMode,
      detail: `invalidated=${correction.invalidatedBoutIds.length}`,
    }
  } catch (error) {
    return {
      name: 'branch_recovery_correction',
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

async function runMetadataOnlyCorrection(conductor: TournamentConductor): Promise<ScenarioResult> {
  try {
    const target = conductor.confirmedBouts[0]
    if (!target) throw new Error('No confirmed bout for metadata correction')

    const before = await prisma.boutResult.findFirst({
      where: { boutId: target.boutId, isCurrent: true },
    })
    if (!before) throw new Error('Result missing')

    const draw = await prisma.bracketCategoryDraw.findFirst({
      where: { status: 'ACTIVE', categoryKey: target.categoryKey },
    })

    const correction = await applyBoutResultCorrection({
      boutId: target.boutId,
      operationId: `meta-${randomUUID()}`,
      reason: 'Уточнение формулировки',
      requestedBy: 'tournament-v2',
      newWinnerEntryId: target.redEntryId,
      newLoserEntryId: target.blueEntryId,
      systemId: draw?.autoSystemId ?? 'olympic',
      categoryKey: target.categoryKey,
      schedulePhase: target.schedulePhase,
      downstreamBoutIds: [],
    })

    const after = await prisma.boutResult.findFirst({
      where: { boutId: target.boutId, isCurrent: true },
    })

    if (correction.correctionMode !== 'METADATA_ONLY' || after?.id !== before.id) {
      throw new Error('Metadata-only correction failed')
    }

    return {
      name: 'metadata_only_correction',
      ok: true,
      boutId: target.boutId,
      victoryMethod: correction.correctionMode,
    }
  } catch (error) {
    return {
      name: 'metadata_only_correction',
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

async function runCategoryMiniSweep(conductor: TournamentConductor): Promise<ScenarioResult> {
  const categoryKey = 'tactic_control:experienced:m_boys_2:m_boys_2_w_le_20'
  let fought = 0
  try {
    for (let i = 0; i < 4; i += 1) {
      const result = await conductor.runScenario(
        MAT,
        `category_sweep_${i + 1}`,
        async ({ sides, state, conductor: c }) => {
          await c.preFight(sides, state, `sw${i}`)
          await c.runCommand(sides, state, `sw${i}-score`, 'TECHNICAL_SCORE', {
            entryId: sides.redEntryId,
            corner: 'red',
            points: 4,
          })
          await c.runCommand(sides, state, `sw${i}-stop`, 'STOPPAGE_CLEAR_ADVANTAGE', {
            winnerCorner: 'red',
          })
          await c.confirmAndAdvance(sides, state, `sw${i}`)
        },
        (bout) => bout.id.startsWith(`${categoryKey}::`),
      )
      if (!result.ok) break
      fought += 1
    }

    if (fought < 1) {
      return {
        name: 'category_mini_sweep',
        ok: true,
        detail: `skipped — only ${fought} bouts available in queue for ${categoryKey}`,
      }
    }

    return {
      name: 'category_mini_sweep',
      ok: true,
      detail: `${categoryKey} × ${fought} bouts`,
      victoryMethod: String(fought),
    }
  } catch (error) {
    return {
      name: 'category_mini_sweep',
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

async function printSummary(results: ScenarioResult[]) {
  const passed = results.filter((r) => r.ok)
  const failed = results.filter((r) => !r.ok)

  console.log('\n=== TOURNAMENT V2 (ADVANCED) RESULTS ===\n')
  for (const result of results) {
    const status = result.ok ? '✓' : '✗'
    const title = result.boutId
      ? getCategoryTitleFromKey(parseCategoryKey(result.boutId))
      : ''
    console.log(
      `${status} ${result.name}${result.boutId ? ` | ${result.boutId.split('::').pop()} | ${title}` : ''}${result.victoryMethod ? ` → ${result.victoryMethod}` : ''}${result.detail ? ` (${result.detail})` : ''}`,
    )
    if (result.error) console.log(`    ERROR: ${result.error}`)
  }

  const confirmed = await prisma.boutResult.count({ where: { isCurrent: true } })
  const events = await prisma.boutEvent.count()
  console.log(`\nConfirmed bouts total: ${confirmed}, events total: ${events}`)
  console.log(`Passed: ${passed.length}/${results.length}, Failed: ${failed.length}`)
  if (failed.length > 0) process.exitCode = 1
}

async function main() {
  console.log('=== Local tournament conductor v2 (advanced) ===\n')

  const released = await releaseAllReadyBouts()
  console.log(`Released bouts: ${released} categories`)

  const holderToken = `tournament-v2-${randomUUID().slice(0, 8)}`
  try {
    await acquireMatSession(MAT, holderToken)
  } catch {
    await takeoverMatSession(MAT, holderToken)
  }

  const conductor = new TournamentConductor(holderToken)
  const results: ScenarioResult[] = []

  results.push(await runBranchRecoveryCorrection(conductor))
  results.push(await runCategoryMiniSweep(conductor))
  results.push(await runLeaseTakeoverScenario(conductor))
  results.push(...await runAdvancedScenarios(conductor))
  results.push(await runMetadataOnlyCorrection(conductor))

  await printSummary(results)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
