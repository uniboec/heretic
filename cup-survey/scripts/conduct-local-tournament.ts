/**
 * Проведение локального турнира с максимальным охватом механик mat-control.
 * Запуск: npx tsx scripts/conduct-local-tournament.ts
 */
process.env.CUP_SURVEY_SCRIPT_MODE = '1'

import { randomUUID } from 'node:crypto'
import { prisma } from '../lib/prisma'
import { getCategoryTitleFromKey } from '../lib/registration/categoryIdentity'
import {
  applyBoutResultCorrection,
  previewBoutResultCorrection,
} from '../lib/bouts/applyBoutResultCorrection'
import { ATHLETE_DOCTOR_REMOVAL_MS } from '../lib/bouts/athleteDoctorVisit'
import { resolveBoutDurationMinutes } from '../lib/bouts/boutDuration'
import { deserializePublishedStructure } from '../lib/brackets/core/snapshot'
import { extractBouts } from '../lib/bouts/extractBouts'
import { insertSharedEpisodeTie } from '../lib/bouts/__tests__/helpers/runSharedEpisodeTie'
import type { ControlIntent } from '../lib/bouts/mat-control/types'
import {
  acquireMatSession,
  executeMatControlCommand,
  getMatControlSnapshot,
  takeoverMatSession,
} from '../lib/bouts/matControlService'
import { setCategoriesBoutsReleased } from '../lib/bouts/release'
import { postponeBoutOnMat } from '../lib/bouts/postponeBout'
import { resolveDownstreamBoutIds } from '../lib/bouts/sportDependencies'
import { createDefaultExecutionData } from '../lib/bouts/matControlMappers'
import { PASSIVITY_PENALTY_INTERVAL_MS } from '../lib/bouts/passivityPenalties'
import type { InternalBout } from '../lib/bouts/types'

const MAT_INDEX = 1
const HOLDER_TOKEN = `tournament-${randomUUID().slice(0, 8)}`

type BoutSides = {
  boutId: string
  categoryKey: string
  redEntryId: string
  blueEntryId: string
  periodDurationMs: number
  schedulePhase: 'elimination' | 'bronze' | 'final' | 'round_robin'
}

type ScenarioResult = {
  name: string
  ok: boolean
  boutId?: string
  error?: string
  victoryMethod?: string | null
}

type CommandState = { revision: number; attemptNumber: number }

function parseCategoryKey(boutId: string): string {
  const parts = boutId.split('::')
  if (parts.length < 2) throw new Error(`Invalid bout id: ${boutId}`)
  return parts.slice(0, -1).join('::')
}

function pickRunnableBout(snapshot: Awaited<ReturnType<typeof getMatControlSnapshot>>): InternalBout | null {
  const candidates = [
    snapshot.activeBout?.bout,
    snapshot.queue.nextAvailable?.bout,
    ...snapshot.queue.upcoming.map((entry) => entry.bout),
  ].filter((bout): bout is InternalBout => Boolean(bout))

  return (
    candidates.find((bout) => bout.sideA.kind === 'athlete' && bout.sideB.kind === 'athlete') ?? null
  )
}

function boutSides(bout: InternalBout): BoutSides {
  const redEntryId = bout.sideA.kind === 'athlete' ? bout.sideA.entryId : bout.sideB.entryId
  const blueEntryId = bout.sideB.kind === 'athlete' ? bout.sideB.entryId : bout.sideA.entryId
  if (!redEntryId || !blueEntryId) throw new Error(`Participants missing for ${bout.id}`)

  const categoryKey = parseCategoryKey(bout.id)
  const periodDurationMs = resolveBoutDurationMinutes({ categoryKey, overrides: {} }) * 60_000
  const schedulePhase =
    bout.schedulePhase === 'bronze' ||
    bout.schedulePhase === 'final' ||
    bout.schedulePhase === 'round_robin'
      ? bout.schedulePhase
      : 'elimination'

  return {
    boutId: bout.id,
    categoryKey,
    redEntryId,
    blueEntryId,
    periodDurationMs,
    schedulePhase,
  }
}

