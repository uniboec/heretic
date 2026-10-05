'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { ViewBracketCategoryButton } from './ViewBracketCategoryButton'

export function PublicCategoryBracketHeader({
  categoryKey,
  categoryTitle,
  titleClassName,
  className,
  layout = 'inline',
  trailing,
}: {
  categoryKey: string
  categoryTitle: string
  titleClassName?: string
  className?: string
  layout?: 'inline' | 'stacked'
  trailing?: ReactNode
}) {
  if (layout === 'stacked') {
    return (
      <div className={cn('space-y-2', className)}>
        <h2
          className={cn(
            'text-sm font-semibold leading-snug text-foreground [overflow-wrap:anywhere]',
            titleClassName,
          )}
        >
          {categoryTitle}
        </h2>
        <div className="flex items-center justify-between gap-3">
          <ViewBracketCategoryButton
            categoryKey={categoryKey}
            categoryTitle={categoryTitle}
            variant="public"
            className="shrink-0"
          />
          {trailing ? <div className="shrink-0 text-right">{trailing}</div> : null}
        </div>
      </div>
    )
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <h2
        className={cn(
          'min-w-0 flex-1 text-sm font-semibold leading-snug text-foreground',
          titleClassName,
        )}
      >
        {categoryTitle}
      </h2>
      <ViewBracketCategoryButton
        categoryKey={categoryKey}
        categoryTitle={categoryTitle}
        variant="public"
        className="shrink-0"
      />
    </div>
  )
}
