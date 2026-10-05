/** Shared helpers for local tournament conductor scripts. */
import { randomUUID } from 'node:crypto'
import { prisma } from '../lib/prisma'
import { resolveBoutDurationMinutes } from '../lib/bouts/boutDuration'
import { insertSharedEpisodeTie } from '../lib/bouts/__tests__/helpers/runSharedEpisodeTie'
import type { ControlIntent } from '../lib/bouts/mat-control/types'
import {
  executeMatControlCommand,
  getMatControlSnapshot,
} from '../lib/bouts/matControlService'
import { setCategoriesBoutsReleased } from '../lib/bouts/release'
import { createDefaultExecutionData } from '../lib/bouts/matControlMappers'
import type { InternalBout } from '../lib/bouts/types'

export type BoutSides = {
  boutId: string
  categoryKey: string
  redEntryId: string
  blueEntryId: string
  periodDurationMs: number
  schedulePhase: 'elimination' | 'bronze' | 'final' | 'round_robin'
}

export type ScenarioResult = {
  name: string
  ok: boolean
  boutId?: string
  error?: string
  victoryMethod?: string | null
  detail?: string
}

export type CommandState = { revision: number; attemptNumber: number }

export function parseCategoryKey(boutId: string): string {
  const parts = boutId.split('::')
  if (parts.length < 2) throw new Error(`Invalid bout id: ${boutId}`)
  return parts.slice(0, -1).join('::')
}

export function pickRunnableBout(
  snapshot: Awaited<ReturnType<typeof getMatControlSnapshot>>,
  filter?: (bout: InternalBout) => boolean,
): InternalBout | null {
  const candidates = [
    snapshot.activeBout?.bout,
    snapshot.queue.nextAvailable?.bout,
    ...snapshot.queue.upcoming.map((entry) => entry.bout),
  ].filter((bout): bout is InternalBout => Boolean(bout))

  return (
    candidates.find(
      (bout) =>
        bout.sideA.kind === 'athlete' &&
        bout.sideB.kind === 'athlete' &&
        (filter ? filter(bout) : true),
    ) ?? null
  )
}

export function boutSides(bout: InternalBout): BoutSides {
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

  return { boutId: bout.id, categoryKey, redEntryId, blueEntryId, periodDurationMs, schedulePhase }
}

export async function syncState(boutId: string): Promise<CommandState> {
  const execution = await prisma.boutScheduleExecution.findUnique({ where: { boutId } })
  return {
    revision: execution?.liveRevision ?? 0,
    attemptNumber: execution?.attemptNumber ?? 1,
  }
}

export async function releaseAllReadyBouts() {
  const generation = await prisma.bracketGeneration.findFirst({
    where: { status: 'ACTIVE', singletonKey: 'live' },
  })
  if (!generation) return 0

  const result = await setCategoriesBoutsReleased({
    scope: 'ready',
    released: true,
    expectedPublishedGenerationId: generation.id,
  })
  return result.affectedCategoryKeys?.length ?? 0
}

export async function resetBoutToScheduled(boutId: string) {
  const execution = await prisma.boutScheduleExecution.findUnique({ where: { boutId } })
  if (!execution || execution.boutPhase === 'confirmed') return

  const eventCount = await prisma.boutEvent.count({ where: { boutId } })
  if (eventCount === 0 && execution.boutPhase === 'scheduled') return

  await prisma.$transaction(async (tx) => {
    await tx.boutEvent.deleteMany({ where: { boutId } })
    await tx.boutScheduleExecution.update({
      where: { boutId },
      data: createDefaultExecutionData(boutId),
    })
  })
}

export class TournamentConductor {
  readonly confirmedBouts: BoutSides[] = []
  holderToken: string

  constructor(holderToken = `tournament-${randomUUID().slice(0, 8)}`) {
    this.holderToken = holderToken
  }

  async runCommand(
    sides: BoutSides,
    state: CommandState,
    operationPrefix: string,
    intent: ControlIntent,
    payload: Record<string, unknown> = {},
    options?: { operationId?: string; holderToken?: string },
  ) {
    const operationId = options?.operationId ?? `${operationPrefix}-${randomUUID().slice(0, 8)}`
    const response = (await executeMatControlCommand({
      boutId: sides.boutId,
      envelope: {
        operationId,
        holderToken: options?.holderToken ?? this.holderToken,
        expectedLiveRevision: state.revision,
        expectedAttemptNumber: state.attemptNumber,
      },
      intent,
      payload,
    })) as { liveRevision?: number }

    if (typeof response.liveRevision === 'number') {
      state.revision = response.liveRevision
    }
    return { operationId, response }
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

  async ensureActiveScheduledBout(
    matIndex: number,
    filter?: (bout: InternalBout) => boolean,
  ): Promise<BoutSides> {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const snapshot = await getMatControlSnapshot(matIndex)
      const active = snapshot.activeBout?.bout
      const activeRunnable =
        active &&
        active.sideA.kind === 'athlete' &&
        active.sideB.kind === 'athlete' &&
        (filter ? filter(active) : true)
          ? active
          : null
      const fallback = pickRunnableBout(snapshot, filter)
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

  async advanceToPendingActivityDecision(sides: BoutSides, state: CommandState) {
    await this.preFight(sides, state, 'act')
    state.revision = await insertSharedEpisodeTie({
      boutId: sides.boutId,
      redEntryId: sides.redEntryId,
      blueEntryId: sides.blueEntryId,
      redPoints: 2,
      bluePoints: 2,
      operationId: `act-main-${randomUUID().slice(0, 6)}`,
    })
    await this.runCommand(sides, state, 'act-main-elapsed', 'CLOCK_ADJUST', {
      deltaMs: -sides.periodDurationMs,
    })
    await this.runCommand(sides, state, 'act-main-expire', 'EXPIRE_PERIOD', { period: 'main' })
    await this.runCommand(sides, state, 'act-extra-start', 'CLOCK_START')
    state.revision = await insertSharedEpisodeTie({
      boutId: sides.boutId,
      redEntryId: sides.redEntryId,
      blueEntryId: sides.blueEntryId,
      redPoints: 2,
      bluePoints: 2,
      operationId: `act-extra-${randomUUID().slice(0, 6)}`,
    })
    await this.runCommand(sides, state, 'act-extra-elapsed', 'CLOCK_ADJUST', {
      deltaMs: -sides.periodDurationMs,
    })
    await this.runCommand(sides, state, 'act-extra-expire', 'EXPIRE_PERIOD', { period: 'extra' })
  }

  async runScenario(
    matIndex: number,
    name: string,
    steps: (ctx: {
      sides: BoutSides
      state: CommandState
      conductor: TournamentConductor
    }) => Promise<string | void>,
    filter?: (bout: InternalBout) => boolean,
  ): Promise<ScenarioResult> {
    try {
      const sides = await this.ensureActiveScheduledBout(matIndex, filter)
      const state = await syncState(sides.boutId)
      const detail = await steps({ sides, state, conductor: this })
      const result = await prisma.boutResult.findFirst({
        where: { boutId: sides.boutId, isCurrent: true },
      })
      return {
        name,
        ok: true,
        boutId: sides.boutId,
        victoryMethod: result?.victoryMethod ?? null,
        detail: detail ?? undefined,
      }
    } catch (error) {
      const snapshot = await getMatControlSnapshot(matIndex)
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
