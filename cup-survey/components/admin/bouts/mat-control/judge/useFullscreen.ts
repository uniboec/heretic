'use client'

import { useCallback, useEffect, useState } from 'react'

export function useFullscreen() {
  const [fullscreen, setFullscreen] = useState(false)

  useEffect(() => {
    function onChange() {
      setFullscreen(Boolean(document.fullscreenElement))
    }
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const toggle = useCallback(async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen()
      return
    }
    await document.documentElement.requestFullscreen()
  }, [])

  return { fullscreen, toggle }
}
