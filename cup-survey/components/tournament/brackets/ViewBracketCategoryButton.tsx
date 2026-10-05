'use client'

import { LayoutGrid } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { adminBoutsIconBtn } from '@/lib/ui/adminSurfaceStyles'
import { useBracketCategoryViewer } from './BracketCategoryViewerProvider'

export function ViewBracketCategoryButton({
  categoryKey,
  categoryTitle,
  variant,
  live = true,
  label = 'Сетка',
  className,
  size = 'sm',
  iconOnly = false,
}: {
  categoryKey: string
  categoryTitle?: string | null
  variant: 'admin' | 'public'
  live?: boolean
  label?: string
  className?: string
  size?: 'sm' | 'md'
  iconOnly?: boolean
}) {
  const { openBracket } = useBracketCategoryViewer()

  return (
    <Button
      type="button"
      variant="ghost"
      className={cn(
        'cursor-pointer',
        iconOnly
          ? adminBoutsIconBtn
          : size === 'sm'
            ? 'h-7 px-2 text-[11px]'
            : 'h-8 px-2.5 text-xs',
        className,
      )}
      aria-label={iconOnly ? label : undefined}
      title={iconOnly ? label : undefined}
      onClick={() =>
        openBracket({
          categoryKey,
          categoryTitle,
          variant,
          live,
        })
      }
    >
      <LayoutGrid
        className={cn(
          'shrink-0 opacity-80',
          iconOnly ? 'h-4 w-4' : 'mr-1 h-3.5 w-3.5',
        )}
        aria-hidden="true"
      />
      {iconOnly ? null : label}
    </Button>
  )
}
