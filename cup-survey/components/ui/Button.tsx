'use client'

import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'emphasis'> & {
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'md' | 'lg'
  emphasis?: 'default' | 'high'
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant = 'primary',
    size = 'md',
    emphasis = 'default',
    loading,
    disabled,
    children,
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center rounded-lg px-5 py-2.5 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:ring-offset-2 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100',
        emphasis === 'default' && size === 'md' && 'min-h-11 text-sm font-semibold',
        emphasis === 'default' &&
          size === 'lg' &&
          'min-h-[3.25rem] text-base font-bold tracking-[0.02em] uppercase',
        emphasis === 'high' &&
          'min-h-[3.25rem] max-sm:min-h-12 text-[1.0625rem] max-sm:text-base font-extrabold uppercase tracking-[0.04em] shadow-[0_4px_14px_rgb(from_var(--color-accent)_r_g_b/0.28)]',
        variant === 'primary' &&
          'bg-accent text-white shadow-sm shadow-accent/20 hover:bg-accent-hover hover:shadow-md hover:shadow-accent/25',
        variant === 'secondary' &&
          'border border-border bg-card text-foreground shadow-sm hover:border-accent/25 hover:bg-background-soft',
        variant === 'ghost' && 'text-foreground hover:bg-background-soft',
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? 'Загрузка…' : children}
    </button>
  )
})