async function syncState(boutId: string): Promise<CommandState> {
  const execution = await prisma.boutScheduleExecution.findUnique({ where: { boutId } })
  return {
    revision: execution?.liveRevision ?? 0,
    attemptNumber: execution?.attemptNumber ?? 1,
  }
}

class TournamentConductor {
  readonly confirmedBouts: BoutSides[] = []

  async runCommand(
    sides: BoutSides,
    state: CommandState,
    operationPrefix: string,
    intent: ControlIntent,
    payload: Record<string, unknown> = {},
  ) {
    const operationId = `${operationPrefix}-${randomUUID().slice(0, 8)}`
    const response = (await executeMatControlCommand({
      boutId: sides.boutId,
      envelope: {
        operationId,
        holderToken: HOLDER_TOKEN,
        expectedLiveRevision: state.revision,
        expectedAttemptNumber: state.attemptNumber,
      },
      intent,
      payload,
    })) as { liveRevision?: number }

    if (typeof response.liveRevision === 'number') {
      state.revision = response.liveRevision
    }
  }

  async preFight(sides: BoutSides, state: CommandState, label: string) {
    await this.runCommand(sides, state, `${label}-red`, 'FIRST_CALL', {
      entryId: sides.redEntryId,
      corner: 'red',
    })
    await this.runCommand(sides, state, `${label}-blue`, 'FIRST_CALL', {
      entryId: sides.blueEntryId,
      corner: 'blue',
    })
    await this.runCommand(sides, state, `${label}-start`, 'CLOCK_START')
  }

  async confirmAndAdvance(sides: BoutSides, state: CommandState, label: string) {
    await this.runCommand(sides, state, `${label}-confirm`, 'CONFIRM')
    const result = await prisma.boutResult.findFirst({
      where: { boutId: sides.boutId, isCurrent: true },
    })
    this.confirmedBouts.push(sides)
    await this.runCommand(sides, state, `${label}-open-next`, 'OPEN_NEXT_BOUT')
    return result
  }

  async ensureActiveScheduledBout(): Promise<BoutSides> {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const snapshot = await getMatControlSnapshot(MAT_INDEX)
      const active = snapshot.activeBout?.bout
      const activeRunnable =
        active && active.sideA.kind === 'athlete' && active.sideB.kind === 'athlete' ? active : null
      const fallback = pickRunnableBout(snapshot)
      const bout = activeRunnable ?? fallback
      if (!bout) throw new Error('No runnable bout in mat queue')

      const phase = snapshot.activeBout?.execution.boutPhase ?? 'scheduled'
      if (phase === 'confirmed') {
        const sides = boutSides(bout)
        const state = await syncState(sides.boutId)
        await this.runCommand(sides, state, 'auto-open', 'OPEN_NEXT_BOUT')
        continue
      }

      if (active && active.id !== bout.id) {
        const sides = boutSides(active)
        const state = await syncState(sides.boutId)
        await this.runCommand(sides, state, 'auto-skip', 'OPEN_NEXT_BOUT')
        continue
      }

      if (phase !== 'scheduled') {
        await resetBoutToScheduled(bout.id)
      }

      return boutSides(bout)
    }

