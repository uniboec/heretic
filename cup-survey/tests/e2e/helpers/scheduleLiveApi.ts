import type { APIRequestContext } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { prisma } from '../../../lib/prisma'
import { loginAsAdmin } from './adminAuth'

type AthleteSide = {
  kind: string
  entryId?: string
}

export type ScheduleLiveBout = {
  id: string
  isNextStartable: boolean
  scheduleDisplayNumber: string
  sideA: AthleteSide
  sideB: AthleteSide
}

export type ScheduleLiveContext =
  | { ok: false; reason: string }
  | {
      ok: true
      scheduleVersion: number
      matsEnabled: boolean
      matIndex: number
      matBouts: ScheduleLiveBout[]
      allMatBoutIds: string[]
      nextStartable: ScheduleLiveBout
      notNextStartable: ScheduleLiveBout
    }

type MatControlSnapshot = {
  activeBout?: { liveRevision: number; execution: { attemptNumber: number } } | null
}

function isAthleteBout(bout: ScheduleLiveBout): boolean {
  return bout.sideA.kind === 'athlete' && bout.sideB.kind === 'athlete'
}

export async function ensureScheduleE2EAuth(request: APIRequestContext): Promise<boolean> {
  if (!process.env.ADMIN_SESSION_SECRET) {
    return false
  }
  return loginAsAdmin(request)
}

export async function loadScheduleLiveContext(
  request: APIRequestContext,
  matIndex = 1,
): Promise<ScheduleLiveContext> {
  const response = await request.get('/api/admin/bouts')
  if (!response.ok()) {
    return { ok: false, reason: `admin bouts unavailable: ${response.status()}` }
  }

  const dashboard = (await response.json()) as {
    published?: boolean
    scheduleVersion?: number
    matsEnabled?: boolean
    mats?: Array<{
      matIndex: number
      bouts?: ScheduleLiveBout[]
    }>
  }

  if (!dashboard.published) {
    return { ok: false, reason: 'tournament bouts are not published' }
  }

  const mat = dashboard.mats?.find((entry) => entry.matIndex === matIndex)
  const matBouts = (mat?.bouts ?? []).filter(isAthleteBout)
  if (matBouts.length < 2) {
    return { ok: false, reason: `mat ${matIndex} needs at least two athlete bouts` }
  }

  const nextStartable = matBouts.find((bout) => bout.isNextStartable)
  const notNextStartable = matBouts.find((bout) => !bout.isNextStartable)
  if (!nextStartable || !notNextStartable) {
    return { ok: false, reason: 'mat queue lacks next-startable contrast pair' }
  }

  return {
    ok: true,
    scheduleVersion: dashboard.scheduleVersion ?? 0,
    matsEnabled: dashboard.matsEnabled ?? true,
    matIndex,
    matBouts,
    allMatBoutIds: (mat?.bouts ?? []).map((bout) => bout.id),
    nextStartable,
    notNextStartable,
  }
}

export async function acquireMatControlHolder(
  request: APIRequestContext,
  matIndex: number,
): Promise<{ ok: true; holderToken: string } | { ok: false; reason: string }> {
  const holderToken = `e2e-schedule-${randomUUID()}`
  const acquire = await request.post(`/api/admin/bouts/mats/${matIndex}/lease/acquire`, {
    data: { holderToken },
  })
  if (!acquire.ok()) {
    return { ok: false, reason: `lease acquire failed: ${acquire.status()}` }
  }
  return { ok: true, holderToken }
}

export async function readAdminScheduleVersion(request: APIRequestContext): Promise<number | null> {
  const response = await request.get('/api/admin/bouts')
  if (!response.ok()) {
    return null
  }
  const dashboard = (await response.json()) as { scheduleVersion?: number }
  return typeof dashboard.scheduleVersion === 'number' ? dashboard.scheduleVersion : null
}

