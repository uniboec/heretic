import type { APIRequestContext } from '@playwright/test'

import { randomUUID } from 'node:crypto'

import { insertSharedEpisodeTie } from '../../../lib/bouts/__tests__/helpers/runSharedEpisodeTie'



type MatControlSnapshot = {

  scheduleVersion?: number

  activeBout?: {

    bout: { id: string; sideA: { kind: string; entryId?: string }; sideB: { kind: string; entryId?: string } }

    liveRevision: number

    periodDurationMs?: number

    execution: { attemptNumber: number; boutPhase: string }

  } | null

  queue: {

    nextAvailable?: { bout: { id: string; sideA: { kind: string; entryId?: string }; sideB: { kind: string; entryId?: string } } } | null

    upcoming: Array<{ bout: { id: string; sideA: { kind: string; entryId?: string }; sideB: { kind: string; entryId?: string } } }>

  }

}



function pickRunnableBout(snapshot: MatControlSnapshot) {

  const candidates = [

    snapshot.activeBout?.bout,

    snapshot.queue.nextAvailable?.bout,

    ...snapshot.queue.upcoming.map((entry) => entry.bout),

  ].filter(Boolean)



  const bout = candidates.find(

    (candidate) => candidate!.sideA.kind === 'athlete' && candidate!.sideB.kind === 'athlete',

  )

  if (!bout) return null



  const redEntryId =

    bout.sideA.kind === 'athlete'

      ? bout.sideA.entryId

      : bout.sideB.kind === 'athlete'

        ? bout.sideB.entryId

        : null

  const blueEntryId =

    bout.sideB.kind === 'athlete'

      ? bout.sideB.entryId

      : bout.sideA.kind === 'athlete'

        ? bout.sideA.entryId

        : null

  if (!redEntryId || !blueEntryId) return null



  return { boutId: bout.id, redEntryId, blueEntryId }

}



type LiveFlowResult =

  | { ok: true; boutId: string; hasQueueAfterConfirm: boolean; hasRecentBout: boolean }

  | { ok: false; reason: string }



async function createLiveSession(request: APIRequestContext, matIndex: number) {

  const holderToken = `e2e-${randomUUID()}`



  const acquire = await request.post(`/api/admin/bouts/mats/${matIndex}/lease/acquire`, {

    data: { holderToken },

  })

  if (!acquire.ok()) {

    return { ok: false as const, reason: `acquire failed: ${acquire.status()}` }

  }



  const snapshotResponse = await request.get(`/api/admin/bouts/mats/${matIndex}/control`)

  if (!snapshotResponse.ok()) {

    return { ok: false as const, reason: `snapshot failed: ${snapshotResponse.status()}` }

  }



  const snapshot = (await snapshotResponse.json()) as MatControlSnapshot

  const runnable = pickRunnableBout(snapshot)

  if (!runnable) {

    return { ok: false as const, reason: 'no runnable bout in snapshot' }

  }



  let revision = snapshot.activeBout?.liveRevision ?? 0

  let scheduleVersion = snapshot.scheduleVersion ?? 0

  const attemptNumber = snapshot.activeBout?.execution.attemptNumber ?? 1

  const periodDurationMs = snapshot.activeBout?.periodDurationMs ?? 180_000



  async function send(intent: string, payload: Record<string, unknown> = {}) {

    const response = await request.post(`/api/admin/bouts/${runnable.boutId}/control/command`, {

      data: {

        operationId: randomUUID(),

        holderToken,

        expectedLiveRevision: revision,

        expectedAttemptNumber: attemptNumber,

        expectedScheduleVersion: scheduleVersion,

        intent,

        payload,

      },

    })

    if (!response.ok()) {

      const body = await response.text()

      throw new Error(`${intent} failed (${response.status()}): ${body}`)

    }

    const json = (await response.json()) as { liveRevision?: number }

    if (typeof json.liveRevision === 'number') {

      revision = json.liveRevision

    }

    return json

  }



  async function syncRevision() {
    const snapshotResponse = await request.get(`/api/admin/bouts/mats/${matIndex}/control`)
    if (!snapshotResponse.ok()) return
    const snapshot = (await snapshotResponse.json()) as MatControlSnapshot
    revision = snapshot.activeBout?.liveRevision ?? revision
    scheduleVersion = snapshot.scheduleVersion ?? scheduleVersion
  }

  return {

    ok: true as const,

    runnable,

    send,

    syncRevision,

    periodDurationMs,

    holderToken,

  }

}



