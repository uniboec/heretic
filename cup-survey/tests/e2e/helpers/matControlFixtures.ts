import type { Page } from '@playwright/test'
import type { MatControlSnapshot } from '../../../lib/bouts/matControlSnapshot'
import { buildNextSanctions } from '../../../lib/bouts/buildNextSanctions'
import { getUndoCandidate } from '../../../lib/bouts/getUndoCandidate'
import type { BoutEventRecord, ScoreState } from '../../../lib/bouts/mat-control/types'
import { loginAdminPage, loginMatOperatorPage } from './adminAuth'

function jsonRoute(body: unknown) {
  return {
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body),
  }
}

function fixtureTimestamps() {
  const nowMs = Date.now()
  return {
    now: new Date(nowMs).toISOString(),
    expiresAt: new Date(nowMs + 60 * 60 * 1000).toISOString(),
  }
}

function baseBout(overrides: { id?: string; matchNumber?: number } = {}) {
  const matchNumber = overrides.matchNumber ?? 1
  return {
    id: overrides.id ?? 'cat-a::bout-1',
    matchNumber,
    scheduleDisplayNumber: `1-${matchNumber}`,
    isNextStartable: true,
    categoryKey: 'cat-a',
    categoryTitle: '12–13 лет, TC/CC',
    discipline: 'tactic_control',
    storedMatIndex: 1,
    competitionStage: 1,
    schedulePhase: 'elimination' as const,
    round: 1,
    roundsUntilFinal: 2,
    sideA: {
      kind: 'athlete' as const,
      entryId: 'red-1',
      displayName: 'Иванов Иван',
      clubName: 'Клуб А',
      city: 'Екатеринбург',
    },
    sideB: {
      kind: 'athlete' as const,
      entryId: 'blue-1',
      displayName: 'Петров Пётр',
      clubName: 'Клуб Б',
      city: 'Пермь',
    },
  }
}

function baseExecution(boutPhase: MatControlSnapshot['activeBout'] extends null ? never : string) {
  const { now } = fixtureTimestamps()
  const started = boutPhase !== 'scheduled'
  return {
    id: 'exec-1',
    boutId: 'cat-a::bout-1',
    tournamentScopeId: 'cup-2026',
    actualStartAt: started ? now : null,
    actualEndAt: null,
    officialStartedAt: boutPhase === 'scheduled' ? null : now,
    officialEndedAt: boutPhase === 'confirmed' ? now : null,
    mainEndedAt: null,
    extraEndedAt: null,
    activityCorrectionMode: false,
    periodCorrectionMode: false,
    attemptNumber: 1,
    boutPhase,
    clockState: boutPhase === 'live' ? 'running' : 'idle',
    clockStartedAt: boutPhase === 'live' ? now : null,
    clockElapsedBeforeStartMs: 0,
    currentPeriod: 'main',
    nextEventSequence: 0,
    liveRevision: 0,
    liveSnapshot: null,
  }
}

function baseScore(scored = false): ScoreState {
  return {
    officialScore: { red: scored ? 4 : 0, blue: 0 },
    technicalScore: { red: 0, blue: 0 },
    periodPenaltyCount: { red: 0, blue: 0 },
    generalDisciplinaryLadder: { red: null, blue: null },
    outOfBoundsLadder: { red: null, blue: null },
    passivityLadder: { red: null, blue: null },
    technicalCounts: {
      red: { 1: 0, 2: 0, 3: 0, 4: 0 },
      blue: { 1: 0, 2: 0, 3: 0, 4: 0 },
    },
  }
}

type FixtureBoutPhase = 'scheduled' | 'live' | 'pending_confirmation' | 'confirmed'

function enrichActiveBout(
  boutPhase: FixtureBoutPhase | 'pending_activity_decision',
  overrides: Partial<ReturnType<typeof baseActiveBoutCore>> = {},
) {
  const core = baseActiveBoutCore(boutPhase === 'pending_activity_decision' ? 'live' : boutPhase)
  const execution = overrides.execution ?? core.execution
  const score = overrides.score ?? core.score
  const events = overrides.events ?? core.events

  return {
    ...core,
    ...overrides,
    execution:
      boutPhase === 'pending_activity_decision'
        ? { ...execution, boutPhase: 'pending_activity_decision' }
        : execution,
    score,
    events,
    nextSanctions: buildNextSanctions(score),
    undoCandidate: getUndoCandidate({ execution, events }),
  }
}

