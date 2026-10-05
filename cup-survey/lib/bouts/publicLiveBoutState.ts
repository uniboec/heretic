import { prisma } from '../prisma'
import { loadBoutEvents } from './matControlContext'
import { mapEventRow, mapExecutionRow } from './matControlMappers'
import { reduceScoreEvents } from './scoreEngine'
import { computeRemainingMs } from './stopClockAt'
import { resolvePeriodDurationMs } from './boutLiveSnapshot'
import type { AgeDivisionDurationOverrides } from './boutDuration'
import type { BoutPhase } from './mat-control/types'

export type PublicLiveBoutState = {
  boutId: string
  boutPhase: BoutPhase
  currentPeriod: 'main' | 'extra'
  periodRemainingMs: number
  score: { red: number; blue: number }
}

const LIVE_PHASES = new Set<BoutPhase>([
  'live',
  'pending_activity_decision',
  'pending_confirmation',
])

export async function loadPublicLiveBoutStates(input: {
  durationOverrides: AgeDivisionDurationOverrides
  categoryKeyByBoutId: Map<string, string>
  now: Date
}): Promise<Map<string, PublicLiveBoutState>> {
  const rows = await prisma.boutScheduleExecution.findMany({
    where: {
      boutPhase: { in: [...LIVE_PHASES] },
    },
  })

  const result = new Map<string, PublicLiveBoutState>()
  if (rows.length === 0) {
    return result
  }

  const eventRows = await prisma.boutEvent.findMany({
    where: { boutId: { in: rows.map((row) => row.boutId) } },
    orderBy: [{ boutId: 'asc' }, { sequence: 'asc' }],
  })
  const eventsByBout = new Map<string, ReturnType<typeof mapEventRow>[]>()
  for (const row of eventRows) {
    const mapped = mapEventRow(row)
    const bucket = eventsByBout.get(row.boutId) ?? []
    bucket.push(mapped)
    eventsByBout.set(row.boutId, bucket)
  }

  for (const row of rows) {
    const execution = mapExecutionRow(row)
    const categoryKey = input.categoryKeyByBoutId.get(row.boutId)
    if (!categoryKey) continue

    const periodDurationMs = resolvePeriodDurationMs({
      liveSnapshot: execution.liveSnapshot,
      period: execution.currentPeriod,
      categoryKey,
      overrides: input.durationOverrides,
    })

    const events = eventsByBout.get(row.boutId) ?? []
    const score = reduceScoreEvents(events, execution.currentPeriod, execution.attemptNumber)

    result.set(row.boutId, {
      boutId: row.boutId,
      boutPhase: execution.boutPhase,
      currentPeriod: execution.currentPeriod,
      periodRemainingMs: computeRemainingMs(execution, periodDurationMs, input.now),
      score: {
        red: score.officialScore.red,
        blue: score.officialScore.blue,
      },
    })
  }

  return result
}