export async function runMatControlLiveFlow(request: APIRequestContext, matIndex = 1): Promise<LiveFlowResult> {

  const session = await createLiveSession(request, matIndex)

  if (!session.ok) return session



  const { runnable, send } = session



  await send('CLOCK_START')

  await send('TECHNICAL_SCORE', { entryId: runnable.redEntryId, corner: 'red', points: 4 })

  await send('STOPPAGE_CLEAR_ADVANTAGE', { winnerCorner: 'red' })

  await send('CONFIRM', {})



  const after = await request.get(`/api/admin/bouts/mats/${matIndex}/control`)

  if (!after.ok()) {

    return { ok: false, reason: `post-flow snapshot failed: ${after.status()}` }

  }



  const afterSnapshot = (await after.json()) as MatControlSnapshot

  const hasQueueAfterConfirm = Boolean(

    afterSnapshot.queue.nextAvailable?.bout || afterSnapshot.queue.upcoming.length > 0,

  )



  return {

    ok: true,

    boutId: runnable.boutId,

    hasQueueAfterConfirm,

    hasRecentBout: true,

  }

}



export async function runMatControlTieBreakLiveFlow(

  request: APIRequestContext,

  matIndex = 1,

): Promise<LiveFlowResult> {

  const session = await createLiveSession(request, matIndex)

  if (!session.ok) return session



  const { runnable, send, syncRevision, periodDurationMs } = session

  await send('CLOCK_START')

  await insertSharedEpisodeTie({
    boutId: runnable.boutId,
    redEntryId: runnable.redEntryId,
    blueEntryId: runnable.blueEntryId,
    redPoints: 2,
    bluePoints: 2,
    operationId: 'live-main-tie',
  })
  await syncRevision()

  await send('CLOCK_ADJUST', { deltaMs: -periodDurationMs })

  await send('EXPIRE_PERIOD', { period: 'main', periodDurationMs })

  await send('CLOCK_START')

  await insertSharedEpisodeTie({
    boutId: runnable.boutId,
    redEntryId: runnable.redEntryId,
    blueEntryId: runnable.blueEntryId,
    redPoints: 2,
    bluePoints: 2,
    operationId: 'live-extra-tie',
  })
  await syncRevision()

  await send('CLOCK_ADJUST', { deltaMs: -periodDurationMs })

  await send('EXPIRE_PERIOD', { period: 'extra', periodDurationMs })

  await send('EXTRA_ACTIVITY_DECIDE', { winnerCorner: 'red' })

  await send('CONFIRM', {})



  const after = await request.get(`/api/admin/bouts/mats/${matIndex}/control`)

  if (!after.ok()) {

    return { ok: false, reason: `post-tiebreak snapshot failed: ${after.status()}` }

  }



  const afterSnapshot = (await after.json()) as MatControlSnapshot

  const hasQueueAfterConfirm = Boolean(

    afterSnapshot.queue.nextAvailable?.bout || afterSnapshot.queue.upcoming.length > 0,

  )

  const versions = await request.get(`/api/admin/bouts/${runnable.boutId}/result-versions`)

  if (!versions.ok()) {

    return { ok: false, reason: `result versions failed: ${versions.status()}` }

  }

  const versionsJson = (await versions.json()) as { versions?: Array<{ isCurrent?: boolean }> }

  const hasCurrentResult = (versionsJson.versions ?? []).some((version) => version.isCurrent)



  return {

    ok: true,

    boutId: runnable.boutId,

    hasQueueAfterConfirm,

    hasRecentBout: hasCurrentResult,

  }

}


