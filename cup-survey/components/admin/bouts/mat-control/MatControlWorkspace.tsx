'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { withBasePath } from '@/lib/basePath'
import { readJsonResponse } from '@/lib/http/readJsonResponse'
import type { MatControlSnapshot } from '@/lib/bouts/matControlSnapshot'
import { Button } from '@/components/ui/Button'
import type { Corner } from '@/lib/bouts/mat-control/types'
import type { PenaltyLadder } from '@/lib/config/fseRules'
import {
  canSwapCornersForBout,
  getSwapCornersBlockReason,
  shouldShowSwapCornersButton,
} from '@/lib/bouts/canSwapCorners'
import { getMaxPostponeSkip } from '@/lib/bouts/resolvePostponeAnchor'
import { getDisciplineShortLabel } from '@/lib/config/tournament'
import { EditBoutResultDialog } from './EditBoutResultDialog'
import { useLiveMatTimers } from './hooks/useLiveMatTimers'
import { useMatControlCommands } from './hooks/useMatControlCommands'
import { useMoveBoutToMat } from './hooks/useMoveBoutToMat'
import { usePostponeBout } from './hooks/usePostponeBout'
import { useMatControlPhase } from './hooks/useMatControlPhase'
import { useMatControlSnapshot } from './hooks/useMatControlSnapshot'
import { useClientFightClock } from './hooks/useClientFightClock'
import { useBoutReliabilitySession } from './hooks/useBoutReliabilitySession'
import { useMatControlWalDrain } from './hooks/useMatControlWalDrain'
import { useMatControlTabLock } from './hooks/useMatControlTabLock'
import { useMatControlCommit } from './hooks/useMatControlCommit'
import {
  getClientLifecycleState,
  rotateClientSessionId,
  saveBoutSessionClientState,
} from '@/lib/bouts/matControlReliability/wal'
import { useMatControlSession } from './useMatControlSession'
import { BoutFinishWizard } from './judge/BoutFinishWizard'
import { CornerOverflowMenu } from './judge/CornerOverflowMenu'
import {
  AuxiliaryOutcomeConfirmModal,
  type AuxiliaryOutcomeKind,
} from './judge/AuxiliaryOutcomeConfirmModal'
import { DisqualifyConfirmModal } from './judge/DisqualifyConfirmModal'
import { JudgeMandateFightConfirmModal } from './judge/JudgeMandateFightConfirmModal'
import { JudgeBoutTimingModal } from './judge/JudgeBoutTimingModal'
import { PostponeBoutModal } from './judge/PostponeBoutModal'
import { ResetBoutConfirmModal } from './judge/ResetBoutConfirmModal'
import { JudgeActionHistory } from './judge/JudgeActionHistory'
import { JudgeCorrectionJournal } from './judge/JudgeCorrectionJournal'
import { JudgeFooterStrips } from './judge/JudgeFooterStrips'
import { JudgePhaseStage } from './judge/JudgePhaseStage'
import { JudgeQueueNextPair } from './judge/JudgeQueueNextPair'
import { JudgeActivityCorrectionView } from './judge/JudgeActivityCorrectionView'
import { JudgeActivityView } from './judge/JudgeActivityView'
import { JudgeConfirmationView } from './judge/JudgeConfirmationView'
import { JudgeLiveView } from './judge/JudgeLiveView'
import { JudgeModeShell } from './judge/JudgeModeShell'
import { JudgeQueueDrawer } from './judge/JudgeQueueDrawer'
import { JudgeQueueStrip } from './judge/JudgeQueueStrip'
import { JudgeBoutNavBar } from './judge/JudgeBoutNavBar'
import { filterMatBoutNavItems } from './judge/judgeQueueFormat'
import { JudgeServiceBar } from './judge/JudgeServiceBar'
import { JudgeTechnicalJournalDrawer } from './judge/JudgeTechnicalJournalDrawer'
import { sideForUiCorner, sideLabel } from './judge/judgeAthlete'
import { collectEntryMandateWarningAthletes } from '@/lib/mandate/boutMandateWarnings'
import { useControlsEnabled } from './judge/useControlsEnabled'
import { useFullscreen } from './judge/useFullscreen'
import { useJudgeFightSounds } from './judge/useJudgeFightSounds'
import { useJudgePeriodWarning } from './judge/useJudgePeriodWarning'
import { useJudgeSoundEnabled } from './judge/useJudgeSoundEnabled'
import { useJudgeKeyboardShortcuts } from './judge/useJudgeKeyboardShortcuts'
import { fightTimerSoundPlayer } from '@/lib/bouts/mat-control/sounds/fightTimerSounds'

interface MatControlWorkspaceProps {
  matIndex: number
}

type DisqualifyPending = {
  corner: Corner
  ladder: PenaltyLadder
  entryId: string
}

type AuxiliaryOutcomePending = {
  kind: AuxiliaryOutcomeKind
  corner: Corner
  entryId?: string
  scoreDifference?: number
}

