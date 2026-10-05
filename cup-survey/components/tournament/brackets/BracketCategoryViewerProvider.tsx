'use client'

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import {
  BracketCategoryViewerModal,
  type BracketCategoryViewerRequest,
} from './BracketCategoryViewerModal'

type OpenBracketInput = {
  categoryKey: string
  categoryTitle?: string | null
  variant: 'admin' | 'public'
  live?: boolean
}

type BracketCategoryViewerContextValue = {
  openBracket: (input: OpenBracketInput) => void
  closeBracket: () => void
}

const BracketCategoryViewerContext = createContext<BracketCategoryViewerContextValue | null>(null)

export function BracketCategoryViewerProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<BracketCategoryViewerRequest | null>(null)

  const openBracket = useCallback((input: OpenBracketInput) => {
    setRequest({
      categoryKey: input.categoryKey,
      categoryTitle: input.categoryTitle ?? null,
      variant: input.variant,
      live: input.live,
    })
  }, [])

  const closeBracket = useCallback(() => {
    setRequest(null)
  }, [])

  const value = useMemo(
    () => ({
      openBracket,
      closeBracket,
    }),
    [openBracket, closeBracket],
  )

  return (
    <BracketCategoryViewerContext.Provider value={value}>
      {children}
      <BracketCategoryViewerModal request={request} onClose={closeBracket} />
    </BracketCategoryViewerContext.Provider>
  )
}

export function useBracketCategoryViewer(): BracketCategoryViewerContextValue {
  const context = useContext(BracketCategoryViewerContext)
  if (!context) {
    throw new Error('useBracketCategoryViewer must be used within BracketCategoryViewerProvider')
  }
  return context
}
