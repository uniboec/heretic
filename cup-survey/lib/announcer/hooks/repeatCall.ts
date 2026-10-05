import { computeAuxiliaryTimers } from '@/lib/bouts/auxiliaryTimers'
import { buildParticipantContext } from '@/lib/bouts/matControlContext'
import { mapEventRow } from '@/lib/bouts/matControlMappers'
import type { Corner } from '@/lib/bouts/mat-control/types'
import { TOURNAMENT_SCOPE_ID } from '@/lib/config/tournament'
import { prisma } from '@/lib/prisma'
import { buildAnnouncementText } from '../text/buildText'
import { getRuleForType } from '../rules'
import { isAnnouncerEnabled } from '../settings'
import { expireEventData } from '../expireEvents'
import { BOUT_REPEAT_CALL_PRIORITY } from '../types'
import type { BoutCallPayload, BoutSidePayload } from '../types'
import { findBoutById } from './matHooks'

export const BOUT_REPEAT_INTERVAL_MS = 30_000
const REPEAT_EVENT_TTL_SECONDS = 45

function repeatBucket(nowMs: number, startedAtMs: number): number {
  return Math.floor((nowMs - startedAtMs) / BOUT_REPEAT_INTERVAL_MS)
}

function athleteSide(
  bout: NonNullable<Awaited<ReturnType<typeof findBoutById>>>,
  corner: Corner,
): BoutSidePayload | null {
  const side = corner === 'red' ? bout.sideA : bout.sideB
  if (side.kind !== 'athlete') return null
  return {
    corner,
    displayName: side.displayName,
    clubName: side.clubName,
    city: side.city,
  }
}

export async function enqueueBoutRepeatCall(input: {
  boutId: string
  matIndex: number
  corner: Corner
  entryId: string
  bucket: number
  scopeId?: string
}): Promise<void> {
  const scopeId = input.scopeId ?? TOURNAMENT_SCOPE_ID
  if (!(await isAnnouncerEnabled(scopeId))) return

  const settings = await prisma.announcerSetting.findUnique({
    where: { tournamentScopeId: scopeId },
  })
  if (!settings?.enabled) return

  const rule = await getRuleForType('BOUT_CALL', scopeId)
  if (!rule.enabled) return

  const dedupeKey = `BOUT_REPEAT:${input.boutId}:${input.entryId}:${input.bucket}`
  const existing = await prisma.announcerEvent.findUnique({
    where: { tournamentScopeId_dedupeKey: { tournamentScopeId: scopeId, dedupeKey } },
  })
  if (existing) return

  const bout = await findBoutById(input.boutId)
  if (!bout) return

  const sideA = athleteSide(bout, 'red')
  const sideB = athleteSide(bout, 'blue')
  const repeatSide = athleteSide(bout, input.corner)
  if (!sideA || !sideB || !repeatSide) return

  const basePayload = {
    boutId: input.boutId,
    matIndex: input.matIndex,
    categoryTitle: bout.categoryTitle,
    sideA,
    sideB,
    repeatCorner: input.corner,
    repeatSide,
    repeatEntryId: input.entryId,
  } satisfies BoutCallPayload

  const textSnapshot = buildAnnouncementText('BOUT_CALL', basePayload, rule)

  const created = await prisma.announcerEvent.createMany({
    data: [
      {
        tournamentScopeId: scopeId,
        type: 'BOUT_CALL',
        priority: BOUT_REPEAT_CALL_PRIORITY,
        sourceId: input.boutId,
        dedupeKey,
        payload: basePayload,
        textSnapshot,
        status: 'QUEUED',
        expiresAt: new Date(Date.now() + REPEAT_EVENT_TTL_SECONDS * 1000),
      },
    ],
    skipDuplicates: true,
  })
  if (created.count === 0) return

  const { kickAnnouncerWorker } = await import('../worker')
  kickAnnouncerWorker(scopeId)
}

function repeatTargetKey(boutId: string, entryId: string): string {
  return `${boutId}:${entryId}`
}