function baseActiveBoutCore(boutPhase: FixtureBoutPhase) {
  const scored = boutPhase === 'pending_confirmation' || boutPhase === 'confirmed'
  const execution = baseExecution(boutPhase)
  const score = baseScore(scored)
  const events: BoutEventRecord[] = []

  return {
    boutId: 'cat-a::bout-1',
    bout: baseBout(),
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
    periodRemainingMs: 180_000,
    periodDeadlineAt: null,
    events,
    auxiliaryTimers: {},
    correctionMeta: { systemId: 'olympic', downstreamBoutIds: [] },
    confirmationSummary: null,
    nextSanctions: buildNextSanctions(score),
    undoCandidate: getUndoCandidate({ execution, events }),
  }
}

export function baseActiveBout(boutPhase: FixtureBoutPhase) {
  return enrichActiveBout(boutPhase)
}

export function buildMatControlSnapshot(
  overrides: Partial<MatControlSnapshot> & {
    boutPhase?: FixtureBoutPhase
    role?: 'admin' | 'mat_operator'
    /** When true, scheduled phase has no active bout — only queue nextAvailable */
    queueOnly?: boolean
  } = {},
): MatControlSnapshot {
  const boutPhase = overrides.boutPhase ?? 'scheduled'
  const role = overrides.role ?? 'admin'
  const queueOnly = overrides.queueOnly ?? boutPhase === 'scheduled'
  const { now, expiresAt } = fixtureTimestamps()

  const defaultActiveBout =
    boutPhase === 'scheduled' && queueOnly
      ? null
      : enrichActiveBout(boutPhase)

  return {
    matIndex: 1,
    matCount: 1,
    moveMatTargetOptions: [],
    scheduleVersion: 1,
    session: {
      tournamentScopeId: 'cup-2026',
      matIndex: 1,
      activeBoutId:
        boutPhase === 'scheduled' && queueOnly ? null : 'cat-a::bout-1',
      correctionFocusBoutId: null,
      revision: 1,
      holderToken: 'fixture-token',
      holderSince: now,
      heartbeatAt: now,
      expiresAt,
    },
    activeBout: overrides.activeBout !== undefined ? overrides.activeBout : defaultActiveBout,
    pendingMatBoutIds: overrides.pendingMatBoutIds ?? ['cat-a::bout-1', 'cat-a::bout-2'],
    postponeCascadeBoutIds: overrides.postponeCascadeBoutIds ?? ['cat-a::bout-1'],
    queue: {
      nextAvailable:
        boutPhase === 'scheduled' && queueOnly ? { bout: baseBout() } : null,
      upcoming: [],
      blocked: [],
    },
    queueInOrder: overrides.queueInOrder ?? [],
    recentBouts: [
      {
        boutId: 'cat-a::bout-0',
        categoryTitle: '12–13 лет, TC/CC',
        matchNumber: 0,
        winnerName: 'Сидоров С.',
        loserName: 'Кузнецов К.',
        mainScore: '4:2',
        victoryMethod: 'POINTS',
        confirmedAt: '2026-09-30T09:30:00.000Z',
      },
    ],
    permissions: {
      role,
      canCorrectResult: role === 'admin',
      canResetBout: role === 'admin',
    },
    entryWarnings: {},
    entryAthleteIds: {},
    matBoutsNav: [],
    matInProgressBoutId: null,
    now,
    ...overrides,
  }
}

export async function loginMatControlUser(
  page: Page,
  role: 'admin' | 'mat_operator' = 'admin',
): Promise<boolean> {
  if (!process.env.ADMIN_SESSION_SECRET) {
    return false
  }

  return role === 'admin' ? await loginAdminPage(page) : await loginMatOperatorPage(page)
}

