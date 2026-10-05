'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

export function useSyncedDraft<T>(serverValue: T, isEqual?: (a: T, b: T) => boolean) {
  const equals = useMemo(
    () => isEqual ?? ((a: T, b: T) => JSON.stringify(a) === JSON.stringify(b)),
    [isEqual],
  )
  const [draft, setDraft] = useState(serverValue)
  const isDirty = !equals(draft, serverValue)

  useEffect(() => {
    if (!isDirty) {
      setDraft(serverValue)
    }
  }, [serverValue, isDirty, equals])

  const updateDraft = useCallback((next: T | ((current: T) => T)) => {
    setDraft((current) => (typeof next === 'function' ? (next as (c: T) => T)(current) : next))
  }, [])

  const acceptServerValue = useCallback((next: T) => {
    setDraft(next)
  }, [])

  return { draft, updateDraft, isDirty, acceptServerValue }
}
