import { TOURNAMENT_SCOPE_ID } from '@/lib/config/tournament'
import { prisma } from '@/lib/prisma'
import { expireStaleAnnouncerEvents } from './expireEvents'
import { buildValidityContext } from './validityContext'
import { syncAwardAnnouncerState } from './hooks/awardHooks'
import { syncAllMatsAnnouncerState } from './hooks/matHooks'
import { ensureAnnouncerQueueFresh } from './queueRefresh'
import { ensureAnnouncerRules } from './rules'
import { ensureAnnouncerSettings, getAnnouncerSettings } from './settings'
import { kickAnnouncerWorker } from './worker'

export async function startAnnouncer(scopeId = TOURNAMENT_SCOPE_ID): Promise<void> {
  await ensureAnnouncerSettings(scopeId)
  await ensureAnnouncerRules(scopeId)

  await prisma.$transaction(async (tx) => {
    await tx.announcerEvent.updateMany({
      where: {
        tournamentScopeId: scopeId,
        status: { in: ['QUEUED', 'READY', 'GENERATING', 'PLAYING'] },
      },
      data: {
        status: 'EXPIRED',
        claimToken: null,
        claimedAt: null,
        leaseUntil: null,
      },
    })

    await tx.announcerPositionState.updateMany({
      where: { tournamentScopeId: scopeId },
      data: { currentPositionId: null },
    })

    await tx.announcerSetting.update({
      where: { tournamentScopeId: scopeId },
      data: {
        enabled: true,
        mode: 'AUTO',
        nextPlaybackAllowedAt: new Date(),
      },
    })
  })

  await syncAllMatsAnnouncerState(scopeId)
  await syncAwardAnnouncerState(scopeId)
}

export async function stopAnnouncer(scopeId = TOURNAMENT_SCOPE_ID): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.announcerSetting.update({
      where: { tournamentScopeId: scopeId },
      data: { enabled: false },
    })
    await tx.announcerEvent.updateMany({
      where: {
        tournamentScopeId: scopeId,
        status: { in: ['QUEUED', 'READY', 'GENERATING'] },
      },
      data: {
        status: 'SKIPPED',
        generationToken: null,
        generationStartedAt: null,
        generationLeaseUntil: null,
        generationTtsSignature: null,
      },
    })
    await tx.announcerEvent.updateMany({
      where: {
        tournamentScopeId: scopeId,
        status: 'PLAYING',
      },
      data: {
        status: 'SKIPPED',
        claimToken: null,
        claimedAt: null,
        leaseUntil: null,
      },
    })
  })
}

export async function purgeStaleAnnouncerEvents(scopeId = TOURNAMENT_SCOPE_ID): Promise<number> {
  const ctx = await buildValidityContext(scopeId)
  return expireStaleAnnouncerEvents(scopeId, ctx)
}

export async function refreshAnnouncerDashboard(scopeId = TOURNAMENT_SCOPE_ID) {
  const ctx = await buildValidityContext(scopeId)
  await expireStaleAnnouncerEvents(scopeId, ctx)
  await ensureAnnouncerQueueFresh(scopeId)
  kickAnnouncerWorker(scopeId)
  return getAnnouncerDashboard(scopeId)
}

export async function getAnnouncerDashboard(scopeId = TOURNAMENT_SCOPE_ID) {
  const settings = await getAnnouncerSettings(scopeId)
  const rules = await ensureAnnouncerRules(scopeId)
  const now = new Date()

  const [playing, queue, history, playedCount, playedSpeech, playedChars] = await Promise.all([
    prisma.announcerEvent.findFirst({
      where: { tournamentScopeId: scopeId, status: 'PLAYING' },
    }),
    prisma.announcerEvent.findMany({
      where: {
        tournamentScopeId: scopeId,
        status: { in: ['QUEUED', 'GENERATING', 'READY'] },
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      take: 50,
    }),
    prisma.announcerEvent.findMany({
      where: {
        tournamentScopeId: scopeId,
        status: { in: ['PLAYED', 'SKIPPED', 'EXPIRED', 'FAILED'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    prisma.announcerEvent.count({
      where: { tournamentScopeId: scopeId, status: 'PLAYED' },
    }),
    prisma.announcerEvent.aggregate({
      where: { tournamentScopeId: scopeId, status: 'PLAYED' },
      _sum: { audioDurationMs: true },
    }),
    prisma.announcerEvent.findMany({
      where: { tournamentScopeId: scopeId, status: 'PLAYED' },
      select: { textSnapshot: true },
    }),
  ])

  const estimatedSpeechSeconds = Math.round((playedSpeech._sum.audioDurationMs ?? 0) / 1000)
  const estimatedCharCount = playedChars.reduce(
    (sum, row) => sum + (row.textSnapshot?.length ?? 0),
    0,
  )

  return {
    settings,
    rules,
    playing,
    queue,
    history,
    stats: {
      playedCount,
      estimatedSpeechSeconds,
      estimatedCharCount,
      estimatedCostRub: Math.round(playedCount * 0.15),
    },
    serverTime: now.toISOString(),
  }
}
