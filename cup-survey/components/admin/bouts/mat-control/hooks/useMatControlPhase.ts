'use client'

import { useMemo } from 'react'
import { entryIdForCorner } from '@/lib/bouts/assertBoutParticipantCorner'
import type { MatControlBoutSnapshot } from '@/lib/bouts/matControlSnapshot'
import type { Corner } from '@/lib/bouts/mat-control/types'

export function useMatControlPhase(activeBout: MatControlBoutSnapshot | null) {
  const inCorrectionMode = Boolean(
    activeBout?.execution.periodCorrectionMode || activeBout?.execution.activityCorrectionMode,
  )

  const showActivityCorrection = Boolean(
    activeBout?.execution.activityCorrectionMode &&
      activeBout.execution.boutPhase === 'pending_activity_decision',
  )

  const correctionJournalPeriod =
    activeBout?.execution.activityCorrectionMode ||
    activeBout?.execution.currentPeriod === 'extra'
      ? 'extra'
      : 'main'

  const hasActiveAthleteWait = useMemo(() => {
    if (!activeBout) return false
    return Boolean(
      activeBout.auxiliaryTimers.athleteWaits?.red?.isActive ||
        activeBout.auxiliaryTimers.athleteWaits?.blue?.isActive,
    )
  }, [activeBout])

  const hasActiveAthleteDoctor = useMemo(() => {
    if (!activeBout) return false
    return Boolean(
      activeBout.auxiliaryTimers.athleteDoctorVisits?.red?.isActive ||
        activeBout.auxiliaryTimers.athleteDoctorVisits?.blue?.isActive,
    )
  }, [activeBout])

  const hasActiveAthleteEquipment = useMemo(() => {
    if (!activeBout) return false
    return Boolean(
      activeBout.auxiliaryTimers.athleteEquipmentCorrections?.red?.isActive ||
        activeBout.auxiliaryTimers.athleteEquipmentCorrections?.blue?.isActive,
    )
  }, [activeBout])

  const canAdjustClock = Boolean(
    activeBout?.execution.boutPhase === 'live' &&
      activeBout.execution.clockState === 'stopped' &&
      !activeBout.execution.periodCorrectionMode,
  )

  function cornerEntry(corner: Corner) {
    if (!activeBout) return null
    const entryId = entryIdForCorner(corner, activeBout.participants)
    return entryId ? { entryId, corner } : null
  }

  return {
    inCorrectionMode,
    showActivityCorrection,
    correctionJournalPeriod,
    hasActiveAthleteWait,
    hasActiveAthleteDoctor,
    hasActiveAthleteEquipment,
    canAdjustClock,
    cornerEntry,
  }
}
