'use client'

import { Button } from '@/components/ui/Button'

export function ClockAdjustPanel({
  disabled,
  onAdjust,
}: {
  disabled?: boolean
  onAdjust: (deltaMs: number) => void
}) {
  const steps = [
    { label: '−30 сек', deltaMs: -30_000 },
    { label: '−1 сек', deltaMs: -1_000 },
    { label: '+1 сек', deltaMs: 1_000 },
    { label: '+30 сек', deltaMs: 30_000 },
  ]

  return (
    <div className="mt-2 space-y-1 border-t border-border pt-2">
      <p className="text-xs font-medium text-muted">Настройка времени</p>
      <div className="grid grid-cols-2 gap-1">
        {steps.map((step) => (
          <Button
            key={step.label}
            variant="secondary"
            className="justify-center text-xs"
            disabled={disabled}
            onClick={() => onAdjust(step.deltaMs)}
          >
            {step.label}
          </Button>
        ))}
      </div>
    </div>
  )
}
