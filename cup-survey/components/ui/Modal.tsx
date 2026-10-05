'use client'

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

const ANIMATION_MS = 240

type ModalLayer = 'base' | 'nested'
type ModalSize = 'sm' | 'md' | 'lg' | 'xl'
type ModalIntent = 'default' | 'confirm' | 'danger'

const MODAL_SIZE_CLASS: Record<ModalSize, string> = {
  sm: 'w-full max-w-sm',
  md: 'w-full max-w-[30rem]',
  lg: 'w-full max-w-lg',
  xl: 'w-full max-w-[min(96vw,72rem)]',
}

const MODAL_INTENT_CLASS: Record<ModalIntent, string> = {
  default:
    'overflow-hidden rounded-t-xl border border-border bg-card shadow-[0_20px_40px_rgb(0_0_0/0.12)] sm:rounded-xl',
  confirm:
    'rounded-xl border border-border bg-card p-5 shadow-[0_20px_40px_rgb(0_0_0/0.12)]',
  danger:
    'rounded-xl border border-[rgb(from_var(--color-accent)_r_g_b/0.45)] bg-card p-5 shadow-[0_20px_40px_rgb(0_0_0/0.12)]',
}

interface ModalProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  overlayClassName?: string
  panelClassName?: string
  panelStyle?: CSSProperties
  ariaLabelledBy?: string
  layer?: ModalLayer
  size?: ModalSize
  intent?: ModalIntent
  /** When false, overlay click and Escape do not call onClose. */
  dismissible?: boolean
}

let openModalCount = 0
let savedPaddingRight = ''
let savedScrollY = 0

function lockBodyScroll() {
  if (openModalCount === 0) {
    savedScrollY = window.scrollY
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
    savedPaddingRight = document.body.style.paddingRight
    document.body.style.position = 'fixed'
    document.body.style.top = `-${savedScrollY}px`
    document.body.style.left = '0'
    document.body.style.right = '0'
    document.body.style.width = '100%'
    document.body.style.overflow = 'hidden'
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`
    }
  }
  openModalCount += 1
}

function unlockBodyScroll() {
  openModalCount = Math.max(0, openModalCount - 1)
  if (openModalCount === 0) {
    document.body.style.position = ''
    document.body.style.top = ''
    document.body.style.left = ''
    document.body.style.right = ''
    document.body.style.width = ''
    document.body.style.overflow = ''
    document.body.style.paddingRight = savedPaddingRight
    window.scrollTo(0, savedScrollY)
  }
}

export function Modal({
  open,
  onClose,
  children,
  overlayClassName,
  panelClassName,
  panelStyle,
  ariaLabelledBy,
  layer = 'base',
  size = 'md',
  intent = 'default',
  dismissible = true,
}: ModalProps) {
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!open) return
    lockBodyScroll()
    return () => unlockBodyScroll()
  }, [open])

  useEffect(() => {
    if (open) {
      setMounted(true)
      const frame = requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true))
      })
      return () => cancelAnimationFrame(frame)
    }

    setVisible(false)
    const timer = window.setTimeout(() => {
      setMounted(false)
    }, ANIMATION_MS)
    return () => clearTimeout(timer)
  }, [open])

  useEffect(() => {
    if (!open || !mounted) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (dismissible && event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, mounted, onClose, dismissible])

  if (!mounted) return null

  return (
    <div
      data-modal-overlay
      data-open={visible || undefined}
      className={cn(
        'fixed inset-0 flex items-end justify-center bg-black/45 p-0 opacity-0 transition-opacity duration-[240ms] ease-[ease]',
        layer === 'base' ? 'z-[var(--z-modal)]' : 'z-[var(--z-modal-nested)]',
        'sm:items-center sm:p-4',
        visible && 'opacity-100',
        overlayClassName,
      )}
      onClick={dismissible ? onClose : undefined}
    >
      <div
        data-modal-panel
        data-open={visible || undefined}
        className={cn(
          'opacity-0 will-change-[opacity,transform] transition-[opacity,transform] duration-[280ms] ease-[cubic-bezier(0.22,1,0.36,1)]',
          'translate-y-5 scale-[0.985] sm:translate-y-3 sm:scale-[0.97]',
          visible && 'translate-y-0 scale-100 opacity-100',
          MODAL_SIZE_CLASS[size],
          MODAL_INTENT_CLASS[intent],
          intent === 'default' && '[&>.payment-modal]:max-w-none [&>.payment-modal]:border-0 [&>.payment-modal]:shadow-none',
          panelClassName,
        )}
        style={panelStyle}
        role="dialog"
        aria-modal="true"
        aria-labelledby={ariaLabelledBy}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

/** Content fade-in used inside modals after async load */
export const modalContentEnter = 'animate-[app-modal-content-in_280ms_cubic-bezier(0.22,1,0.36,1)_both]'