    throw new Error('Failed to acquire runnable scheduled bout')
  }

  async runScenario(
    name: string,
    steps: (ctx: {
      sides: BoutSides
      state: CommandState
      conductor: TournamentConductor
    }) => Promise<void>,
  ): Promise<ScenarioResult> {
    try {
      const sides = await this.ensureActiveScheduledBout()
      const state = await syncState(sides.boutId)
      await steps({ sides, state, conductor: this })
      const result = await prisma.boutResult.findFirst({
        where: { boutId: sides.boutId, isCurrent: true },
      })
      return {
        name,
        ok: true,
        boutId: sides.boutId,
        victoryMethod: result?.victoryMethod ?? null,
      }
    } catch (error) {
      const snapshot = await getMatControlSnapshot(MAT_INDEX)
      if (snapshot.activeBout?.boutId) {
        await resetBoutToScheduled(snapshot.activeBout.boutId)
      }
      return {
        name,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }
}

async function releaseAllReadyBouts() {
  const generation = await prisma.bracketGeneration.findFirst({
    where: { status: 'ACTIVE', singletonKey: 'live' },
  })
  if (!generation) return

  const result = await setCategoriesBoutsReleased({
    scope: 'ready',
    released: true,
    expectedPublishedGenerationId: generation.id,
  })
  console.log(`Released bouts: ${result.affectedCategoryKeys?.length ?? 0} categories`)
}

async function resetBoutToScheduled(boutId: string) {
  const execution = await prisma.boutScheduleExecution.findUnique({ where: { boutId } })
  if (!execution || execution.boutPhase === 'confirmed') return

  const eventCount = await prisma.boutEvent.count({ where: { boutId } })
  if (eventCount === 0 && execution.boutPhase === 'scheduled') return

  await prisma.$transaction(async (tx) => {
    await tx.boutEvent.deleteMany({ where: { boutId } })
    await tx.boutScheduleExecution.update({
      where: { boutId },
      data: {
        ...createDefaultExecutionData(boutId),
        liveSnapshot: null,
        actualStartAt: null,
        actualEndAt: null,
        officialStartedAt: null,
        officialEndedAt: null,
        mainEndedAt: null,
        extraEndedAt: null,
        clockStartedAt: null,
      },
    })
  })
}

async function resetActiveBoutIfDirty() {
  const snapshot = await getMatControlSnapshot(MAT_INDEX)
  const active = snapshot.activeBout
  if (!active) return

  await resetBoutToScheduled(active.boutId)
  if (active.execution.boutPhase !== 'scheduled') {
    console.log(`Reset dirty active bout: ${active.boutId.split('::').pop()}`)
  }
}

async function runScenarios(conductor: TournamentConductor): Promise<ScenarioResult[]> {
  const results: ScenarioResult[] = []

  results.push(
    await conductor.runScenario('clear_advantage', async ({ sides, state, conductor: c }) => {
      await c.preFight(sides, state, 'ca')
      await c.runCommand(sides, state, 'ca-score', 'TECHNICAL_SCORE', {
        entryId: sides.redEntryId,
        corner: 'red',
        points: 4,
      })
      await c.runCommand(sides, state, 'ca-stop', 'STOPPAGE_CLEAR_ADVANTAGE', { winnerCorner: 'red' })
      await c.confirmAndAdvance(sides, state, 'ca')
    }),
  )

  results.push(
    await conductor.runScenario('submission_arm', async ({ sides, state, conductor: c }) => {
      await c.preFight(sides, state, 'sub')
      await c.runCommand(sides, state, 'sub-stop', 'STOPPAGE_SUBMISSION', {
        winnerCorner: 'blue',
        submissionSubtype: 'ARM',
      })
      await c.confirmAndAdvance(sides, state, 'sub')
    }),
  )

  results.push(
    await conductor.runScenario('submission_choke', async ({ sides, state, conductor: c }) => {
      await c.preFight(sides, state, 'choke')
      await c.runCommand(sides, state, 'choke-stop', 'STOPPAGE_CHOKE', { winnerCorner: 'red' })
      await c.confirmAndAdvance(sides, state, 'choke')
    }),
  )

  results.push(
    await conductor.runScenario('forfeit', async ({ sides, state, conductor: c }) => {
      await c.preFight(sides, state, 'ff')
      await c.runCommand(sides, state, 'ff-stop', 'STOPPAGE_FORFEIT', { winnerCorner: 'blue' })
      await c.confirmAndAdvance(sides, state, 'ff')
    }),
  )

  results.push(
    await conductor.runScenario('injury_stoppage', async ({ sides, state, conductor: c }) => {
      await c.preFight(sides, state, 'inj')
      await c.runCommand(sides, state, 'inj-stop', 'STOPPAGE_INJURY', { winnerCorner: 'red' })
      await c.confirmAndAdvance(sides, state, 'inj')
    }),
  )

  results.push(
    await conductor.runScenario('points_after_main_time', async ({ sides, state, conductor: c }) => {
      await c.preFight(sides, state, 'pts')
      await c.runCommand(sides, state, 'pts-score', 'TECHNICAL_SCORE', {
        entryId: sides.redEntryId,
        corner: 'red',
        points: 4,
      })
      await c.runCommand(sides, state, 'pts-elapsed', 'CLOCK_ADJUST', {
        deltaMs: -sides.periodDurationMs,
      })
      await c.runCommand(sides, state, 'pts-expire', 'EXPIRE_PERIOD', { period: 'main' })
      await c.confirmAndAdvance(sides, state, 'pts')
    }),
  )

  results.push(
    await conductor.runScenario('tie_break_activity', async ({ sides, state, conductor: c }) => {
      await c.preFight(sides, state, 'tb')
      state.revision = await insertSharedEpisodeTie({
        boutId: sides.boutId,
        redEntryId: sides.redEntryId,
        blueEntryId: sides.blueEntryId,
        redPoints: 2,
        bluePoints: 2,
        operationId: 'tb-main',
      })
      await c.runCommand(sides, state, 'tb-main-elapsed', 'CLOCK_ADJUST', {
        deltaMs: -sides.periodDurationMs,
      })
      await c.runCommand(sides, state, 'tb-main-expire', 'EXPIRE_PERIOD', { period: 'main' })
      await c.runCommand(sides, state, 'tb-extra-start', 'CLOCK_START')
      state.revision = await insertSharedEpisodeTie({
        boutId: sides.boutId,
        redEntryId: sides.redEntryId,
        blueEntryId: sides.blueEntryId,
        redPoints: 2,
        bluePoints: 2,
        operationId: 'tb-extra',
      })
      await c.runCommand(sides, state, 'tb-extra-elapsed', 'CLOCK_ADJUST', {
        deltaMs: -sides.periodDurationMs,
      })
      await c.runCommand(sides, state, 'tb-extra-expire', 'EXPIRE_PERIOD', { period: 'extra' })
      await c.runCommand(sides, state, 'tb-decide', 'EXTRA_ACTIVITY_DECIDE', { winnerCorner: 'blue' })
      await c.confirmAndAdvance(sides, state, 'tb')
    }),
  )

  results.push(
    await conductor.runScenario('disqualification_general', async ({ sides, state, conductor: c }) => {
      await c.preFight(sides, state, 'dq')
      await c.runCommand(sides, state, 'dq-pen', 'PENALTY_DISQUALIFY', {
        corner: 'red',
        entryId: sides.redEntryId,
        ladder: 'GENERAL',
      })
      await c.confirmAndAdvance(sides, state, 'dq')
    }),
  )

  results.push(
    await conductor.runScenario('disqualification_out_of_bounds', async ({ sides, state, conductor: c }) => {
      await c.preFight(sides, state, 'oob')
      await c.runCommand(sides, state, 'oob-dq', 'PENALTY_DISQUALIFY', {
        corner: 'blue',
        entryId: sides.blueEntryId,
        ladder: 'OUT_OF_BOUNDS',
      })
      await c.confirmAndAdvance(sides, state, 'oob')
    }),
  )

  results.push(
    await conductor.runScenario('penalty_warnings_chain', async ({ sides, state, conductor: c }) => {
      await c.preFight(sides, state, 'pen')
      for (let i = 1; i <= 3; i += 1) {
        await c.runCommand(sides, state, `pen-w${i}`, 'PENALTY_GENERAL_NEXT', {
          corner: 'blue',
          entryId: sides.blueEntryId,
        })
      }
      await c.runCommand(sides, state, 'pen-score', 'TECHNICAL_SCORE', {
        entryId: sides.redEntryId,
        corner: 'red',
        points: 1,
      })
      await c.runCommand(sides, state, 'pen-elapsed', 'CLOCK_ADJUST', {
        deltaMs: -sides.periodDurationMs,
      })
      await c.runCommand(sides, state, 'pen-expire', 'EXPIRE_PERIOD', { period: 'main' })
      await c.confirmAndAdvance(sides, state, 'pen')
    }),
  )

  results.push(
    await conductor.runScenario('passivity_cycle', async ({ sides, state, conductor: c }) => {
      await c.preFight(sides, state, 'pas')
      await c.runCommand(sides, state, 'pas-start', 'PASSIVITY_START', {
        corner: 'blue',
        entryId: sides.blueEntryId,
      })
      await c.runCommand(sides, state, 'pas-elapsed', 'CLOCK_ADJUST', {
        deltaMs: PASSIVITY_PENALTY_INTERVAL_MS + 1_000,
      })
      await c.runCommand(sides, state, 'pas-apply', 'PASSIVITY_APPLY_DUE_PENALTIES', {
        corner: 'blue',
        entryId: sides.blueEntryId,
      })
      await c.runCommand(sides, state, 'pas-end', 'PASSIVITY_END', {
        corner: 'blue',
        entryId: sides.blueEntryId,
      })
      await c.runCommand(sides, state, 'pas-score', 'TECHNICAL_SCORE', {
        entryId: sides.redEntryId,
        corner: 'red',
        points: 2,
      })
      await c.runCommand(sides, state, 'pas-stop', 'STOPPAGE_CLEAR_ADVANTAGE', { winnerCorner: 'red' })
      await c.confirmAndAdvance(sides, state, 'pas')
    }),
  )

  results.push(
    await conductor.runScenario('athlete_wait', async ({ sides, state, conductor: c }) => {
      await c.runCommand(sides, state, 'wait-red', 'FIRST_CALL', {
        entryId: sides.redEntryId,
        corner: 'red',
      })
      await c.runCommand(sides, state, 'wait-start', 'ATHLETE_WAIT_START', {
        entryId: sides.blueEntryId,
        corner: 'blue',
      })
      await c.runCommand(sides, state, 'wait-end', 'ATHLETE_WAIT_END', {
        entryId: sides.blueEntryId,
        corner: 'blue',
      })
      await c.runCommand(sides, state, 'wait-blue', 'FIRST_CALL', {
        entryId: sides.blueEntryId,
        corner: 'blue',
      })
      await c.runCommand(sides, state, 'wait-clock', 'CLOCK_START')
      await c.runCommand(sides, state, 'wait-score', 'TECHNICAL_SCORE', {
        entryId: sides.blueEntryId,
        corner: 'blue',
        points: 4,
      })
      await c.runCommand(sides, state, 'wait-stop', 'STOPPAGE_CLEAR_ADVANTAGE', { winnerCorner: 'blue' })
      await c.confirmAndAdvance(sides, state, 'wait')
    }),
  )

  results.push(
    await conductor.runScenario('doctor_removal', async ({ sides, state, conductor: c }) => {
      await c.preFight(sides, state, 'doc')
      await c.runCommand(sides, state, 'doc-start', 'ATHLETE_DOCTOR_START', {
        entryId: sides.redEntryId,
        corner: 'red',
      })
      const doctorStart = await prisma.boutEvent.findFirst({
        where: { boutId: sides.boutId, eventType: 'ATHLETE_DOCTOR_START' },
        orderBy: { sequence: 'desc' },
      })
      if (doctorStart) {
        await prisma.boutEvent.update({
          where: { id: doctorStart.id },
          data: { createdAt: new Date(Date.now() - ATHLETE_DOCTOR_REMOVAL_MS - 1_000) },
        })
      }
      await c.runCommand(sides, state, 'doc-removal', 'ATHLETE_DOCTOR_REMOVAL', {
        entryId: sides.redEntryId,
        corner: 'red',
      })
      await c.confirmAndAdvance(sides, state, 'doc')
    }),
  )

  results.push(
    await conductor.runScenario('equipment_correction', async ({ sides, state, conductor: c }) => {
      await c.preFight(sides, state, 'eq')
      await c.runCommand(sides, state, 'eq-start', 'ATHLETE_EQUIPMENT_START', {
        entryId: sides.blueEntryId,
        corner: 'blue',
      })
      await c.runCommand(sides, state, 'eq-end', 'ATHLETE_EQUIPMENT_END', {
        entryId: sides.blueEntryId,
        corner: 'blue',
      })
      await c.runCommand(sides, state, 'eq-score', 'TECHNICAL_SCORE', {
        entryId: sides.redEntryId,
        corner: 'red',
        points: 4,
      })
      await c.runCommand(sides, state, 'eq-stop', 'STOPPAGE_CLEAR_ADVANTAGE', { winnerCorner: 'red' })
      await c.confirmAndAdvance(sides, state, 'eq')
    }),
  )

  results.push(
    await conductor.runScenario('no_show', async ({ sides, state, conductor: c }) => {
      await c.runCommand(sides, state, 'ns-red', 'FIRST_CALL', {
        entryId: sides.redEntryId,
        corner: 'red',
      })
      await c.runCommand(sides, state, 'ns-blue', 'FIRST_CALL', {
        entryId: sides.blueEntryId,
        corner: 'blue',
      })
      await c.runCommand(sides, state, 'ns-sec', 'SECONDARY_CALL', {
        entryId: sides.redEntryId,
        corner: 'red',
      })
      const secondary = await prisma.boutEvent.findFirst({
        where: { boutId: sides.boutId, eventType: 'SECONDARY_CALL' },
        orderBy: { sequence: 'desc' },
      })
      if (secondary) {
        await prisma.boutEvent.update({
          where: { id: secondary.id },
          data: { createdAt: new Date(Date.now() - 121_000) },
        })
      }
      await c.runCommand(sides, state, 'ns-show', 'NO_SHOW', {
        entryId: sides.redEntryId,
        corner: 'red',
      })
      await c.confirmAndAdvance(sides, state, 'ns')
    }),
  )

  results.push(
    await conductor.runScenario('adjudication_score', async ({ sides, state, conductor: c }) => {
      await c.preFight(sides, state, 'adj')
      await c.runCommand(sides, state, 'adj-score', 'ADJUDICATION_SCORE', {
        entryId: sides.blueEntryId,
        corner: 'blue',
        points: 1,
      })
      await c.runCommand(sides, state, 'adj-elapsed', 'CLOCK_ADJUST', {
        deltaMs: -sides.periodDurationMs,
      })
      await c.runCommand(sides, state, 'adj-expire', 'EXPIRE_PERIOD', { period: 'main' })
      await c.confirmAndAdvance(sides, state, 'adj')
    }),
  )

  results.push(
    await conductor.runScenario('corner_swap_and_undo', async ({ sides, state, conductor: c }) => {
      await c.runCommand(sides, state, 'cu-swap', 'CORNER_SWAP')
      await c.runCommand(sides, state, 'cu-red', 'FIRST_CALL', {
        entryId: sides.blueEntryId,
        corner: 'red',
      })
      await c.runCommand(sides, state, 'cu-blue', 'FIRST_CALL', {
        entryId: sides.redEntryId,
        corner: 'blue',
      })
      await c.runCommand(sides, state, 'cu-start', 'CLOCK_START')
      await c.runCommand(sides, state, 'cu-score', 'TECHNICAL_SCORE', {
        entryId: sides.blueEntryId,
        corner: 'red',
        points: 2,
      })
      await c.runCommand(sides, state, 'cu-undo', 'UNDO')
      await c.runCommand(sides, state, 'cu-score2', 'TECHNICAL_SCORE', {
        entryId: sides.blueEntryId,
        corner: 'red',
        points: 4,
      })
      await c.runCommand(sides, state, 'cu-stop', 'STOPPAGE_CLEAR_ADVANTAGE', { winnerCorner: 'red' })
      await c.confirmAndAdvance(sides, state, 'cu')
    }),
  )

  results.push(
    await conductor.runScenario('cancel_stoppage_retry', async ({ sides, state, conductor: c }) => {
      await c.preFight(sides, state, 'cs')
      await c.runCommand(sides, state, 'cs-stop', 'STOPPAGE_SUBMISSION', {
        winnerCorner: 'red',
        submissionSubtype: 'ARM',
      })
      await c.runCommand(sides, state, 'cs-cancel', 'CANCEL_STOPPAGE')
      await c.runCommand(sides, state, 'cs-score', 'TECHNICAL_SCORE', {
        entryId: sides.blueEntryId,
        corner: 'blue',
        points: 4,
      })
      await c.runCommand(sides, state, 'cs-stop2', 'STOPPAGE_CLEAR_ADVANTAGE', { winnerCorner: 'blue' })
      await c.confirmAndAdvance(sides, state, 'cs')
    }),
  )

  results.push(
    await conductor.runScenario('clock_stop_resume', async ({ sides, state, conductor: c }) => {
      await c.preFight(sides, state, 'clk')
      await c.runCommand(sides, state, 'clk-stop', 'CLOCK_STOP')
      await c.runCommand(sides, state, 'clk-resume', 'CLOCK_START')
      await c.runCommand(sides, state, 'clk-score', 'TECHNICAL_SCORE', {
        entryId: sides.redEntryId,
        corner: 'red',
        points: 4,
      })
      await c.runCommand(sides, state, 'clk-final', 'STOPPAGE_CLEAR_ADVANTAGE', { winnerCorner: 'red' })
      await c.confirmAndAdvance(sides, state, 'clk')
    }),
  )

  return results
}

async function runPostponeScenario(): Promise<ScenarioResult> {
  try {
    const snapshot = await getMatControlSnapshot(MAT_INDEX)
    const categoryKey = 'tactic_control:experienced:m_boys_2:m_boys_2_w_le_20'
    const categoryBoutIds = snapshot.pendingMatBoutIds.filter((boutId) =>
      boutId.startsWith(`${categoryKey}::`),
    )
    if (categoryBoutIds.length < 2) {
      return { name: 'postpone_bout', ok: false, error: 'Not enough bouts in 6-7 TC category' }
    }

    if (categoryBoutIds.length < 2) {
      return { name: 'postpone_bout', ok: false, error: 'Category needs at least 2 bouts for postpone' }
    }
    const postponedId = categoryBoutIds[0]!
    const anchorId = categoryBoutIds[1]!
    const postponedExec = await prisma.boutScheduleExecution.findUnique({
      where: { boutId: postponedId },
    })
    const result = await postponeBoutOnMat({
      boutId: postponedId,
      postponeAfterBoutId: anchorId,
      holderToken: HOLDER_TOKEN,
      expectedLiveRevision: postponedExec?.liveRevision ?? 0,
      expectedAttemptNumber: postponedExec?.attemptNumber ?? 1,
    })

    const after = await getMatControlSnapshot(MAT_INDEX)
    const postponedIndex = after.pendingMatBoutIds.indexOf(postponedId)
    const anchorIndex = after.pendingMatBoutIds.indexOf(anchorId)

    if (!result.ok || postponedIndex <= anchorIndex) {
      return {
        name: 'postpone_bout',
        ok: false,
        error: `Postpone order wrong: anchor=${anchorIndex}, postponed=${postponedIndex}`,
      }
    }

    return { name: 'postpone_bout', ok: true, boutId: postponedId }
  } catch (error) {
    return {
      name: 'postpone_bout',
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

async function runCorrectionScenario(conductor: TournamentConductor): Promise<ScenarioResult> {
  try {
    const target = conductor.confirmedBouts[0]
    if (!target) {
      return { name: 'result_correction', ok: false, error: 'No confirmed bout to correct' }
    }

    const draw = await prisma.bracketCategoryDraw.findFirst({
      where: { status: 'ACTIVE', categoryKey: target.categoryKey },
    })
    if (!draw?.publishedStructureJson) {
      return { name: 'result_correction', ok: false, error: 'Published draw missing' }
    }

    const structure = deserializePublishedStructure(draw.publishedStructureJson)
    const categoryBouts = extractBouts(structure!.structure, {
      categoryKey: target.categoryKey,
      categoryTitle: draw.categoryTitle ?? '',
      discipline: draw.discipline ?? 'tactic_control',
      storedMatIndex: MAT_INDEX,
      competitionStage: draw.competitionStage ?? 1,
    })
    const downstreamBoutIds = resolveDownstreamBoutIds(target.boutId, categoryBouts)

    const preview = await previewBoutResultCorrection({
      boutId: target.boutId,
      newWinnerEntryId: target.blueEntryId,
      systemId: draw.autoSystemId ?? 'olympic',
      categoryKey: target.categoryKey,
      downstreamBoutIds,
    })
    if (preview.blocked) {
      return {
        name: 'result_correction',
        ok: false,
        error: `Correction blocked: ${preview.reason ?? 'unknown'}`,
      }
    }

    const correction = await applyBoutResultCorrection({
      boutId: target.boutId,
      operationId: `corr-${randomUUID()}`,
      reason: 'Локальный аудит: смена победителя',
      requestedBy: 'tournament-script',
      newWinnerEntryId: target.blueEntryId,
      newLoserEntryId: target.redEntryId,
      systemId: draw.autoSystemId ?? 'olympic',
      categoryKey: target.categoryKey,
      schedulePhase: target.schedulePhase,
      downstreamBoutIds,
    })

    const result = await prisma.boutResult.findFirst({
      where: { boutId: target.boutId, isCurrent: true },
    })

    return {
      name: 'result_correction',
      ok: result?.winnerEntryId === target.blueEntryId,
      boutId: target.boutId,
      victoryMethod: correction.correctionMode,
      error:
        result?.winnerEntryId === target.blueEntryId
          ? undefined
          : `Winner not updated: ${result?.winnerEntryId}`,
    }
  } catch (error) {
    return {
      name: 'result_correction',
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

async function printSummary(results: ScenarioResult[]) {
  const passed = results.filter((r) => r.ok)
  const failed = results.filter((r) => !r.ok)

  console.log('\n=== TOURNAMENT CONDUCTOR RESULTS ===\n')
  for (const result of results) {
    const status = result.ok ? '✓' : '✗'
    const title = result.boutId
      ? getCategoryTitleFromKey(parseCategoryKey(result.boutId))
      : ''
    console.log(
      `${status} ${result.name}${result.boutId ? ` | ${result.boutId.split('::').pop()} | ${title}` : ''}${result.victoryMethod ? ` → ${result.victoryMethod}` : ''}`,
    )
    if (result.error) console.log(`    ERROR: ${result.error}`)
  }

  const confirmed = await prisma.boutResult.count({ where: { isCurrent: true } })
  const events = await prisma.boutEvent.count()
  console.log(`\nConfirmed bouts: ${confirmed}, events: ${events}`)
  console.log(`Passed: ${passed.length}/${results.length}, Failed: ${failed.length}`)
  if (failed.length > 0) process.exitCode = 1
}

async function main() {
  console.log('=== Local tournament conductor ===\n')
  console.log(`Mat: ${MAT_INDEX}, holder: ${HOLDER_TOKEN}`)

  try {
    await acquireMatSession(MAT_INDEX, HOLDER_TOKEN)
  } catch {
    await takeoverMatSession(MAT_INDEX, HOLDER_TOKEN)
  }
  await releaseAllReadyBouts()
  const conductor = new TournamentConductor()
  await resetActiveBoutIfDirty()

  const scenarioResults: ScenarioResult[] = []
  scenarioResults.push(await runPostponeScenario())
  scenarioResults.push(...await runScenarios(conductor))
  scenarioResults.push(await runCorrectionScenario(conductor))

  await printSummary(scenarioResults)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