export async function installMatControlMocks(
  page: Page,
  snapshot: MatControlSnapshot = buildMatControlSnapshot(),
) {
  await page.route('**/api/admin/bouts/mats/1/lease/acquire', (route) =>
    route.fulfill(jsonRoute({ ok: true })),
  )
  await page.route('**/api/admin/bouts/mats/1/lease/heartbeat', (route) =>
    route.fulfill(jsonRoute({ ok: true })),
  )
  await page.route('**/api/admin/bouts/mats/1/control', (route) =>
    route.fulfill(jsonRoute(snapshot)),
  )
  await page.route('**/api/admin/bouts/*/control/command', (route) =>
    route.fulfill(jsonRoute({ ok: true, liveRevision: 1 })),
  )
}

export async function installStatefulMatControlFlowMocks(page: Page) {
  let boutPhase:
    | 'scheduled'
    | 'live'
    | 'pending_confirmation'
    | 'confirmed'
    | 'pending_activity_decision' = 'scheduled'
  let liveRevision = 0
  let currentPeriod: 'main' | 'extra' = 'main'
  let officialScore = { red: 0, blue: 0 }
  let periodRemainingMs = 180_000
  let flowComplete = false
  let actualStartAt: string | null = null
  const prepEvents: BoutEventRecord[] = []

  await installMatControlMocks(page)

  const renderSnapshot = () => {
    if (flowComplete) {
      const nextBout = baseBout({ id: 'cat-a::bout-2', matchNumber: 2 })
      return buildMatControlSnapshot({
        boutPhase: 'scheduled',
        role: 'admin',
        queueOnly: true,
        activeBout: null,
        queue: {
          nextAvailable: { bout: nextBout },
          upcoming: [],
          blocked: [],
        },
        recentBouts: [
          {
            boutId: 'cat-a::bout-1',
            categoryTitle: '12–13 лет, TC/CC',
            matchNumber: 1,
            winnerName: 'Иванов Иван',
            loserName: 'Петров Пётр',
            mainScore: '2:2',
            victoryMethod: 'POINTS',
            confirmedAt: '2026-09-30T10:30:00.000Z',
          },
          {
            boutId: 'cat-a::bout-0',
            categoryTitle: '12–13 лет, TC/CC',
            matchNumber: 0,
            winnerName: 'Сидоров С.',
            loserName: 'Кузнецов К.',
            mainScore: '4:2',
            victoryMethod: 'POINTS',
            confirmedAt: '2026-09-30T09:30:00.000Z',
          },
        ],
      })
    }

    if (boutPhase === 'scheduled') {
      const score = baseScore()
      const execution = baseExecution('scheduled')
      return buildMatControlSnapshot({
        boutPhase: 'scheduled',
        role: 'admin',
        queueOnly: false,
        activeBout: enrichActiveBout('scheduled', {
          events: prepEvents,
          score,
          execution,
          periodRemainingMs,
        }),
        queue: { nextAvailable: null, upcoming: [], blocked: [] },
      })
    }

    const phaseForView =
      boutPhase === 'pending_activity_decision' ? 'live' : boutPhase
    const score = {
      ...baseScore(boutPhase === 'pending_confirmation' || boutPhase === 'confirmed'),
      officialScore,
    }

    if (boutPhase === 'confirmed') {
      const nextBout = baseBout({ id: 'cat-a::bout-2', matchNumber: 2 })
      return buildMatControlSnapshot({
        boutPhase: 'confirmed',
        role: 'admin',
        queueOnly: false,
        activeBout: enrichActiveBout('confirmed', {
          score,
          periodRemainingMs,
          execution: {
            ...baseExecution('confirmed'),
            boutPhase: 'confirmed',
            currentPeriod,
            liveRevision,
          },
          events: prepEvents,
          confirmationSummary: {
            winnerLabel: 'Иванов Иван (красный)',
            loserLabel: 'Петров Пётр',
            victoryMethodLabel: 'По очкам',
            decisionReason: 'TOTAL_SCORE',
            mainScore: `${officialScore.red}:${officialScore.blue}`,
            extraScore: null,
            countsForFastestFights: false,
            fastestFightTimeLabel: null,
          },
        }),
        queue: {
          nextAvailable: { bout: nextBout },
          upcoming: [],
          blocked: [],
        },
      })
    }

    const startedAt = actualStartAt ?? (boutPhase !== 'scheduled' ? fixtureTimestamps().now : null)

    return buildMatControlSnapshot({
      boutPhase: phaseForView,
      role: 'admin',
      queueOnly: false,
      activeBout: enrichActiveBout(boutPhase === 'pending_activity_decision' ? 'live' : boutPhase, {
        score,
        periodRemainingMs,
        execution: {
          ...baseExecution(phaseForView),
          boutPhase,
          currentPeriod,
          liveRevision,
          actualStartAt: startedAt,
        },
        events: prepEvents,
      }),
      queue: { nextAvailable: null, upcoming: [], blocked: [] },
    })
  }

  await page.route('**/api/admin/bouts/mats/1/control', (route) =>
    route.fulfill(jsonRoute(renderSnapshot())),
  )

  await page.route('**/api/admin/bouts/*/control/command', async (route) => {
    const body = route.request().postDataJSON() as {
      intent?: string
      payload?: {
        redPoints?: number
        bluePoints?: number
        points?: number
        corner?: string
        entryId?: string
        period?: string
      }
    }
    liveRevision += 1

    if (body.intent === 'FIRST_CALL' && body.payload?.entryId) {
      prepEvents.push({
        id: `evt-${prepEvents.length}`,
        boutId: 'cat-a::bout-1',
        clientEventId: `c-${prepEvents.length}`,
        sequence: prepEvents.length,
        eventType: 'FIRST_CALL',
        entryId: body.payload.entryId,
        cornerAtEvent: body.payload.entryId === 'red-1' ? 'red' : 'blue',
        points: null,
        episodeId: null,
        boutElapsedMs: null,
        period: 'main',
        attemptNumber: 1,
        payload: null,
        undoneAt: null,
        createdAt: new Date(fixtureTimestamps().now),
      })
    } else if (body.intent === 'CLOCK_START') {
      boutPhase = 'live'
      actualStartAt = fixtureTimestamps().now
      periodRemainingMs = 180_000
    } else if (body.intent === 'TECHNICAL_SCORE') {
      const points = body.payload?.points ?? 0
      if (body.payload?.corner === 'red') {
        officialScore = { ...officialScore, red: officialScore.red + points }
      } else {
        officialScore = { ...officialScore, blue: officialScore.blue + points }
      }
      if (officialScore.red === 2 && officialScore.blue === 2) {
        if (currentPeriod === 'main') {
          currentPeriod = 'extra'
          officialScore = { red: 0, blue: 0 }
          periodRemainingMs = 180_000
        } else {
          boutPhase = 'pending_activity_decision'
          periodRemainingMs = 0
        }
      }
    } else if (body.intent === 'EXPIRE_PERIOD') {
      if (body.payload?.period === 'main') {
        currentPeriod = 'extra'
        officialScore = { red: 0, blue: 0 }
        periodRemainingMs = 180_000
      } else {
        boutPhase = 'pending_activity_decision'
      }
    } else if (body.intent === 'EXTRA_ACTIVITY_DECIDE') {
      boutPhase = 'pending_confirmation'
    } else if (
      body.intent === 'STOPPAGE_CLEAR_ADVANTAGE' ||
      body.intent === 'STOPPAGE_SUBMISSION' ||
      body.intent === 'STOPPAGE_CHOKE' ||
      body.intent === 'STOPPAGE_FORFEIT' ||
      body.intent === 'STOPPAGE_INJURY'
    ) {
      boutPhase = 'pending_confirmation'
    } else if (body.intent === 'CONFIRM') {
      boutPhase = 'confirmed'
    } else if (body.intent === 'OPEN_NEXT_BOUT') {
      flowComplete = true
    }

    await route.fulfill(
      jsonRoute({
        ok: true,
        liveRevision,
        boutPhase,
      }),
    )
  })
}

