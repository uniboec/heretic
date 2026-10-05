'use client'

import { ArrowLeftRight, Lock } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { adminFieldLabel, adminInput } from '@/lib/ui/adminSurfaceStyles'

export interface SeedEditorParticipant {
  entryId: string
  seedPosition: number
  seedLocked: boolean
  displayName: string
}

interface SeedPositionEditorProps {
  participant: SeedEditorParticipant
  participants: SeedEditorParticipant[]
  clubConflictHint?: string | null
  disabled?: boolean
  onOpenChange?: (open: boolean) => void
  onSwap: (fromEntryId: string, targetSeedPosition: number) => Promise<boolean>
}

function SeedNumberButton({
  position,
  size = 'md',
  as = 'span',
  className,
}: {
  position: number
  size?: 'sm' | 'md'
  as?: 'span' | 'display'
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-xl border border-border bg-card font-semibold tabular-nums text-foreground shadow-sm',
        size === 'sm' ? 'h-8 min-w-8 px-2 text-xs' : 'h-9 min-w-9 px-2.5 text-sm',
        as === 'display' && 'pointer-events-none',
        className,
      )}
    >
      {position}
    </span>
  )
}

export function SeedPositionEditor({
  participant,
  participants,
  clubConflictHint = null,
  disabled = false,
  onOpenChange,
  onSwap,
}: SeedPositionEditorProps) {
  const [open, setOpen] = useState(false)
  const [selectedPosition, setSelectedPosition] = useState<number | ''>('')
  const [submitting, setSubmitting] = useState(false)
  const [popoverStyle, setPopoverStyle] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 288,
  })
  const buttonRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  const isLocked = participant.seedLocked
  const hasInvalidSeed =
    participant.seedPosition < 1 || participant.seedPosition > participants.length
  const isDisabled = disabled || isLocked || hasInvalidSeed
  const validPositionCount = participants.length
  const swapTargets = participants.filter(
    (item) =>
      item.entryId !== participant.entryId &&
      item.seedPosition >= 1 &&
      item.seedPosition <= validPositionCount,
  )

  const setOpenState = (next: boolean) => {
    setOpen(next)
    onOpenChange?.(next)
  }

  useEffect(() => {
    if (!open) return
    setSelectedPosition('')
  }, [open])

  useEffect(() => {
    if (!open) return

    const updatePosition = () => {
      const button = buttonRef.current
      if (!button) return

      const rect = button.getBoundingClientRect()
      const width = Math.min(288, window.innerWidth - 24)
      const left = Math.min(Math.max(12, rect.left), window.innerWidth - width - 12)
      const top = rect.bottom + 8

      setPopoverStyle({ top, left, width })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (
        buttonRef.current?.contains(target) ||
        popoverRef.current?.contains(target)
      ) {
        return
      }
      setOpenState(false)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenState(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const target =
    selectedPosition === ''
      ? undefined
      : participants.find((item) => item.seedPosition === selectedPosition)
  const hasChange = selectedPosition !== ''
  const targetBlocked = Boolean(target?.seedLocked)

  const handleApply = async () => {
    if (!hasChange || targetBlocked || submitting) return
    if (typeof selectedPosition !== 'number') return

    setSubmitting(true)
    try {
      const ok = await onSwap(participant.entryId, selectedPosition)
      if (ok) setOpenState(false)
    } finally {
      setSubmitting(false)
    }
  }

  const popover =
    open &&
    createPortal(
      <>
        <div className="fixed inset-0 z-[199] bg-foreground/5" aria-hidden="true" />
        <div
          ref={popoverRef}
          role="dialog"
          aria-label={`Сменить посев для ${participant.displayName}`}
          className="fixed z-[200] rounded-xl border border-border bg-white p-4 shadow-[0_16px_40px_rgb(15_20_25/0.16)]"
        style={{
          top: popoverStyle.top,
          left: popoverStyle.left,
          width: popoverStyle.width,
        }}
      >
        <div className="flex items-start gap-3">
          <SeedNumberButton position={participant.seedPosition} as="display" />
          <div className="min-w-0 flex-1">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-muted">
              Сменить посев
            </p>
            <p className="mt-0.5 text-sm font-semibold leading-snug text-foreground">
              {participant.displayName}
            </p>
          </div>
        </div>

        <label className="mt-4 block">
          <span className={cn(adminFieldLabel, 'mb-1.5 block')}>Позиция для обмена</span>
          <select
            className={cn(adminInput, 'w-full py-2.5 text-sm')}
            value={selectedPosition}
            disabled={submitting}
            onChange={(event) => {
              const value = event.target.value
              setSelectedPosition(value === '' ? '' : Number.parseInt(value, 10))
            }}
          >
            <option value="">Выберите позицию</option>
            {swapTargets.map((item) => (
              <option key={item.entryId} value={item.seedPosition}>
                {item.seedPosition} — {item.displayName}
                {item.seedLocked ? ' (закреплён)' : ''}
              </option>
            ))}
          </select>
        </label>

        {hasChange && target && (
          <div
            className={cn(
              'mt-4 rounded-xl border p-3',
              targetBlocked
                ? 'border-warning-border bg-warning-soft'
                : 'border-border bg-muted/15',
            )}
          >
            {targetBlocked ? (
              <p className="text-xs leading-relaxed text-warning-foreground">
                Позиция {selectedPosition} закреплена — обмен недоступен
              </p>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2.5">
                  <SeedNumberButton position={participant.seedPosition} size="sm" as="display" />
                  <p className="min-w-0 break-words text-sm font-medium leading-snug text-foreground">
                    {participant.displayName}
                  </p>
                </div>
                <div className="flex justify-center">
                  <ArrowLeftRight className="h-4 w-4 text-accent" aria-hidden="true" />
                </div>
                <div className="flex items-center gap-2.5">
                  <SeedNumberButton position={target.seedPosition} size="sm" as="display" />
                  <p className="min-w-0 break-words text-sm font-medium leading-snug text-foreground">
                    {target.displayName}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={submitting}
            className="min-h-9 px-3 py-2 text-xs"
            onClick={() => setOpenState(false)}
          >
            Отмена
          </Button>
          <Button
            type="button"
            disabled={!hasChange || targetBlocked || submitting}
            loading={submitting}
            className="min-h-9 px-3 py-2 text-xs"
            onClick={() => void handleApply()}
          >
            Обменять
          </Button>
        </div>
        </div>
      </>,
      document.body,
    )

  return (
    <>
      <Button
        ref={buttonRef}
        type="button"
        variant="ghost"
        disabled={isDisabled}
        onClick={() => {
          if (isDisabled) return
          setOpenState(!open)
        }}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={
          hasInvalidSeed
            ? `Посев ${participant.seedPosition}, требуется жеребьёвка`
            : isLocked
              ? `Посев ${participant.seedPosition}, закреплён`
              : `Посев ${participant.seedPosition}, изменить`
        }
        title={
          hasInvalidSeed
            ? 'Некорректная позиция — нажмите «Жеребьёвка»'
            : isLocked
              ? 'Посев закреплён'
              : 'Изменить номер посева'
        }
        className={cn(
          'relative inline-flex h-9 min-w-9 shrink-0 items-center justify-center rounded-xl border px-2.5 text-sm font-semibold tabular-nums shadow-sm transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:ring-offset-2',
          hasInvalidSeed
            ? 'cursor-not-allowed border-warning-border bg-warning-soft text-warning-foreground'
            : clubConflictHint && !isDisabled
              ? 'border-warning-border bg-warning-soft/70 text-warning-foreground'
            : isDisabled
              ? 'cursor-not-allowed border-border bg-muted/20 text-muted opacity-60'
              : open
              ? 'border-accent bg-accent text-white shadow-accent/20'
              : 'cursor-pointer border-border bg-card text-foreground hover:border-accent/30 hover:bg-background-soft active:scale-[0.98]',
        )}
      >
        {participant.seedPosition}
        {isLocked && (
          <span
            className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border border-border bg-white text-muted shadow-sm"
            aria-hidden="true"
          >
            <Lock className="h-2.5 w-2.5" strokeWidth={2.5} />
          </span>
        )}
      </Button>
      {popover}
    </>
  )
}
