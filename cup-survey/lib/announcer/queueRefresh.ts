import { TOURNAMENT_SCOPE_ID } from '@/lib/config/tournament'
import { prisma } from '@/lib/prisma'
import { syncAwardAnnouncerState } from './hooks/awardHooks'
import { syncAllMatsAnnouncerState } from './hooks/matHooks'
import { findUncoveredPositionScopes } from './positionCoverage'
import { isAnnouncerEnabled } from './settings'
import { buildValidityContext } from './validityContext'

const RESEED_COOLDOWN_MS = 10_000
const FRESH_CHECK_INTERVAL_MS = 5_000

let lastFreshCheckAt = 0
let lastReseedAt = 0

/**
 * Recreates position-based announcements only when a tracked mat/award head
 * has no pending or still-valid played announcement (e.g. after TTL expiry).
 */
export async function ensureAnnouncerQueueFresh(scopeId = TOURNAMENT_SCOPE_ID): Promise<void> {
  const now = Date.now()
  if (now - lastFreshCheckAt < FRESH_CHECK_INTERVAL_MS) return
  lastFreshCheckAt = now

  if (!(await isAnnouncerEnabled(scopeId))) return
  if (now - lastReseedAt < RESEED_COOLDOWN_MS) return

  const [pendingCount, playingCount] = await Promise.all([
    prisma.announcerEvent.count({
      where: {
        tournamentScopeId: scopeId,
        status: { in: ['QUEUED', 'GENERATING', 'READY'] },
      },
    }),
    prisma.announcerEvent.count({
      where: { tournamentScopeId: scopeId, status: 'PLAYING' },
    }),
  ])

  if (pendingCount > 0 || playingCount > 0) return

  const ctx = await buildValidityContext(scopeId)
  const uncovered = await findUncoveredPositionScopes(scopeId, ctx)
  if (uncovered.length === 0) return

  lastReseedAt = now

  await prisma.announcerPositionState.updateMany({
    where: { tournamentScopeId: scopeId },
    data: { currentPositionId: null },
  })

  await syncAllMatsAnnouncerState(scopeId)
  await syncAwardAnnouncerState(scopeId)
}