export async function installLeaseLossMocks(
  page: Page,
  snapshot: MatControlSnapshot = buildMatControlSnapshot({ boutPhase: 'scheduled', queueOnly: true }),
) {
  let leased = false

  await page.route('**/api/admin/bouts/mats/1/lease/acquire', (route) => {
    if (leased) {
      return route.fulfill(jsonRoute({ ok: true }))
    }
    return route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Ковёр уже занят другим оператором' }),
    })
  })
  await page.route('**/api/admin/bouts/mats/1/lease/takeover', (route) => {
    leased = true
    return route.fulfill(jsonRoute({ ok: true }))
  })
  await page.route('**/api/admin/bouts/mats/1/lease/heartbeat', (route) =>
    route.fulfill(jsonRoute({ ok: true })),
  )
  await page.route('**/api/admin/bouts/mats/1/control', (route) =>
    route.fulfill(jsonRoute(snapshot)),
  )
  await page.route('**/api/admin/bouts/*/control/command', (route) =>
    route.fulfill(jsonRoute({ ok: true, liveRevision: 1 })),
  )
}

export function buildWarningBeforeDqSnapshot(): MatControlSnapshot {
  const score = {
    ...baseScore(),
    generalDisciplinaryLadder: { red: 'WARNING_2' as const, blue: null },
  }
  return buildMatControlSnapshot({
    boutPhase: 'live',
    queueOnly: false,
    activeBout: enrichActiveBout('live', { score }),
  })
}

