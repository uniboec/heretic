import { randomUUID } from 'crypto'
import { beforeEach, describe, expect, it } from 'vitest'
import { TOURNAMENT_SCOPE_ID } from '@/lib/config/tournament'
import { assertIntegrationTestDatabase } from '@/lib/db/integrationDatabaseUrl'
import { prisma } from '@/lib/prisma'
import { claimForPlayback, completePlayback, computePlaybackLeaseUntil } from '@/lib/announcer/claimPlayback'
import { startAnnouncer, stopAnnouncer } from '@/lib/announcer/lifecycle'
import { syncPosition } from '@/lib/announcer/positionState'
import { claimNextQueuedForGeneration } from '@/lib/announcer/processor'
import { finalizeAfterGeneration } from '@/lib/announcer/rulePropagation'
import { reclaimExpiredGenerationLeases } from '@/lib/announcer/worker'
import {
  buildFinalizePayloadForEvent,
  createReadyAnnouncerEvent,
  enableAnnouncerForTests,
  purgeAnnouncerIntegrationState,
} from './helpers'
import { buildTtsSignature } from '@/lib/announcer/tts/signature'

const scopeId = TOURNAMENT_SCOPE_ID

describe('announcer integration', () => {
  beforeEach(async () => {
    assertIntegrationTestDatabase()
    await purgeAnnouncerIntegrationState(scopeId)
  })

  it('positionState dedupes same position and creates on A→null→A', async () => {
    await enableAnnouncerForTests(scopeId)
    const scopeKey = 'test:mat:1:call'
    const builder = (id: string) => ({
      boutId: id,
      matIndex: 1,
      sideA: { corner: 'red' as const, displayName: 'Иванов Иван' },
      sideB: { corner: 'blue' as const, displayName: 'Петров Петр' },
    })

    await syncPosition({
      scopeId,
      scopeKey,
      newPositionId: 'bout-a',
      eventType: 'BOUT_CALL',
      payloadBuilder: builder,
    })
    await syncPosition({
      scopeId,
      scopeKey,
      newPositionId: 'bout-a',
      eventType: 'BOUT_CALL',
      payloadBuilder: builder,
    })
    expect(await prisma.announcerEvent.count({ where: { tournamentScopeId: scopeId } })).toBe(1)

    await syncPosition({
      scopeId,
      scopeKey,
      newPositionId: 'bout-b',
      eventType: 'BOUT_CALL',
      payloadBuilder: builder,
    })
    expect(await prisma.announcerEvent.count({ where: { tournamentScopeId: scopeId } })).toBe(2)

    await syncPosition({
      scopeId,
      scopeKey,
      newPositionId: null,
      eventType: 'BOUT_CALL',
      payloadBuilder: builder,
    })
    expect(await prisma.announcerEvent.count({ where: { tournamentScopeId: scopeId } })).toBe(2)

    await syncPosition({
      scopeId,
      scopeKey,
      newPositionId: 'bout-a',
      eventType: 'BOUT_CALL',
      payloadBuilder: builder,
    })
    expect(await prisma.announcerEvent.count({ where: { tournamentScopeId: scopeId } })).toBe(3)
  })

  it('lifecycle start expires queued and stop skips ready events', async () => {
    await enableAnnouncerForTests(scopeId)
    await prisma.announcerEvent.createMany({
      data: [
        {
          tournamentScopeId: scopeId,
          type: 'BOUT_CALL',
          priority: 100,
          sourceId: 's1',
          dedupeKey: randomUUID(),
          payload: {},
          textSnapshot: 'queued',
          status: 'QUEUED',
          expiresAt: new Date(Date.now() + 3600_000),
        },
        {
          tournamentScopeId: scopeId,
          type: 'BOUT_CALL',
          priority: 100,
          sourceId: 's2',
          dedupeKey: randomUUID(),
          payload: {},
          textSnapshot: 'ready',
          status: 'READY',
          audioCacheKey: 'k1',
          audioDurationMs: 1000,
          expiresAt: new Date(Date.now() + 3600_000),
        },
      ],
    })

    await startAnnouncer(scopeId)

    const afterStart = await prisma.announcerEvent.findMany({
      where: { tournamentScopeId: scopeId },
      orderBy: { textSnapshot: 'asc' },
    })
    expect(afterStart.find((e) => e.textSnapshot === 'queued')?.status).toBe('EXPIRED')
    expect(afterStart.find((e) => e.textSnapshot === 'ready')?.status).toBe('EXPIRED')
    expect(await prisma.announcerSetting.findUnique({ where: { tournamentScopeId: scopeId } })).toMatchObject({
      enabled: true,
    })

    await createReadyAnnouncerEvent({ scopeId, priority: 50, type: 'BOUT_PREPARE' })
    await stopAnnouncer(scopeId)

    const readyAfterStop = await prisma.announcerEvent.count({
      where: { tournamentScopeId: scopeId, status: 'READY' },
    })
    const skipped = await prisma.announcerEvent.count({
      where: { tournamentScopeId: scopeId, status: 'SKIPPED' },
    })
    expect(readyAfterStop).toBe(0)
    expect(skipped).toBeGreaterThan(0)
    expect(await prisma.announcerSetting.findUnique({ where: { tournamentScopeId: scopeId } })).toMatchObject({
      enabled: false,
    })
  })

  it('hooks no-op when announcer disabled', async () => {
    await enableAnnouncerForTests(scopeId)
    await prisma.announcerSetting.update({
      where: { tournamentScopeId: scopeId },
      data: { enabled: false },
    })

    await syncPosition({
      scopeId,
      scopeKey: 'disabled:test',
      newPositionId: 'bout-x',
      eventType: 'BOUT_CALL',
      payloadBuilder: (id) => ({ boutId: id }),
    })

    expect(await prisma.announcerEvent.count({ where: { tournamentScopeId: scopeId } })).toBe(0)
  })

  it('concurrent claim yields exactly one PLAYING event', async () => {
    await enableAnnouncerForTests(scopeId)
    await createReadyAnnouncerEvent({ scopeId, priority: 10 })
    await createReadyAnnouncerEvent({ scopeId, priority: 20 })

    const results = await Promise.allSettled(
      Array.from({ length: 8 }, () => claimForPlayback({ scopeId, requireAuto: true })),
    )

    const winners = results
      .filter((result) => result.status === 'fulfilled')
      .map((result) => result.value)
      .filter((result) => result.ok)

    expect(await prisma.announcerEvent.count({ where: { tournamentScopeId: scopeId, status: 'PLAYING' } })).toBe(1)
    expect(winners).toHaveLength(1)
  })

  it('manual claim returns ALREADY_PLAYING while another event plays', async () => {
    await enableAnnouncerForTests(scopeId)
    const first = await createReadyAnnouncerEvent({ scopeId, priority: 10 })
    const second = await createReadyAnnouncerEvent({ scopeId, priority: 9 })

    const playing = await claimForPlayback({ scopeId, eventId: first.id })
    expect(playing.ok).toBe(true)

    const blocked = await claimForPlayback({ scopeId, eventId: second.id })
    expect(blocked).toEqual({ ok: false, code: 'ALREADY_PLAYING' })

    const stillReady = await prisma.announcerEvent.findUnique({ where: { id: second.id } })
    expect(stillReady?.status).toBe('READY')
  })

  it('gap blocks claim until nextPlaybackAllowedAt passes, then picks max priority', async () => {
    await enableAnnouncerForTests(scopeId, { announcementGapMs: 2000 })
    const low = await createReadyAnnouncerEvent({
      scopeId,
      priority: 10,
      createdAt: new Date(Date.now() - 10_000),
    })
    const high = await createReadyAnnouncerEvent({
      scopeId,
      priority: 90,
      createdAt: new Date(),
    })

    const firstClaim = await claimForPlayback({ scopeId, requireAuto: true })
    expect(firstClaim.ok).toBe(true)
    if (!firstClaim.ok) return

    await completePlayback({
      scopeId,
      eventId: firstClaim.snapshot.eventId,
      claimToken: firstClaim.snapshot.claimToken,
    })

    const duringGap = await claimForPlayback({ scopeId, requireAuto: true })
    expect(duringGap).toEqual({ ok: false, code: 'GAP_ACTIVE' })

    await prisma.announcerSetting.update({
      where: { tournamentScopeId: scopeId },
      data: { nextPlaybackAllowedAt: new Date(Date.now() - 1) },
    })

    const afterGap = await claimForPlayback({ scopeId, requireAuto: true })
    expect(afterGap.ok).toBe(true)
    if (!afterGap.ok) return

    const firstId = firstClaim.snapshot.eventId
    const secondId = afterGap.snapshot.eventId
    expect(firstId).not.toBe(secondId)
    expect([low.id, high.id]).toContain(firstId)
    expect([low.id, high.id]).toContain(secondId)
    expect(firstId).toBe(high.id)
    expect(secondId).toBe(low.id)
  })

  it('stale generation token cannot finalize to READY', async () => {
    await enableAnnouncerForTests(scopeId)
    const event = await prisma.announcerEvent.create({
      data: {
        tournamentScopeId: scopeId,
        type: 'BOUT_CALL',
        priority: 100,
        sourceId: 'gen',
        dedupeKey: randomUUID(),
        payload: {},
        textSnapshot: 'generating',
        status: 'GENERATING',
        generationToken: 'current-token',
        generationStartedAt: new Date(),
        generationLeaseUntil: new Date(Date.now() + 60_000),
        expiresAt: new Date(Date.now() + 3600_000),
      },
    })

    const result = await prisma.$transaction(async (tx) =>
      finalizeAfterGeneration(
        tx,
        await buildFinalizePayloadForEvent({
          scopeId,
          eventType: 'BOUT_CALL',
          eventId: event.id,
          generationToken: 'stale-token',
          audioCacheKey: 'audio-1',
          textSnapshot: 'done',
        }),
      ),
    )

    expect(result).toBe('SKIPPED')
    const row = await prisma.announcerEvent.findUniqueOrThrow({ where: { id: event.id } })
    expect(row.status).toBe('GENERATING')
    expect(row.audioCacheKey).toBeNull()
  })

  it('stop prevents late generation finalize from becoming READY', async () => {
    await enableAnnouncerForTests(scopeId)
    const event = await prisma.announcerEvent.create({
      data: {
        tournamentScopeId: scopeId,
        type: 'BOUT_CALL',
        priority: 100,
        sourceId: 'gen2',
        dedupeKey: randomUUID(),
        payload: {},
        textSnapshot: 'generating',
        status: 'GENERATING',
        generationToken: 'live-token',
        generationStartedAt: new Date(),
        generationLeaseUntil: new Date(Date.now() + 60_000),
        expiresAt: new Date(Date.now() + 3600_000),
      },
    })

    await stopAnnouncer(scopeId)

    const result = await prisma.$transaction(async (tx) =>
      finalizeAfterGeneration(
        tx,
        await buildFinalizePayloadForEvent({
          scopeId,
          eventType: 'BOUT_CALL',
          eventId: event.id,
          generationToken: 'live-token',
          audioCacheKey: 'audio-2',
          textSnapshot: 'done',
        }),
      ),
    )

    expect(result).toBe('SKIPPED')
    const row = await prisma.announcerEvent.findUniqueOrThrow({ where: { id: event.id } })
    expect(row.status).toBe('SKIPPED')
  })

  it('requeues when TTS signature changed during generation', async () => {
    await enableAnnouncerForTests(scopeId)
    await prisma.announcerRule.update({
      where: {
        tournamentScopeId_eventType: { tournamentScopeId: scopeId, eventType: 'BOUT_CALL' },
      },
      data: { ttsProvider: 'azure', ttsVoiceId: 'ru-RU-DmitryNeural' },
    })
    const settings = await prisma.announcerSetting.findUniqueOrThrow({
      where: { tournamentScopeId: scopeId },
    })
    const rule = await prisma.announcerRule.findUniqueOrThrow({
      where: {
        tournamentScopeId_eventType: { tournamentScopeId: scopeId, eventType: 'BOUT_CALL' },
      },
    })
    const signatureAtStart = buildTtsSignature(settings, rule)

    const event = await prisma.announcerEvent.create({
      data: {
        tournamentScopeId: scopeId,
        type: 'BOUT_CALL',
        priority: 100,
        sourceId: 'voice-change',
        dedupeKey: randomUUID(),
        payload: {},
        textSnapshot: 'generating',
        status: 'GENERATING',
        generationToken: 'live-token',
        generationTtsSignature: signatureAtStart,
        generationStartedAt: new Date(),
        generationLeaseUntil: new Date(Date.now() + 60_000),
        expiresAt: new Date(Date.now() + 3600_000),
      },
    })

    await prisma.announcerRule.update({
      where: {
        tournamentScopeId_eventType: { tournamentScopeId: scopeId, eventType: 'BOUT_CALL' },
      },
      data: { ttsProvider: 'yandex', ttsVoiceId: 'marina' },
    })

    const result = await prisma.$transaction(async (tx) =>
      finalizeAfterGeneration(
        tx,
        await buildFinalizePayloadForEvent({
          scopeId,
          eventType: 'BOUT_CALL',
          eventId: event.id,
          generationToken: 'live-token',
          audioCacheKey: 'audio-voice',
          textSnapshot: 'done',
          generationTtsSignature: signatureAtStart,
        }),
      ),
    )

    expect(result).toBe('REQUEUED')
    const row = await prisma.announcerEvent.findUniqueOrThrow({ where: { id: event.id } })
    expect(row.status).toBe('QUEUED')
    expect(row.audioCacheKey).toBeNull()
  })

  it('reclaims stuck GENERATING lease back to QUEUED', async () => {
    await enableAnnouncerForTests(scopeId)
    const event = await prisma.announcerEvent.create({
      data: {
        tournamentScopeId: scopeId,
        type: 'BOUT_CALL',
        priority: 100,
        sourceId: 'stuck',
        dedupeKey: randomUUID(),
        payload: {},
        textSnapshot: 'stuck',
        status: 'GENERATING',
        generationToken: 'old',
        generationStartedAt: new Date(Date.now() - 120_000),
        generationLeaseUntil: new Date(Date.now() - 1000),
        expiresAt: new Date(Date.now() + 3600_000),
      },
    })

    await reclaimExpiredGenerationLeases(scopeId)

    const row = await prisma.announcerEvent.findUniqueOrThrow({ where: { id: event.id } })
    expect(row.status).toBe('QUEUED')
    expect(row.generationToken).toBeNull()
  })

  it('claimNextQueuedForGeneration atomically moves one QUEUED row to GENERATING', async () => {
    await enableAnnouncerForTests(scopeId)
    await prisma.announcerEvent.createMany({
      data: [1, 2, 3].map((priority) => ({
        tournamentScopeId: scopeId,
        type: 'BOUT_CALL' as const,
        priority,
        sourceId: `q-${priority}`,
        dedupeKey: randomUUID(),
        payload: {},
        textSnapshot: `q${priority}`,
        status: 'QUEUED' as const,
        expiresAt: new Date(Date.now() + 3600_000),
      })),
    })

    const claims = await Promise.all([
      claimNextQueuedForGeneration(scopeId),
      claimNextQueuedForGeneration(scopeId),
      claimNextQueuedForGeneration(scopeId),
    ])

    const generatingIds = claims.filter(Boolean).map((e) => e!.id)
    expect(new Set(generatingIds).size).toBe(generatingIds.length)
    expect(
      await prisma.announcerEvent.count({ where: { tournamentScopeId: scopeId, status: 'GENERATING' } }),
    ).toBe(generatingIds.length)
  })

  it('lease includes cue duration when includeCueSound is enabled', async () => {
    await enableAnnouncerForTests(scopeId)
    const settings = await prisma.announcerSetting.findUniqueOrThrow({
      where: { tournamentScopeId: scopeId },
    })
    await prisma.announcerRule.update({
      where: {
        tournamentScopeId_eventType: { tournamentScopeId: scopeId, eventType: 'BOUT_CALL' },
      },
      data: { includeCueSound: true },
    })

    const event = await prisma.announcerEvent.create({
      data: {
        tournamentScopeId: scopeId,
        type: 'BOUT_CALL',
        priority: 100,
        sourceId: 'lease',
        dedupeKey: randomUUID(),
        payload: {},
        textSnapshot: 'lease test',
        status: 'READY',
        audioCacheKey: 'k-lease',
        audioDurationMs: 10_000,
        expiresAt: new Date(Date.now() + 3600_000),
      },
    })

    const withoutCue = computePlaybackLeaseUntil(settings, event, 0)
    const withCue = computePlaybackLeaseUntil(settings, event, 600)
    expect(withCue.getTime() - withoutCue.getTime()).toBe(600)
  })
})
