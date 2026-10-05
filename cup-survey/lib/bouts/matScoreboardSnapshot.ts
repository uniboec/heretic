import type { MatControlSnapshot } from './matControlSnapshot'
import { getMatControlSnapshot } from './matControlService'
import type { InternalBoutSide } from './types'

function sideName(side: InternalBoutSide): string {
  if (side.kind === 'athlete') return side.displayName
  if (side.kind === 'hint') return side.label
  return '—'
}

export type MatScoreboardSnapshot = {
  matIndex: number
  now: string
  activeBout: {
    boutId: string
    scheduleDisplayNumber: string
    categoryTitle: string
    discipline: string
    boutPhase: string
    currentPeriod: string
    periodRemainingMs: number
    periodDeadlineAt: string | null
    clockRunning: boolean
    pauseLabel: string | null
    score: { red: number; blue: number }
    redName: string
    blueName: string
  } | null
  nextBout: {
    boutId: string
    scheduleDisplayNumber: string
    categoryTitle: string
    discipline: string
    redName: string
    blueName: string
  } | null
}

export function buildMatScoreboardSnapshot(snapshot: MatControlSnapshot): MatScoreboardSnapshot {
  const active = snapshot.activeBout
  const pauseLabel =
    active?.auxiliaryTimers.athleteDoctorVisits &&
    Object.values(active.auxiliaryTimers.athleteDoctorVisits).some((timer) => timer?.isActive)
      ? 'Врач'
      : null

  const activeBout = active
    ? {
        boutId: active.boutId,
        scheduleDisplayNumber: active.bout.scheduleDisplayNumber ?? '',
        categoryTitle: active.bout.categoryTitle,
        discipline: active.bout.discipline,
        boutPhase: active.execution.boutPhase,
        currentPeriod: active.execution.currentPeriod,
        periodRemainingMs: active.periodRemainingMs,
        periodDeadlineAt: active.periodDeadlineAt,
        clockRunning: active.execution.clockState === 'running',
        pauseLabel,
        score: {
          red: active.score.officialScore.red,
          blue: active.score.officialScore.blue,
        },
        redName: sideName(active.bout.sideA),
        blueName: sideName(active.bout.sideB),
      }
    : null

  const next = snapshot.queue.nextAvailable?.bout
  const nextBout = next
    ? {
        boutId: next.id,
        scheduleDisplayNumber: next.scheduleDisplayNumber ?? '',
        categoryTitle: next.categoryTitle,
        discipline: next.discipline,
        redName: sideName(next.sideA),
        blueName: sideName(next.sideB),
      }
    : null

  return {
    matIndex: snapshot.matIndex,
    now: snapshot.now,
    activeBout,
    nextBout,
  }
}

export async function getMatScoreboardSnapshot(matIndex: number): Promise<MatScoreboardSnapshot> {
  const snapshot = await getMatControlSnapshot(matIndex, 'mat_operator')
  return buildMatScoreboardSnapshot(snapshot)
}