export function buildOutOfBoundsDqSnapshot(): MatControlSnapshot {
  const score = {
    ...baseScore(),
    outOfBoundsLadder: { red: 'WARNING_3' as const, blue: null },
  }
  return buildMatControlSnapshot({
    boutPhase: 'live',
    queueOnly: false,
    activeBout: enrichActiveBout('live', { score }),
  })
}

export function buildScheduledDqSnapshot(): MatControlSnapshot {
  const score = {
    ...baseScore(),
    generalDisciplinaryLadder: { red: 'WARNING_3' as const, blue: null },
    outOfBoundsLadder: { red: 'WARNING_3' as const, blue: null },
  }
  return buildMatControlSnapshot({
    boutPhase: 'scheduled',
    queueOnly: false,
    activeBout: enrichActiveBout('scheduled', {
      score,
      bout: { ...baseBout(), isNextStartable: false },
    }),
  })
}

export function buildDisqualificationReadySnapshot(): MatControlSnapshot {
  const score = {
    ...baseScore(),
    generalDisciplinaryLadder: { red: 'WARNING_3' as const, blue: null },
  }
  const execution = { ...baseExecution('live'), clockState: 'running' as const }

  return buildMatControlSnapshot({
    boutPhase: 'live',
    queueOnly: false,
    activeBout: enrichActiveBout('live', { score, execution }),
  })
}

export function buildConfirmedWithNextBoutSnapshot(): MatControlSnapshot {
  const nextBout = baseBout({ id: 'cat-a::bout-2', matchNumber: 2 })
  const active = enrichActiveBout('confirmed', {
    confirmationSummary: {
      winnerLabel: 'Петров Пётр (синий)',
      loserLabel: 'Иванов Иван',
      victoryMethodLabel: 'Б.П. — на ногу · 01:43',
      decisionReason: 'submission',
      mainScore: '0:4',
      extraScore: null,
      countsForFastestFights: true,
      fastestFightTimeLabel: '1:43',
    },
  })

  return buildMatControlSnapshot({
    boutPhase: 'confirmed',
    queueOnly: false,
    activeBout: active,
    queue: {
      nextAvailable: { bout: nextBout },
      upcoming: [],
      blocked: [],
    },
  })
}

export function buildClearAdvantageSnapshot(): MatControlSnapshot {
  const score = {
    ...baseScore(),
    officialScore: { red: 12, blue: 2 },
  }
  const execution = baseExecution('live')
  const events: BoutEventRecord[] = []

  return buildMatControlSnapshot({
    boutPhase: 'live',
    queueOnly: false,
    activeBout: enrichActiveBout('live', {
      score,
      execution,
      events,
      hints: { clearAdvantageEligible: true, scoreDifference: 10, leadingCorner: 'red' },
    }),
  })
}