export function MatControlWorkspace({ matIndex }: MatControlWorkspaceProps) {
  const { holderToken, leaseHeld, acquire, release, takeover, leaseError } =
    useMatControlSession(matIndex)
  const { fullscreen, toggle: toggleFullscreen } = useFullscreen()
  const { soundEnabled, toggleSound } = useJudgeSoundEnabled()
  const {
    snapshot,
    activeBout,
    nextBout,
    lastSnapshotAt,
    isRefreshing,
    loading,
    error,
    setError,
    refresh,
    applySnapshot,
  } = useMatControlSnapshot(matIndex)
  const liveTimers = useLiveMatTimers(activeBout, lastSnapshotAt)
  const boutView = useMemo(() => {
    if (!activeBout || !liveTimers) return activeBout
    return {
      ...activeBout,
      periodRemainingMs: liveTimers.periodRemainingMs,
      auxiliaryTimers: {
        ...activeBout.auxiliaryTimers,
        ...liveTimers.auxiliaryTimers,
      },
    }
  }, [activeBout, liveTimers])
  const [busy, setBusy] = useState(false)
  const [finishWizardOpen, setFinishWizardOpen] = useState(false)
  const [editResultOpen, setEditResultOpen] = useState(false)
  const [queueDrawerOpen, setQueueDrawerOpen] = useState(false)
  const [showCompletedMatBouts, setShowCompletedMatBouts] = useState(false)
  const [journalDrawerOpen, setJournalDrawerOpen] = useState(false)
  const [cornerMenuCorner, setCornerMenuCorner] = useState<Corner | null>(null)
  const [disqualifyPending, setDisqualifyPending] = useState<DisqualifyPending | null>(null)
  const [auxiliaryOutcomePending, setAuxiliaryOutcomePending] =
    useState<AuxiliaryOutcomePending | null>(null)
  const [resetBoutOpen, setResetBoutOpen] = useState(false)
  const [postponeBoutOpen, setPostponeBoutOpen] = useState(false)
  const [boutTimingOpen, setBoutTimingOpen] = useState(false)
  const [mandateFightConfirmOpen, setMandateFightConfirmOpen] = useState(false)
  const [injuryScoreAcknowledged, setInjuryScoreAcknowledged] = useState(false)
  const mandateFightConfirmActionRef = useRef<(() => void) | null>(null)
  const expireSentRef = useRef<string | null>(null)
  const passivityPenaltySentRef = useRef<string | null>(null)
  const passivityDqDismissedRef = useRef<string | null>(null)
  const deepLinkFocusRef = useRef<string | null>(null)
  const deepLinkEditResultRef = useRef<{ boutId: string | null } | null>(null)

  const headerBout = activeBout?.bout ?? nextBout
  const headerDiscipline = headerBout?.discipline
    ? getDisciplineShortLabel(headerBout.discipline)
    : null
  const workingBoutId = activeBout?.boutId ?? nextBout?.id ?? null
  const { clientState, isStale, acquireSession } = useBoutReliabilitySession(
    workingBoutId,
    snapshot?.boutSession ?? null,
  )
  const { blocked: tabBlocked } = useMatControlTabLock(matIndex)
  const [lifecycleState, setLifecycleState] = useState<string | null>(null)

  const { controlsEnabled, snapshotFresh, disabledReason } = useControlsEnabled({
    leaseHeld,
    busy,
    lastSnapshotAt,
    isRefreshing,
  })

  const correctionFocusActive = Boolean(
    snapshot?.session.correctionFocusBoutId &&
      activeBout?.boutId === snapshot.session.correctionFocusBoutId,
  )

  const browsingOtherBout = useMemo(() => {
    if (!snapshot?.matInProgressBoutId || !activeBout?.boutId) return false
    return snapshot.matInProgressBoutId !== activeBout.boutId
  }, [snapshot?.matInProgressBoutId, activeBout?.boutId])

  const inProgressScheduleNumber = useMemo(() => {
    if (!snapshot?.matInProgressBoutId) return null
    return (
      snapshot.matBoutsNav.find((item) => item.boutId === snapshot.matInProgressBoutId)
        ?.scheduleDisplayNumber ?? null
    )
  }, [snapshot])

  const visibleMatBoutsNav = useMemo(() => {
    if (!snapshot) return []
    return filterMatBoutNavItems(snapshot.matBoutsNav, showCompletedMatBouts)
  }, [snapshot, showCompletedMatBouts])

  useEffect(() => {
    setInjuryScoreAcknowledged(false)
  }, [activeBout?.boutId, activeBout?.execution.boutPhase])

  const effectiveControlsEnabled = controlsEnabled && !browsingOtherBout && !isStale
  const effectiveDisabledReason = isStale
    ? 'Сессия боя устарела — требуется handoff или reclaim администратором'
    : browsingOtherBout
      ? correctionFocusActive
        ? `Коррекция завершённого боя. На ковре идёт поединок №${inProgressScheduleNumber ?? '…'} — управление недоступно`
        : `Идёт поединок №${inProgressScheduleNumber ?? '…'} — только просмотр`
      : disabledReason

  const confirmDisabledReason = useMemo(() => {
    if (!boutView || boutView.execution.boutPhase !== 'pending_confirmation') {
      return effectiveDisabledReason
    }
    const issues = boutView.confirmValidationIssues
    const injuryBlock = issues.find((i) => i.code === 'INJURY_WITH_TECHNICAL_SCORE')
    if (injuryBlock && !injuryScoreAcknowledged) return injuryBlock.message
    const clockBlock = issues.find((i) => i.code === 'CLOCK_START_REQUIRED')
    if (clockBlock) return clockBlock.message
    return effectiveDisabledReason
  }, [boutView, effectiveDisabledReason, injuryScoreAcknowledged])

  const confirmValidationWarnings = useMemo(() => {
    if (!boutView) return []
    return boutView.confirmValidationIssues.filter(
      (issue) => issue.code === 'POINTS_SUSPICIOUSLY_SHORT',
    )
  }, [boutView])

  const showInjuryScoreAck = useMemo(() => {
    if (!boutView) return false
    return boutView.confirmValidationIssues.some((i) => i.code === 'INJURY_WITH_TECHNICAL_SCORE')
  }, [boutView])

  const mandateWarningAthletes = useMemo(() => {
    if (!snapshot) return []

    const { entryWarnings, entryAthleteIds } = snapshot
    const boutSnapshot = boutView ?? activeBout

    if (boutSnapshot) {
      return collectEntryMandateWarningAthletes(
        (['red', 'blue'] as const).map((corner) => ({
          corner,
          side: sideForUiCorner(corner, boutSnapshot.bout, boutSnapshot.participants),
        })),
        entryWarnings,
        entryAthleteIds,
      )
    }

    if (nextBout) {
      return collectEntryMandateWarningAthletes(
        [
          { corner: 'red', side: nextBout.sideA },
          { corner: 'blue', side: nextBout.sideB },
        ],
        entryWarnings,
        entryAthleteIds,
      )
    }

    return []
  }, [snapshot, boutView, activeBout, nextBout])

  const focusBout = useCallback(
    async (boutId: string) => {
      if (!holderToken || boutId === activeBout?.boutId) return
      setBusy(true)
      setError(null)
      try {
        const res = await fetch(withBasePath(`/api/admin/bouts/mats/${matIndex}/focus`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ holderToken, boutId }),
        })
        const result = await readJsonResponse<MatControlSnapshot & { error?: string }>(res)
        if (!result.ok) {
          setError(result.error ?? 'Не удалось переключить поединок')
          return
        }
        if (result.data) applySnapshot(result.data)
      } catch {
        setError('Не удалось переключить поединок')
      } finally {
        setBusy(false)
      }
    },
    [holderToken, matIndex, activeBout?.boutId, applySnapshot, setError],
  )

  const clearMatControlDeepLinkParams = useCallback(() => {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    if (!url.searchParams.has('boutId') && !url.searchParams.has('editResult')) return
    url.searchParams.delete('boutId')
    url.searchParams.delete('editResult')
    window.history.replaceState({}, '', `${url.pathname}${url.search}`)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const boutId = params.get('boutId')
    if (boutId) deepLinkFocusRef.current = boutId
    if (params.get('editResult') === '1') {
      deepLinkEditResultRef.current = { boutId: params.get('boutId') }
    }
  }, [])

  useEffect(() => {
    const boutId = deepLinkFocusRef.current
    if (!boutId || !holderToken || !leaseHeld || loading) return

    deepLinkFocusRef.current = null

    if (activeBout?.boutId === boutId) {
      return
    }

    void focusBout(boutId)
  }, [holderToken, leaseHeld, loading, activeBout?.boutId, focusBout])

  useEffect(() => {
    const pendingEditResult = deepLinkEditResultRef.current
    if (!pendingEditResult || !holderToken || !leaseHeld || loading) return
    if (!activeBout || !snapshot?.permissions.canCorrectResult) return
    if (activeBout.execution.boutPhase !== 'confirmed') return
    if (pendingEditResult.boutId && activeBout.boutId !== pendingEditResult.boutId) return

    deepLinkEditResultRef.current = null
    clearMatControlDeepLinkParams()
    setEditResultOpen(true)
  }, [
    holderToken,
    leaseHeld,
    loading,
    activeBout,
    snapshot?.permissions.canCorrectResult,
    clearMatControlDeepLinkParams,
  ])

  const {
    inCorrectionMode,
    showActivityCorrection,
    correctionJournalPeriod,
    hasActiveAthleteWait,
    hasActiveAthleteDoctor,
    hasActiveAthleteEquipment,
    cornerEntry,
  } = useMatControlPhase(boutView)

  const scheduleVersion = snapshot?.scheduleVersion ?? 0
  const focusedQueueEntry = useMemo(() => {
    if (!snapshot || !activeBout?.boutId) return null
    return snapshot.queueInOrder?.find((entry) => entry.bout.id === activeBout.boutId) ?? null
  }, [snapshot, activeBout?.boutId])
  const queueBlockTitle = useMemo(() => {
    const entry = focusedQueueEntry ?? (!activeBout ? snapshot?.queue.nextAvailable : null)
    const reason = entry?.blockedReason
    if (reason === 'NOT_READY') {
      return 'Участники ещё не определены — бой нельзя начать'
    }
    if (reason === 'DEPENDENCY') {
      return 'Ожидает результат другого поединка в сетке'
    }
    return null
  }, [focusedQueueEntry, snapshot?.queue.nextAvailable, activeBout])
  const canFreezeCurrentBout =
    activeBout?.execution.boutPhase === 'live' ||
    activeBout?.execution.boutPhase === 'pending_confirmation' ||
    (activeBout?.execution.boutPhase === 'scheduled' && queueBlockTitle == null) ||
    (!activeBout && nextBout != null && queueBlockTitle == null)
  const freezeGateBlocked =
    (activeBout?.execution.boutPhase === 'scheduled' || (!activeBout && nextBout != null)) &&
    !canFreezeCurrentBout
  const freezeGateTitle = queueBlockTitle ?? 'Поединок нельзя начать'
  const fightTimeEnabled = effectiveControlsEnabled && !freezeGateBlocked
  const fightTimeDisabledReason = freezeGateBlocked ? freezeGateTitle : effectiveDisabledReason
  const clientFightClock = useClientFightClock(
    boutView?.boutId ?? null,
    boutView?.execution.clockState === 'running',
  )
  const { sendCommand } = useMatControlCommands({
    holderToken,
    workingBoutId,
    activeBout,
    scheduleVersion,
    refresh,
    setBusy,
    setError,
    setDisqualifyPending,
    onLeaseLost: takeover,
    boutElapsedMs: clientFightClock.boutElapsedMs,
    clientState,
  })
  useMatControlWalDrain({
    holderToken,
    enabled: leaseHeld && !tabBlocked,
    onDrained: refresh,
  })
  const { commitBout, retryPendingCommit } = useMatControlCommit({
    boutView,
    clientState,
    holderToken,
    injuryScoreAcknowledged,
    refresh,
    onSuccess: async () => {
      await refresh()
      if (boutView) {
        setLifecycleState(await getClientLifecycleState(boutView.boutId))
      }
    },
    onError: setError,
  })

  useEffect(() => {
    if (!boutView?.boutId) {
      setLifecycleState(null)
      return
    }
    void getClientLifecycleState(boutView.boutId).then(setLifecycleState)
  }, [boutView?.boutId, boutView?.execution.boutPhase])

  useEffect(() => {
    const onOnline = () => {
      void retryPendingCommit()
    }
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [retryPendingCommit])

  const { postponeBout } = usePostponeBout({
    holderToken,
    activeBout,
    scheduleVersion,
    refresh,
    setBusy,
    setError,
  })
  const { moveBoutToMat } = useMoveBoutToMat({
    holderToken,
    activeBout,
    refresh,
    setBusy,
    setError,
  })

  const postponeCascadeBoutIds = snapshot?.postponeCascadeBoutIds ?? []
  const moveMatTargetOptions = snapshot?.moveMatTargetOptions ?? []
  const maxPostponeSkip =
    activeBout && snapshot
      ? getMaxPostponeSkip(
          snapshot.pendingMatBoutIds ?? [],
          activeBout.boutId,
          postponeCascadeBoutIds.length > 0 ? new Set(postponeCascadeBoutIds) : undefined,
        )
      : 0
  const canPostponeBout = Boolean(
    activeBout?.execution.boutPhase === 'scheduled' &&
      (maxPostponeSkip > 0 || moveMatTargetOptions.length > 0),
  )
  const canEditBoutTiming = Boolean(
    activeBout &&
      (activeBout.execution.boutPhase === 'scheduled' ||
        activeBout.execution.boutPhase === 'live'),
  )

  const requireCornerEntry = useCallback(
    (corner: Corner) => {
      const p = cornerEntry(corner)
      if (!p) {
        setError('Не удалось определить спортсмена угла')
        return null
      }
      return p
    },
    [cornerEntry, setError],
  )

  const toggleAthleteWait = useCallback(
    (corner: Corner) => {
      const p = requireCornerEntry(corner)
      if (!p || !boutView) return
      const wait = boutView.auxiliaryTimers.athleteWaits?.[corner]
      const intent = wait?.isActive ? 'ATHLETE_WAIT_END' : 'ATHLETE_WAIT_START'
      void sendCommand(intent, p)
    },
    [boutView, requireCornerEntry, sendCommand],
  )

  const toggleAthleteDoctor = useCallback(
    (corner: Corner) => {
      const p = requireCornerEntry(corner)
      if (!p || !boutView) return
      const visit = boutView.auxiliaryTimers.athleteDoctorVisits?.[corner]
      const intent = visit?.isActive ? 'ATHLETE_DOCTOR_END' : 'ATHLETE_DOCTOR_START'
      void sendCommand(intent, p)
    },
    [boutView, requireCornerEntry, sendCommand],
  )

  const toggleAthleteEquipment = useCallback(
    (corner: Corner) => {
      const p = requireCornerEntry(corner)
      if (!p || !boutView) return
      const correction = boutView.auxiliaryTimers.athleteEquipmentCorrections?.[corner]
      const intent = correction?.isActive ? 'ATHLETE_EQUIPMENT_END' : 'ATHLETE_EQUIPMENT_START'
      void sendCommand(intent, p)
    },
    [boutView, requireCornerEntry, sendCommand],
  )

  const sendDisqualify = useCallback(
    async (pending: DisqualifyPending) => {
      const ok = await sendCommand('PENALTY_DISQUALIFY', {
        corner: pending.corner,
        entryId: pending.entryId,
        ladder: pending.ladder,
      })
      if (ok) setDisqualifyPending(null)
    },
    [sendCommand],
  )

  const closeDisqualifyModal = useCallback(() => {
    if (
      disqualifyPending?.ladder === 'PASSIVITY' &&
      boutView?.auxiliaryTimers.passivity?.disqualificationDue
    ) {
      const passivity = boutView.auxiliaryTimers.passivity
      passivityDqDismissedRef.current = `${boutView.boutId}:${passivity.startedAt}:${passivity.corner}`
    }
    setDisqualifyPending(null)
  }, [boutView, disqualifyPending])

  const openDisqualify = useCallback(
    (corner: Corner, ladder: PenaltyLadder) => {
      const p = requireCornerEntry(corner)
      if (!p) return
      setDisqualifyPending({ corner, ladder, entryId: p.entryId })
    },
    [requireCornerEntry],
  )

  const openAuxiliaryOutcome = useCallback(
    (
      kind: AuxiliaryOutcomeKind,
      corner: Corner,
      options?: { entryId?: string; scoreDifference?: number },
    ) => {
      const entryId = options?.entryId ?? requireCornerEntry(corner)?.entryId
      if (kind !== 'clear_advantage' && !entryId) return
      setAuxiliaryOutcomePending({
        kind,
        corner,
        entryId,
        scoreDifference: options?.scoreDifference,
      })
    },
    [requireCornerEntry],
  )

  const confirmAuxiliaryOutcome = useCallback(async () => {
    if (!auxiliaryOutcomePending) return
    const { kind, corner, entryId } = auxiliaryOutcomePending
    const ok =
      kind === 'clear_advantage'
        ? await sendCommand('STOPPAGE_CLEAR_ADVANTAGE', {
            winnerCorner: corner === 'red' ? 'blue' : 'red',
          })
        : await sendCommand(
            kind === 'no_show'
              ? 'NO_SHOW'
              : kind === 'doctor_removal'
                ? 'ATHLETE_DOCTOR_REMOVAL'
                : 'ATHLETE_EQUIPMENT_DISQUALIFY',
            { corner, entryId: entryId! },
          )
    if (ok) setAuxiliaryOutcomePending(null)
  }, [auxiliaryOutcomePending, sendCommand])

  useEffect(() => {
    if (!boutView || !leaseHeld || busy) return
    if (boutView.execution.boutPhase !== 'live') {
      expireSentRef.current = null
      return
    }
    if (boutView.periodRemainingMs > 0) {
      expireSentRef.current = null
      return
    }
    const expireKey = `${boutView.boutId}:${boutView.execution.currentPeriod}:${boutView.execution.liveRevision}`
    if (expireSentRef.current === expireKey) return
    expireSentRef.current = expireKey
    void (async () => {
      const ok = await sendCommand('EXPIRE_PERIOD', {
        period: boutView.execution.currentPeriod,
        periodDurationMs: boutView.periodDurationMs,
      })
      if (!ok) {
        expireSentRef.current = null
      }
    })()
  }, [boutView, busy, leaseHeld, sendCommand])

  useEffect(() => {
    if (!boutView || !leaseHeld || busy) return
    if (boutView.execution.boutPhase !== 'live') {
      passivityPenaltySentRef.current = null
      passivityDqDismissedRef.current = null
      return
    }
    const passivity = boutView.auxiliaryTimers.passivity
    if (!passivity) {
      passivityPenaltySentRef.current = null
      passivityDqDismissedRef.current = null
      return
    }
    if (passivity.disqualificationDue) {
      const dismissKey = `${boutView.boutId}:${passivity.startedAt}:${passivity.corner}`
      if (passivityDqDismissedRef.current !== dismissKey && !disqualifyPending) {
        openDisqualify(passivity.corner, 'PASSIVITY')
      }
      return
    }
    passivityDqDismissedRef.current = null

    const dueTotal = Math.floor(passivity.elapsedMs / 20_000)
    if (dueTotal <= passivity.penaltiesApplied) return

    const key = `${boutView.boutId}:${passivity.startedAt}:${dueTotal}`
    if (passivityPenaltySentRef.current === key) return
    passivityPenaltySentRef.current = key

    void (async () => {
      const ok = await sendCommand(
        'PASSIVITY_APPLY_DUE_PENALTIES',
        {
          corner: passivity.corner,
          entryId: passivity.entryId,
        },
        undefined,
        { silent: true },
      )
      if (!ok) {
        passivityPenaltySentRef.current = null
      }
    })()
  }, [boutView, busy, disqualifyPending, leaseHeld, openDisqualify, sendCommand])

  const skipNextStopSoundRef = useRef(false)

  const requestBoutClockStart = useCallback(
    (action: () => void) => {
      const needsConfirm =
        mandateWarningAthletes.length > 0 &&
        ((!activeBout && nextBout) || activeBout?.execution.boutPhase === 'scheduled')

      if (needsConfirm) {
        mandateFightConfirmActionRef.current = action
        setMandateFightConfirmOpen(true)
        return
      }

      action()
    },
    [activeBout, mandateWarningAthletes, nextBout],
  )

  const confirmMandateFightStart = useCallback(() => {
    const action = mandateFightConfirmActionRef.current
    mandateFightConfirmActionRef.current = null
    setMandateFightConfirmOpen(false)
    action?.()
  }, [])

  const cancelMandateFightStart = useCallback(() => {
    mandateFightConfirmActionRef.current = null
    setMandateFightConfirmOpen(false)
  }, [])

  const toggleFightTime = useCallback(() => {
    if (!activeBout || activeBout.execution.periodCorrectionMode) return
    const running = activeBout.execution.clockState === 'running'
    if (running) {
      skipNextStopSoundRef.current = true
      fightTimerSoundPlayer.unlock()
      clientFightClock.pause()
      void sendCommand('CLOCK_STOP')
      return
    }

    if (freezeGateBlocked) {
      setError(freezeGateTitle)
      return
    }

    requestBoutClockStart(() => {
      fightTimerSoundPlayer.unlock()
      clientFightClock.start()
      void sendCommand('CLOCK_START')
    })
  }, [
    activeBout,
    clientFightClock,
    freezeGateBlocked,
    freezeGateTitle,
    requestBoutClockStart,
    sendCommand,
    setError,
  ])

  const openFinishWizard = useCallback(() => {
    if (!activeBout || activeBout.execution.periodCorrectionMode) return
    if (freezeGateBlocked) {
      setError(freezeGateTitle)
      return
    }
    if (activeBout.execution.clockState === 'running') {
      fightTimerSoundPlayer.unlock()
      void sendCommand('CLOCK_STOP')
    }
    setFinishWizardOpen(true)
  }, [activeBout, freezeGateBlocked, freezeGateTitle, sendCommand, setError])

  const startBoutClock = useCallback(
    (target?: { boutId: string; liveRevision: number; attemptNumber: number }) => {
      requestBoutClockStart(() => {
        fightTimerSoundPlayer.unlock()
        void sendCommand('CLOCK_START', {}, target)
      })
    },
    [requestBoutClockStart, sendCommand],
  )

  const soundsActive = soundEnabled && leaseHeld && snapshotFresh && !inCorrectionMode

  useJudgeFightSounds({
    enabled: soundsActive,
    boutId: activeBout?.boutId ?? null,
    clockState: activeBout?.execution.clockState,
    boutPhase: activeBout?.execution.boutPhase,
    skipNextStopSoundRef,
  })

  useJudgePeriodWarning({
    enabled: soundsActive,
    boutId: activeBout?.boutId ?? null,
    boutPhase: activeBout?.execution.boutPhase,
    clockState: activeBout?.execution.clockState,
    currentPeriod: activeBout?.execution.currentPeriod,
    liveRevision: activeBout?.execution.liveRevision,
    periodRemainingMs: activeBout?.periodRemainingMs,
    snapshotAnchoredAtMs: lastSnapshotAt,
  })

  const keyboardEnabled = useMemo(
    () =>
      effectiveControlsEnabled &&
      !finishWizardOpen &&
      !disqualifyPending &&
      !auxiliaryOutcomePending &&
      !queueDrawerOpen &&
      !journalDrawerOpen &&
      !cornerMenuCorner &&
      !resetBoutOpen &&
      !mandateFightConfirmOpen,
    [
      effectiveControlsEnabled,
      finishWizardOpen,
      disqualifyPending,
      auxiliaryOutcomePending,
      resetBoutOpen,
      queueDrawerOpen,
      journalDrawerOpen,
      cornerMenuCorner,
      mandateFightConfirmOpen,
    ],
  )

  useJudgeKeyboardShortcuts({
    enabled: keyboardEnabled,
    onRedScore: (points) => {
      const p = requireCornerEntry('red')
      if (p) void sendCommand('TECHNICAL_SCORE', { ...p, points })
    },
    onBlueScore: (points) => {
      const p = requireCornerEntry('blue')
      if (p) void sendCommand('TECHNICAL_SCORE', { ...p, points })
    },
    onFightTime: toggleFightTime,
  })

  const cornerOutcomeNames = useCallback(
    (corner: Corner) => {
      const boutSnapshot = boutView ?? activeBout
      if (!boutSnapshot) return null
      const penalized = sideLabel(
        sideForUiCorner(corner, boutSnapshot.bout, boutSnapshot.participants),
      )
      const winner = sideLabel(
        sideForUiCorner(corner === 'red' ? 'blue' : 'red', boutSnapshot.bout, boutSnapshot.participants),
      )
      return { penalized, winner }
    },
    [activeBout, boutView],
  )

  const dqNames = useMemo(() => {
    if (!disqualifyPending) return null
    return (
      cornerOutcomeNames(disqualifyPending.corner) ?? {
        penalized: disqualifyPending.corner === 'red' ? 'Красный' : 'Синий',
        winner: disqualifyPending.corner === 'red' ? 'Синий' : 'Красный',
      }
    )
  }, [cornerOutcomeNames, disqualifyPending])

  const auxiliaryOutcomeNames = useMemo(() => {
    if (!auxiliaryOutcomePending) return null
    const corner = auxiliaryOutcomePending.corner
    return (
      cornerOutcomeNames(corner) ?? {
        penalized: corner === 'red' ? 'Красный' : 'Синий',
        winner: corner === 'red' ? 'Синий' : 'Красный',
      }
    )
  }, [auxiliaryOutcomePending, cornerOutcomeNames])

  const swapCornersContext = activeBout
    ? {
        boutPhase: activeBout.execution.boutPhase,
        redEntryId: activeBout.participants.redEntryId,
        blueEntryId: activeBout.participants.blueEntryId,
      }
    : null
  const showSwapCornersButton = swapCornersContext
    ? shouldShowSwapCornersButton(swapCornersContext)
    : false
  const canSwapCorners = swapCornersContext ? canSwapCornersForBout(swapCornersContext) : false
  const swapCornersBlockReason = swapCornersContext
    ? getSwapCornersBlockReason(swapCornersContext)
    : null

  const footerHistory =
    activeBout && inCorrectionMode ? (
      <JudgeCorrectionJournal
        events={activeBout.events}
        period={correctionJournalPeriod}
        attemptNumber={activeBout.execution.attemptNumber}
        undoCandidate={activeBout.undoCandidate}
        controlsEnabled={effectiveControlsEnabled}
        onUndo={() => void sendCommand('UNDO')}
        onShowFullHistory={
          snapshot?.permissions.role === 'admin' ? () => setJournalDrawerOpen(true) : undefined
        }
      />
    ) : activeBout ? (
      <JudgeActionHistory
        events={activeBout.events}
        attemptNumber={activeBout.execution.attemptNumber}
        undoCandidate={activeBout.undoCandidate}
        controlsEnabled={effectiveControlsEnabled}
        onUndo={() => void sendCommand('UNDO')}
        onShowFullHistory={
          snapshot?.permissions.role === 'admin' ? () => setJournalDrawerOpen(true) : undefined
        }
      />
    ) : null

  const requestSessionHandoff = useCallback(async () => {
    if (!clientState || !workingBoutId) return
    const newClientSessionId = await rotateClientSessionId()
    const res = await fetch(withBasePath(`/api/admin/bouts/${workingBoutId}/session/handoff`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        boutSessionId: clientState.boutSessionId,
        newClientSessionId,
        reason: 'admin_force_takeover',
        suffixDisposition: 'UNKNOWN_FORCE_TAKEOVER',
      }),
    })
    const result = await readJsonResponse<{
      ownershipEpoch: number
      clientSessionId: string
      expectedSequenceNo: number
    }>(res)
    if (!result.ok || !result.data) {
      setError(result.error ?? 'Handoff не выполнен')
      return
    }
    await saveBoutSessionClientState({
      boutId: workingBoutId,
      boutSessionId: clientState.boutSessionId,
      ownershipEpoch: result.data.ownershipEpoch,
      clientSessionId: result.data.clientSessionId,
      nextSequenceNo: result.data.expectedSequenceNo,
      acquireRequestId: clientState.acquireRequestId,
      sessionStatus: snapshot?.boutSession?.sessionStatus ?? clientState.sessionStatus,
      staleAt: null,
    })
    await refresh()
  }, [clientState, refresh, setError, snapshot?.boutSession?.sessionStatus, workingBoutId])

  const requestSessionReclaim = useCallback(
    async (status: 'EXPIRED' | 'CANCELLED') => {
      if (!clientState || !workingBoutId) return
      const res = await fetch(withBasePath(`/api/admin/bouts/${workingBoutId}/session/reclaim`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          boutSessionId: clientState.boutSessionId,
          status,
          reason: status === 'EXPIRED' ? 'STALE_SESSION_RECLAIM' : 'admin_cancelled',
        }),
      })
      const result = await readJsonResponse(res)
      if (!result.ok) {
        setError(result.error ?? 'Reclaim не выполнен')
        return
      }
      await acquireSession()
      await refresh()
    },
    [acquireSession, clientState, refresh, setError, workingBoutId],
  )

  if (tabBlocked) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-lg font-semibold">Mat-control уже открыт в другой вкладке</p>
        <p className="text-sm text-muted">Закройте другую вкладку или используйте только одно окно управления.</p>
      </div>
    )
  }

  return (
    <JudgeModeShell
      serviceBar={
        <JudgeServiceBar
          matIndex={matIndex}
          categoryKey={headerBout?.categoryKey}
          categoryTitle={headerBout?.categoryTitle}
          discipline={headerDiscipline}
          schedulePhase={headerBout?.schedulePhase ?? null}
          boutLabel={headerBout?.label ?? null}
          round={headerBout?.round ?? null}
          roundsUntilFinal={headerBout?.roundsUntilFinal ?? null}
          scheduleDisplayNumber={headerBout?.scheduleDisplayNumber ?? null}
          leaseHeld={leaseHeld}
          snapshotFresh={snapshotFresh}
          onTakeover={() => {
            void takeover().then((ok) => {
              if (ok) fightTimerSoundPlayer.unlock()
            })
          }}
          onReleaseLease={() => void release()}
          fullscreen={fullscreen}
          onToggleFullscreen={() => void toggleFullscreen()}
          soundEnabled={soundEnabled}
          onToggleSound={toggleSound}
          canResetBout={Boolean(snapshot?.permissions.canResetBout && activeBout)}
          canPostponeBout={canPostponeBout}
          controlsEnabled={effectiveControlsEnabled}
          onResetBout={() => setResetBoutOpen(true)}
          onPostponeBout={() => setPostponeBoutOpen(true)}
          showSwapCornersButton={showSwapCornersButton}
          canSwapCorners={canSwapCorners}
          swapCornersDisabledReason={swapCornersBlockReason ?? effectiveDisabledReason}
          onSwapCorners={() => void sendCommand('CORNER_SWAP')}
          canEditBoutTiming={canEditBoutTiming}
          onEditBoutTiming={() => setBoutTimingOpen(true)}
        />
      }
      boutNav={
        snapshot && visibleMatBoutsNav.length > 1 ? (
          <JudgeBoutNavBar
            items={visibleMatBoutsNav}
            activeBoutId={activeBout?.boutId ?? snapshot.session.activeBoutId}
            disabled={!leaseHeld || busy}
            onSelect={(boutId) => void focusBout(boutId)}
          />
        ) : null
      }
      alerts={
        <>
          {leaseError ? (
            <p
              className="shrink-0 border-l-4 border-destructive bg-destructive/10 px-4 py-2 text-sm font-medium text-destructive"
              data-testid="judge-lease-error"
            >
              {leaseError}
            </p>
          ) : null}
          {!effectiveControlsEnabled && effectiveDisabledReason ? (
            <p
              className="shrink-0 border-l-4 border-warning bg-warning-soft px-4 py-2 text-sm font-medium text-warning-foreground"
              data-testid="judge-disabled-reason"
            >
              {effectiveDisabledReason}
              {!snapshotFresh && !browsingOtherBout ? ' Ввод временно заблокирован.' : null}
            </p>
          ) : null}
          {isStale ? (
            <div
              className="shrink-0 flex flex-wrap items-center justify-between gap-2 border-l-4 border-warning bg-warning-soft px-4 py-2 text-sm text-warning-foreground"
              data-testid="judge-stale-session"
            >
              <span>Сессия боя помечена как устаревшая — команды могут быть отклонены.</span>
              {snapshot?.permissions.role === 'admin' ? (
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="secondary" onClick={() => void requestSessionHandoff()}>
                    Handoff
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void requestSessionReclaim('EXPIRED')}
                  >
                    Reclaim (EXPIRED)
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
          {lifecycleState === 'PENDING_SYNC' ? (
            <div
              className="shrink-0 flex flex-wrap items-center justify-between gap-2 border-l-4 border-warning bg-warning-soft px-4 py-2 text-sm text-warning-foreground"
              data-testid="judge-pending-sync"
            >
              <span>Результат сохранён локально — ожидается синхронизация с сервером.</span>
              <Button type="button" variant="secondary" onClick={() => void retryPendingCommit()}>
                Повторить commit
              </Button>
            </div>
          ) : null}
          {lifecycleState === 'FINISHED_LOCALLY' ? (
            <p className="shrink-0 border-l-4 border-info bg-info/10 px-4 py-2 text-sm text-info-foreground">
              Результат зафиксирован локально — отправка на сервер…
            </p>
          ) : null}
          {error ? (
            <p className="shrink-0 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </>
      }
      footer={
        activeBout && snapshot ? (
          <JudgeFooterStrips
            history={footerHistory}
            queue={
              <JudgeQueueStrip
                snapshot={snapshot}
                muted={inCorrectionMode}
                onShowFullQueue={() => setQueueDrawerOpen(true)}
              />
            }
          />
        ) : null
      }
    >
      {loading ? <p className="text-sm text-muted">Загрузка…</p> : null}

      {!activeBout && nextBout ? (
        <div className="rounded-xl border border-border p-4">
          <p className="text-center text-sm text-muted">Следующий поединок готов</p>
          <div className="mx-auto mt-3 max-w-3xl truncate text-center">
            <JudgeQueueNextPair
              bout={nextBout}
              compact
              entryWarnings={snapshot?.entryWarnings ?? {}}
            />
          </div>
          <div className="mt-4 text-center">
          <Button
            className="mt-3"
            disabled={!fightTimeEnabled}
            title={!fightTimeEnabled ? fightTimeDisabledReason : undefined}
            onClick={() =>
              startBoutClock({ boutId: nextBout.id, liveRevision: 0, attemptNumber: 1 })
            }
          >
            Начать поединок
          </Button>
          </div>
        </div>
      ) : null}

      <JudgePhaseStage
        activeBout={boutView}
        prep={null}
        live={
          boutView ? (
        <JudgeLiveView
          activeBout={boutView}
          entryWarnings={snapshot?.entryWarnings ?? {}}
          entryAthleteIds={snapshot?.entryAthleteIds ?? {}}
          controlsEnabled={effectiveControlsEnabled}
          disabledReason={effectiveDisabledReason}
          fightTimeEnabled={fightTimeEnabled}
          fightTimeDisabledReason={fightTimeDisabledReason}
          showAthleteWait={
            boutView.execution.boutPhase === 'scheduled' ||
            boutView.execution.boutPhase === 'live'
          }
          showAthleteDoctor={
            boutView.execution.boutPhase === 'scheduled' ||
            boutView.execution.boutPhase === 'live'
          }
          showAthleteEquipment={
            boutView.execution.boutPhase === 'scheduled' ||
            boutView.execution.boutPhase === 'live'
          }
          onAthleteWait={toggleAthleteWait}
          onAthleteDoctor={toggleAthleteDoctor}
          onAthleteDoctorRemoval={(corner) => openAuxiliaryOutcome('doctor_removal', corner)}
          onAthleteEquipment={toggleAthleteEquipment}
          onAthleteEquipmentDisqualify={(corner) =>
            openAuxiliaryOutcome('equipment_disqualify', corner)
          }
          onAthleteNoShow={(corner) => openAuxiliaryOutcome('no_show', corner)}
          onScore={(corner, points, action) => {
            const p = requireCornerEntry(corner)
            if (p) void sendCommand('TECHNICAL_SCORE', { ...p, points, ...(action ? { action } : {}) })
          }}
          onPenaltyNext={(intent, corner) => {
            const p = requireCornerEntry(corner)
            if (p) void sendCommand(intent, p)
          }}
          onDisqualify={(corner, ladder) => openDisqualify(corner, ladder)}
          onPassivity={(corner) => {
            const p = requireCornerEntry(corner)
            if (!p) return
            const passivityTimer = boutView?.auxiliaryTimers.passivity
            const active =
              passivityTimer?.corner === corner && passivityTimer.entryId === p.entryId
            void sendCommand(active ? 'PASSIVITY_END' : 'PASSIVITY_START', p)
          }}
          onFightTime={toggleFightTime}
          onFinishBout={freezeGateBlocked ? undefined : openFinishWizard}
          onOpenCornerOverflow={(corner) => setCornerMenuCorner(corner)}
          onFinishPeriodCorrection={() => void sendCommand('FINISH_PERIOD_CORRECTION')}
          onClearAdvantage={() => {
            const winnerCorner = activeBout.hints.leadingCorner
            const scoreDifference = activeBout.hints.scoreDifference
            if (!winnerCorner || scoreDifference == null) return
            const loserCorner = winnerCorner === 'red' ? 'blue' : 'red'
            openAuxiliaryOutcome('clear_advantage', loserCorner, { scoreDifference })
          }}
        />
          ) : null
        }
        activityCorrection={
          showActivityCorrection && boutView ? (
        <JudgeActivityCorrectionView
          activeBout={boutView}
          controlsEnabled={effectiveControlsEnabled}
          disabledReason={effectiveDisabledReason}
          onScore={(corner, points, action) => {
            const p = requireCornerEntry(corner)
            if (p) void sendCommand('TECHNICAL_SCORE', { ...p, points, ...(action ? { action } : {}) })
          }}
          onPenaltyNext={(intent, corner) => {
            const p = requireCornerEntry(corner)
            if (p) void sendCommand(intent, p)
          }}
          onDisqualify={(corner, ladder) => openDisqualify(corner, ladder)}
          onFinish={() => void sendCommand('FINISH_ACTIVITY_CORRECTION')}
          onCancel={() => void sendCommand('CORRECT_BEFORE_ACTIVITY', { enable: false })}
        />
          ) : null
        }
        activity={
          boutView ? (
        <JudgeActivityView
          activeBout={boutView}
          entryWarnings={snapshot?.entryWarnings ?? {}}
          entryAthleteIds={snapshot?.entryAthleteIds ?? {}}
          controlsEnabled={effectiveControlsEnabled}
          busy={busy}
          onDecide={async (corner) => {
            await sendCommand('EXTRA_ACTIVITY_DECIDE', { winnerCorner: corner })
          }}
          onCorrectExtra={() => void sendCommand('CORRECT_BEFORE_ACTIVITY', { enable: true })}
        />
          ) : null
        }
        confirmation={
          boutView && snapshot ? (
        <JudgeConfirmationView
          activeBout={boutView}
          snapshot={snapshot}
          controlsEnabled={effectiveControlsEnabled}
          confirmDisabledReason={confirmDisabledReason}
          confirmValidationWarnings={confirmValidationWarnings.map((i) => i.message)}
          showInjuryScoreAck={showInjuryScoreAck}
          injuryScoreAcknowledged={injuryScoreAcknowledged}
          onInjuryScoreAckChange={setInjuryScoreAcknowledged}
          fightClockStarted={boutView.fightClockStarted}
          onConfirm={() => {
            if (clientState) {
              void commitBout()
              return
            }
            void sendCommand('CONFIRM', {
              ...(injuryScoreAcknowledged ? { injuryScoreAcknowledged: true } : {}),
            })
          }}
          onCancelStoppage={() => void sendCommand('CANCEL_STOPPAGE')}
          onOpenNextBout={() => {
            if (snapshot.queue.nextAvailable?.bout) {
              void sendCommand('OPEN_NEXT_BOUT')
            }
          }}
          onEditResult={
            snapshot.permissions.canCorrectResult ? () => setEditResultOpen(true) : undefined
          }
        />
          ) : null
        }
      />

      <BoutFinishWizard
        open={finishWizardOpen}
        busy={busy}
        fightClockStarted={boutView?.fightClockStarted ?? false}
        redSide={activeBout?.bout.sideA ?? { kind: 'hint', label: 'Красный' }}
        blueSide={activeBout?.bout.sideB ?? { kind: 'hint', label: 'Синий' }}
        redEntryId={activeBout?.participants.redEntryId}
        blueEntryId={activeBout?.participants.blueEntryId}
        onClose={() => setFinishWizardOpen(false)}
        onSubmit={async ({ intent, payload }) => {
          await sendCommand(intent, payload)
        }}
        onDisqualify={(corner, ladder) => {
          setFinishWizardOpen(false)
          openDisqualify(corner, ladder)
        }}
      />

      <ResetBoutConfirmModal
        open={resetBoutOpen}
        busy={busy}
        scheduleDisplayNumber={activeBout?.bout.scheduleDisplayNumber}
        onClose={() => setResetBoutOpen(false)}
        onConfirm={async () => {
          const ok = await sendCommand('RESET_BOUT')
          if (ok) setResetBoutOpen(false)
        }}
      />

      <JudgeBoutTimingModal
        open={boutTimingOpen}
        busy={busy}
        mainPeriodDurationMs={activeBout?.mainPeriodDurationMs ?? activeBout?.periodDurationMs ?? 180_000}
        extraPeriodDurationMs={activeBout?.extraPeriodDurationMs ?? activeBout?.periodDurationMs ?? 180_000}
        defaultPeriodDurationMs={activeBout?.defaultPeriodDurationMs ?? activeBout?.periodDurationMs ?? 180_000}
        periodCount={activeBout?.periodCount ?? 2}
        currentPeriod={activeBout?.execution.currentPeriod ?? 'main'}
        onClose={() => setBoutTimingOpen(false)}
        onConfirm={async ({ mainDurationMs, extraDurationMs, periodCount }) => {
          const ok = await sendCommand('SET_BOUT_TIMING', {
            mainDurationMs,
            extraDurationMs,
            periodCount,
          })
          if (ok) setBoutTimingOpen(false)
        }}
      />

      <PostponeBoutModal
        open={postponeBoutOpen}
        busy={busy}
        scheduleDisplayNumber={activeBout?.bout.scheduleDisplayNumber}
        maxSkip={maxPostponeSkip}
        targetMats={moveMatTargetOptions}
        cascadeCount={postponeCascadeBoutIds.length}
        onClose={() => setPostponeBoutOpen(false)}
        onConfirmSkip={async (postponeBy) => {
          const ok = await postponeBout(postponeBy)
          if (ok) setPostponeBoutOpen(false)
        }}
        onConfirmMoveMat={async (targetMatIndex) => {
          const ok = await moveBoutToMat(targetMatIndex)
          if (ok) setPostponeBoutOpen(false)
        }}
      />

      <JudgeMandateFightConfirmModal
        open={mandateFightConfirmOpen}
        athletes={mandateWarningAthletes}
        onCancel={cancelMandateFightStart}
        onConfirm={confirmMandateFightStart}
      />

      {disqualifyPending ? (
        <DisqualifyConfirmModal
          open
          busy={busy}
          corner={disqualifyPending.corner}
          ladder={disqualifyPending.ladder}
          penalizedName={dqNames?.penalized ?? (disqualifyPending.corner === 'red' ? 'Красный' : 'Синий')}
          winnerName={dqNames?.winner ?? (disqualifyPending.corner === 'red' ? 'Синий' : 'Красный')}
          onClose={closeDisqualifyModal}
          onConfirm={async () => {
            await sendDisqualify(disqualifyPending)
          }}
        />
      ) : null}

      {auxiliaryOutcomePending ? (
        <AuxiliaryOutcomeConfirmModal
          open
          busy={busy}
          kind={auxiliaryOutcomePending.kind}
          corner={auxiliaryOutcomePending.corner}
          penalizedName={
            auxiliaryOutcomeNames?.penalized ??
            (auxiliaryOutcomePending.corner === 'red' ? 'Красный' : 'Синий')
          }
          winnerName={
            auxiliaryOutcomeNames?.winner ??
            (auxiliaryOutcomePending.corner === 'red' ? 'Синий' : 'Красный')
          }
          scoreDifference={auxiliaryOutcomePending.scoreDifference}
          onClose={() => setAuxiliaryOutcomePending(null)}
          onConfirm={confirmAuxiliaryOutcome}
        />
      ) : null}

      {cornerMenuCorner ? (
        <CornerOverflowMenu
          corner={cornerMenuCorner}
          open
          onClose={() => setCornerMenuCorner(null)}
          onDisqualify={(ladder) => openDisqualify(cornerMenuCorner, ladder)}
        />
      ) : null}

      {queueDrawerOpen && snapshot ? (
        <JudgeQueueDrawer
          open
          snapshot={snapshot}
          showCompleted={showCompletedMatBouts}
          onShowCompletedChange={setShowCompletedMatBouts}
          onClose={() => setQueueDrawerOpen(false)}
          onFocusBout={(boutId) => {
            void focusBout(boutId)
            setQueueDrawerOpen(false)
          }}
          focusDisabled={!leaseHeld || busy}
        />
      ) : null}

      {journalDrawerOpen && activeBout ? (
        <JudgeTechnicalJournalDrawer
          open
          events={activeBout.events}
          onClose={() => setJournalDrawerOpen(false)}
        />
      ) : null}

      {snapshot?.permissions.canCorrectResult && activeBout ? (
        <EditBoutResultDialog
          open={editResultOpen}
          boutId={activeBout.boutId}
          categoryKey={activeBout.bout.categoryKey}
          systemId={activeBout.correctionMeta.systemId}
          schedulePhase={activeBout.bout.schedulePhase}
          redEntryId={activeBout.participants.redEntryId}
          blueEntryId={activeBout.participants.blueEntryId}
          currentWinnerEntryId={activeBout.decisionPreview?.winnerEntryId ?? null}
          downstreamBoutIds={activeBout.correctionMeta.downstreamBoutIds}
          onClose={() => {
            setEditResultOpen(false)
            if (
              correctionFocusActive &&
              snapshot.matInProgressBoutId &&
              snapshot.matInProgressBoutId !== activeBout.boutId
            ) {
              void focusBout(snapshot.matInProgressBoutId)
            }
          }}
          onApplied={() => {
            void refresh()
            if (
              correctionFocusActive &&
              snapshot.matInProgressBoutId &&
              snapshot.matInProgressBoutId !== activeBout.boutId
            ) {
              void focusBout(snapshot.matInProgressBoutId)
            }
          }}
        />
      ) : null}
    </JudgeModeShell>
  )
}
