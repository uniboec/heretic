'use client'

import { useCallback, useEffect, useState } from 'react'
import { fightTimerSoundPlayer } from '@/lib/bouts/mat-control/sounds/fightTimerSounds'

const STORAGE_KEY = 'judge-console-sound-enabled'

function readSoundEnabled(): boolean {
  if (typeof window === 'undefined') return true
  return localStorage.getItem(STORAGE_KEY) !== '0'
}

export function useJudgeSoundEnabled() {
  const [soundEnabled, setSoundEnabledState] = useState(true)

  useEffect(() => {
    const enabled = readSoundEnabled()
    setSoundEnabledState(enabled)
    fightTimerSoundPlayer.setEnabled(enabled)
  }, [])

  const setSoundEnabled = useCallback((enabled: boolean) => {
    setSoundEnabledState(enabled)
    fightTimerSoundPlayer.setEnabled(enabled)
    localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0')
  }, [])

  const toggleSound = useCallback(() => {
    setSoundEnabled(!soundEnabled)
  }, [setSoundEnabled, soundEnabled])

  return { soundEnabled, setSoundEnabled, toggleSound }
}
