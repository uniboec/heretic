'use client'

import { useCallback, useRef, useState } from 'react'

export type AnimatedResolvePhase = 'glow'

export type AnimatedResolveState = {
  phase: AnimatedResolvePhase
  kind: 'success' | 'skip'
}

const GLOW_MS = 480

export function useAnimatedResolve() {
  const [animating, setAnimating] = useState<Record<string, AnimatedResolveState>>({})
  const timersRef = useRef<Map<string, number>>(new Map())

  const clearTimer = useCallback((id: string) => {
    const timer = timersRef.current.get(id)
    if (timer != null) {
      window.clearTimeout(timer)
      timersRef.current.delete(id)
    }
  }, [])

  const runAnimated = useCallback(
    async (id: string, action: () => Promise<void>, kind: 'success' | 'skip' = 'success') => {
      clearTimer(id)

      try {
        await action()
      } catch (error) {
        throw error
      }

      setAnimating((current) => ({ ...current, [id]: { phase: 'glow', kind } }))

      await new Promise<void>((resolve) => {
        const timer = window.setTimeout(resolve, GLOW_MS)
        timersRef.current.set(`${id}:glow`, timer)
      })

      setAnimating((current) => {
        const next = { ...current }
        delete next[id]
        return next
      })
      clearTimer(`${id}:glow`)
    },
    [clearTimer],
  )

  return { animating, runAnimated }
}
