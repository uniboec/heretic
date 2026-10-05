import { describe, expect, it } from 'vitest'
import { buildMatScoreboardSnapshot } from '../matScoreboardSnapshot'
import { buildNextSanctions } from '../buildNextSanctions'
import { getUndoCandidate } from '../getUndoCandidate'
import type { MatControlSnapshot } from '../matControlSnapshot'

const score = {
  officialScore: { red: 3, blue: 1 },
  technicalScore: { red: 3, blue: 1 },
  periodPenaltyCount: { red: 0, blue: 0 },
  generalDisciplinaryLadder: { red: null, blue: null },
  outOfBoundsLadder: { red: null, blue: null },
  passivityLadder: { red: null, blue: null },
  technicalCounts: {
    red: { 1: 0, 2: 0, 3: 1, 4: 0 },
    blue: { 1: 0, 2: 0, 3: 0, 4: 0 },
  },
}

const execution = {
  id: 'exec-1',
  boutId: 'cat::bout-1',
  tournamentScopeId: 'cup-2026',
  actualStartAt: null,
  actualEndAt: null,
  officialStartedAt: new Date(),
  officialEndedAt: null,
  mainEndedAt: null,
  extraEndedAt: null,
  activityCorrectionMode: false,
  periodCorrectionMode: false,
  attemptNumber: 1,
  boutPhase: 'live' as const,
  clockState: 'running' as const,
  clockStartedAt: new Date(),
  clockElapsedBeforeStartMs: 0,
  currentPeriod: 'main' as const,
  nextEventSequence: 1,
  liveRevision: 1,
  liveSnapshot: null,
}

const snapshot: MatControlSnapshot = {
  matIndex: 1,
  matCount: 2,
  moveMatTargetOptions: [2],
  session: {
    tournamentScopeId: 'cup-2026',
    matIndex: 1,
    activeBoutId: 'cat::bout-1',
    revision: 1,
    holderToken: 'token',
    holderSince: new Date(),
    heartbeatAt: new Date(),
    expiresAt: new Date(Date.now() + 60_000),
  },
  activeBout: {
    boutId: 'cat::bout-1',
    bout: {
      id: 'cat::bout-1',
      matchNumber: 1,
      scheduleDisplayNumber: '1-1',
      categoryKey: 'cat',
      categoryTitle: '55 кг',
      discipline: 'TC',
      storedMatIndex: 1,
      competitionStage: 1,
      schedulePhase: 'elimination',
      round: 1,
      roundsUntilFinal: 1,
      sideA: {
        kind: 'athlete',
        entryId: 'red-1',
        displayName: 'Иванов И.',
        clubName: 'Клуб',
        city: 'Екб',
      },
      sideB: {
        kind: 'athlete',
        entryId: 'blue-1',
        displayName: 'Петров П.',
        clubName: 'Клуб 2',
        city: 'Мск',
      },
    },
    execution,
    participants: {
      redEntryId: 'red-1',
      blueEntryId: 'blue-1',
      cornersSwapped: false,
    },
    score,
    hints: { clearAdvantageEligible: false },
    decisionPreview: null,
    periodDurationMs: 180_000,
    defaultPeriodDurationMs: 180_000,
    mainPeriodDurationMs: 180_000,
    extraPeriodDurationMs: 180_000,
    periodCount: 2,
    periodRemainingMs: 120_000,
    periodDeadlineAt: null,
    events: [],
    auxiliaryTimers: {
      athleteDoctorVisits: {
        red: {
          entryId: 'red-1',
          accumulatedMs: 0,
          startedAt: '2026-09-30T10:00:00.000Z',
          isActive: true,
          totalMs: 1000,
          removalAvailable: false,
        },
      },
    },
    correctionMeta: { systemId: 'olympic', downstreamBoutIds: [] },
    confirmationSummary: null,
    nextSanctions: buildNextSanctions(score),
    undoCandidate: getUndoCandidate({ execution, events: [] }),
  },
  pendingMatBoutIds: ['cat::bout-1'],
  postponeCascadeBoutIds: ['cat::bout-1'],
  queue: {
    nextAvailable: null,
    upcoming: [],
    blocked: [],
  },
  queueInOrder: [],
  recentBouts: [],
  permissions: { role: 'admin', canCorrectResult: true, canResetBout: true },
  entryWarnings: {},
  entryAthleteIds: {},
  matBoutsNav: [],
  matInProgressBoutId: null,
  now: new Date().toISOString(),
}

describe('matScoreboardSnapshot', () => {
  it('builds public scoreboard payload without session secrets', () => {
    const board = buildMatScoreboardSnapshot(snapshot)

    expect(board.matIndex).toBe(1)
    expect(board.activeBout?.redName).toBe('Иванов И.')
    expect(board.activeBout?.score).toEqual({ red: 3, blue: 1 })
    expect(board.activeBout?.scheduleDisplayNumber).toBe('1-1')
    expect(board.activeBout?.clockRunning).toBe(true)
    expect(board.activeBout?.pauseLabel).toBe('Врач')
    expect(board).not.toHaveProperty('session')
  })
})