async function expireStaleRepeatCalls(
  scopeId: string,
  activeTargets: RepeatTarget[],
): Promise<void> {
  const activeKeys = new Set(
    activeTargets.map((target) => repeatTargetKey(target.boutId, target.entryId)),
  )

  const candidates = await prisma.announcerEvent.findMany({
    where: {
      tournamentScopeId: scopeId,
      type: 'BOUT_CALL',
      status: { in: ['QUEUED', 'READY', 'GENERATING', 'PLAYING'] },
    },
    select: { id: true, payload: true },
  })

  const staleIds = candidates
    .filter((row) => {
      const payload = row.payload as BoutCallPayload
      if (!payload.repeatCorner || !payload.repeatEntryId) return false
      return !activeKeys.has(repeatTargetKey(payload.boutId, payload.repeatEntryId))
    })
    .map((row) => row.id)

  if (staleIds.length === 0) return

  await prisma.announcerEvent.updateMany({
    where: { id: { in: staleIds } },
    data: expireEventData(),
  })
}

type RepeatTarget = {
  boutId: string
  matIndex: number
  corner: Corner
  entryId: string
  startedAtMs: number
}

async function listActiveRepeatTargets(scopeId: string): Promise<RepeatTarget[]> {
  const settings = await prisma.boutsPageSetting.findUnique({ where: { id: 'default' } })
  const matCount = settings?.matCount ?? 1
  const targets: RepeatTarget[] = []
  const now = new Date()

  for (let matIndex = 1; matIndex <= matCount; matIndex++) {
    const session = await prisma.matControlSession.findUnique({
      where: { tournamentScopeId_matIndex: { tournamentScopeId: scopeId, matIndex } },
    })
    const boutId = session?.activeBoutId
    if (!boutId) continue

    const execution = await prisma.boutScheduleExecution.findUnique({ where: { boutId } })
    if (!execution || execution.boutPhase === 'confirmed') continue

    const bout = await findBoutById(boutId)
    if (!bout) continue

    const eventRows = await prisma.boutEvent.findMany({
      where: { boutId, attemptNumber: execution.attemptNumber ?? 1 },
      orderBy: { sequence: 'asc' },
    })
    const events = eventRows.map(mapEventRow)
    const participants = buildParticipantContext(bout, execution.liveSnapshot)
    const timers = computeAuxiliaryTimers({
      events,
      participants,
      attemptNumber: execution.attemptNumber ?? 1,
      execution: {
        boutPhase: execution.boutPhase as 'scheduled' | 'live' | 'pending_activity_decision' | 'pending_confirmation' | 'confirmed',
        clockState: execution.clockState as 'idle' | 'running' | 'stopped',
        clockStartedAt: execution.clockStartedAt,
        clockElapsedBeforeStartMs: execution.clockElapsedBeforeStartMs,
      },
      now,
    })

    for (const corner of ['red', 'blue'] as const) {
      const wait = timers.athleteWaits?.[corner]
      if (wait?.isActive && wait.startedAt) {
        // Bucket intervals follow total wait time (including pauses), not only the current session.
        targets.push({
          boutId,
          matIndex,
          corner,
          entryId: wait.entryId,
          startedAtMs: now.getTime() - wait.totalMs,
        })
        continue
      }

      const secondary = timers.secondaryCalls?.[corner]
      if (secondary) {
        targets.push({
          boutId,
          matIndex,
          corner,
          entryId: secondary.entryId,
          startedAtMs: new Date(secondary.startedAt).getTime(),
        })
      }
    }
  }

  return targets
}

export async function buildActiveRepeatCallKeys(
  scopeId = TOURNAMENT_SCOPE_ID,
): Promise<Set<string>> {
  const targets = await listActiveRepeatTargets(scopeId)
  return new Set(targets.map((target) => repeatTargetKey(target.boutId, target.entryId)))
}

export async function tickBoutRepeatCalls(scopeId = TOURNAMENT_SCOPE_ID): Promise<void> {
  if (!(await isAnnouncerEnabled(scopeId))) return

  const nowMs = Date.now()
  const targets = await listActiveRepeatTargets(scopeId)
  await expireStaleRepeatCalls(scopeId, targets)

  for (const target of targets) {
    const bucket = repeatBucket(nowMs, target.startedAtMs)
    await enqueueBoutRepeatCall({
      scopeId,
      boutId: target.boutId,
      matIndex: target.matIndex,
      corner: target.corner,
      entryId: target.entryId,
      bucket,
    })
  }
}

export async function enqueueBoutRepeatCallFromMatCommand(input: {
  boutId: string
  matIndex: number
  corner: Corner
  entryId: string
  scopeId?: string
}): Promise<void> {
  await enqueueBoutRepeatCall({
    ...input,
    bucket: 0,
  })
}
