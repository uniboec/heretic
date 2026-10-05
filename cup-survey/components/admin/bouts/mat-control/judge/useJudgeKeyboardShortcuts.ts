'use client'

import { useEffect } from 'react'

export function useJudgeKeyboardShortcuts(input: {
  enabled: boolean
  onRedScore: (points: 1 | 2 | 3 | 4) => void
  onBlueScore: (points: 1 | 2 | 3 | 4) => void
  onFightTime: () => void
}) {
  useEffect(() => {
    if (!input.enabled) return

    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return
      }
      if (event.repeat) return

      if (event.key === '1') input.onRedScore(1)
      else if (event.key === '2') input.onRedScore(2)
      else if (event.key === '3') input.onRedScore(3)
      else if (event.key === '4') input.onRedScore(4)
      else if (event.key.toLowerCase() === 'q') input.onBlueScore(1)
      else if (event.key.toLowerCase() === 'w') input.onBlueScore(2)
      else if (event.key.toLowerCase() === 'e') input.onBlueScore(3)
      else if (event.key.toLowerCase() === 'r') input.onBlueScore(4)
      else if (event.code === 'Space') {
        event.preventDefault()
        input.onFightTime()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [input])
}
