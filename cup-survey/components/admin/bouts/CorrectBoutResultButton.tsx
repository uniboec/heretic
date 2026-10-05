'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil } from 'lucide-react'
import { boutHasBothAthletes } from '@/lib/bouts/boutReadiness'
import { BOUT_RESULT_CORRECTION_WARNING } from '@/lib/bouts/boutResultCorrectionCopy'
import { matControlHref } from '@/lib/bouts/matControlUrls'
import type { BoutSideData } from '@/components/tournament/BoutCard'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { adminBoutsIconBtn } from '@/lib/ui/adminSurfaceStyles'

export function CorrectBoutResultButton({
  matIndex,
  boutId,
  sideA,
  sideB,
  className,
  compact = true,
  iconOnly = false,
}: {
  matIndex: number
  boutId: string
  sideA: BoutSideData
  sideB: BoutSideData
  className?: string
  compact?: boolean
  iconOnly?: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  if (!boutHasBothAthletes(sideA, sideB)) {
    return null
  }

  const warning = BOUT_RESULT_CORRECTION_WARNING

  return (
    <>
      <Button
        type="button"
        variant={iconOnly ? 'ghost' : 'secondary'}
        className={cn(
          iconOnly
            ? adminBoutsIconBtn
            : compact
              ? 'min-h-9 whitespace-nowrap px-2.5 py-1 text-xs'
              : undefined,
          className,
        )}
        aria-label={iconOnly ? 'Изменить результат' : undefined}
        title={iconOnly ? 'Изменить результат' : undefined}
        onClick={() => setOpen(true)}
      >
        {iconOnly ? (
          <Pencil className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
        ) : (
          'Изменить результат'
        )}
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div
            className="w-full max-w-lg rounded-xl border border-border bg-background p-5 shadow-xl"
            role="dialog"
            aria-labelledby="bout-result-correction-title"
            aria-modal="true"
          >
            <h2 id="bout-result-correction-title" className="text-lg font-semibold text-foreground">
              {warning.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{warning.intro}</p>
            <p className="mt-3 text-sm font-medium text-foreground">Это может затронуть:</p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted">
              {warning.consequences.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-muted">
              После подтверждения откроется панель управления поединком, где можно скорректировать
              результат.
            </p>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                {warning.cancelLabel}
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setOpen(false)
                  router.push(matControlHref(matIndex, { boutId, editResult: true }))
                }}
              >
                {warning.confirmLabel}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
