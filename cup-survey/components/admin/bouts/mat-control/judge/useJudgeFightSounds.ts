'use client'

import type { MutableRefObject } from 'react'
import { useEffect, useRef } from 'react'
import type { BoutPhase, ClockState } from '@/lib/bouts/mat-control/types'
import {
  fightTimerSoundPlayer,
  JUDGE_BOUT_END_SOUND,
  JUDGE_BOUT_START_SOUND,
} from '@/lib/bouts/mat-control/sounds/fightTimerSounds'

export function useJudgeFightSounds(input: {
  enabled: boolean
  boutId: string | null
  clockState: ClockState | null | undefined
  boutPhase: BoutPhase | null | undefined
  /** Set before CLOCK_STOP from the ФАЙТ button to skip the pause bell. */
  skipNextStopSoundRef?: MutableRefObject<boolean>
}) {
  const prevClock = useRef<ClockState | null>(null)
  const prevBoutId = useRef<string | null>(null)

  useEffect(() => {
    if (!input.enabled || input.boutPhase !== 'live' || !input.clockState) {
      prevClock.current = input.clockState ?? null
      return
    }

    if (input.boutId !== prevBoutId.current) {
      prevBoutId.current = input.boutId
      prevClock.current = input.clockState
      return
    }

    const previous = prevClock.current
    if (previous !== null && previous !== input.clockState) {
      if (input.clockState === 'running') {
        void fightTimerSoundPlayer.play(JUDGE_BOUT_START_SOUND)
      } else if (previous === 'running') {
        const skipPause =
          input.clockState === 'stopped' && input.skipNextStopSoundRef?.current === true
        if (input.skipNextStopSoundRef?.current) {
          input.skipNextStopSoundRef.current = false
        }
        if (!skipPause) {
          void fightTimerSoundPlayer.play(JUDGE_BOUT_END_SOUND)
        }
      }
    }

    prevClock.current = input.clockState
  }, [input.enabled, input.boutId, input.clockState, input.boutPhase, input.skipNextStopSoundRef])
}
