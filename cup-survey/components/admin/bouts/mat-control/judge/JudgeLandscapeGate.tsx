'use client'

import { useEffect, useState } from 'react'
import { judgeStyles } from './judgeModeStyles'

const MIN_WIDTH_PX = 1024

export function useJudgeLandscapeOk(): boolean {
  const [ok, setOk] = useState(true)

  useEffect(() => {
    const check = () => setOk(window.innerWidth >= MIN_WIDTH_PX)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  return ok
}

export function JudgeLandscapeGate({ children }: { children: React.ReactNode }) {
  const landscapeOk = useJudgeLandscapeOk()

  if (!landscapeOk) {
    return (
      <div className={judgeStyles.landscapeGate}>
        <p className="text-lg font-bold text-foreground">Поверните устройство горизонтально</p>
        <p className="mt-2 max-w-sm text-sm text-muted">
          Судейский пульт рассчитан на landscape-режим для одновременного сравнения красного и синего
          углов.
        </p>
      </div>
    )
  }

  return <>{children}</>
}