export function createMatControlCommandClient(input: {
  request: APIRequestContext
  boutId: string
  holderToken: string
  initialRevision?: number
  initialAttemptNumber?: number
}) {
  let liveRevision = input.initialRevision ?? 0
  let attemptNumber = input.initialAttemptNumber ?? 1
  let scheduleVersion: number | undefined

  async function send(
    intent: string,
    payload: Record<string, unknown> = {},
    options: { operationId?: string; expectedScheduleVersion?: number } = {},
  ) {
    const response = await input.request.post(`/api/admin/bouts/${input.boutId}/control/command`, {
      data: {
        operationId: options.operationId ?? randomUUID(),
        holderToken: input.holderToken,
        expectedLiveRevision: liveRevision,
        expectedAttemptNumber: attemptNumber,
        expectedScheduleVersion: options.expectedScheduleVersion ?? scheduleVersion,
        intent,
        payload,
      },
    })

    const body = (await response.json().catch(() => ({}))) as {
      liveRevision?: number
      scheduleVersion?: number
      code?: string
      error?: string
    }

    return { response, body }
  }

  async function syncRevision(matIndex: number) {
    const snapshotResponse = await input.request.get(`/api/admin/bouts/mats/${matIndex}/control`)
    if (!snapshotResponse.ok()) {
      return
    }
    const snapshot = (await snapshotResponse.json()) as MatControlSnapshot
    liveRevision = snapshot.activeBout?.liveRevision ?? liveRevision
    attemptNumber = snapshot.activeBout?.execution.attemptNumber ?? attemptNumber
  }

  return {
    send,
    syncRevision,
    setScheduleVersion(version: number) {
      scheduleVersion = version
    },
    getLiveRevision() {
      return liveRevision
    },
    applyCommandResult(body: { liveRevision?: number; scheduleVersion?: number }) {
      if (typeof body.liveRevision === 'number') {
        liveRevision = body.liveRevision
      }
      if (typeof body.scheduleVersion === 'number') {
        scheduleVersion = body.scheduleVersion
      }
    },
  }
}

export async function prepareNoShowOnRealBout(input: {
  request: APIRequestContext
  bout: ScheduleLiveBout
  holderToken: string
  matIndex: number
  scheduleVersion: number
  operationPrefix: string
}) {
  const client = createMatControlCommandClient({
    request: input.request,
    boutId: input.bout.id,
    holderToken: input.holderToken,
  })
  client.setScheduleVersion(input.scheduleVersion)

  if (input.bout.sideA.kind !== 'athlete' || input.bout.sideB.kind !== 'athlete') {
    throw new Error('NO_SHOW preparation requires athlete sides')
  }

  const redEntryId = input.bout.sideA.entryId
  const blueEntryId = input.bout.sideB.entryId
  if (!redEntryId || !blueEntryId) {
    throw new Error('NO_SHOW preparation requires entry ids')
  }

  for (const [suffix, intent, payload] of [
    ['red', 'FIRST_CALL', { entryId: redEntryId, corner: 'red' }],
    ['blue', 'FIRST_CALL', { entryId: blueEntryId, corner: 'blue' }],
    ['secondary', 'SECONDARY_CALL', { entryId: redEntryId, corner: 'red' }],
  ] as const) {
    const result = await client.send(intent, payload, {
      operationId: randomUUID(),
      expectedScheduleVersion: input.scheduleVersion,
    })
    if (!result.response.ok()) {
      throw new Error(`${intent} failed (${result.response.status()}): ${JSON.stringify(result.body)}`)
    }
    client.applyCommandResult(result.body)
  }

  await client.syncRevision(input.matIndex)

  try {
    const secondaryCall = await prisma.boutEvent.findFirst({
      where: { boutId: input.bout.id, eventType: 'SECONDARY_CALL' },
      orderBy: { sequence: 'desc' },
    })
    if (secondaryCall) {
      await prisma.boutEvent.update({
        where: { id: secondaryCall.id },
        data: { createdAt: new Date(Date.now() - 121_000) },
      })
    }
  } catch {
    // E2E may run without direct DB access; caller can still attempt NO_SHOW.
  }

  return client.getLiveRevision()
}

export async function patchMatManualOrder(
  request: APIRequestContext,
  input: {
    matIndex: number
    orderedBoutIds: string[]
    expectedScheduleVersion: number
  },
) {
  return request.patch('/api/admin/bouts/schedule-overrides', {
    data: {
      matIndex: input.matIndex,
      orderedBoutIds: input.orderedBoutIds,
      expectedScheduleVersion: input.expectedScheduleVersion,
    },
  })
}
