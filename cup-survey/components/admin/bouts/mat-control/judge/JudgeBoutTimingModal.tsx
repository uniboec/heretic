'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import {
  formatBoutDurationInput,
  InvalidBoutDurationInputError,
  parseBoutDurationInput,
} from '@/lib/bouts/parseBoutDurationInput'
import type { BoutPeriodCount } from '@/lib/bouts/boutLiveSnapshot'

export function JudgeBoutTimingModal({
  open,
  busy,
  mainPeriodDurationMs,
  extraPeriodDurationMs,
  defaultPeriodDurationMs,
  periodCount,
  currentPeriod,
  onClose,
  onConfirm,
}: {
  open: boolean
  busy: boolean
  mainPeriodDurationMs: number
  extraPeriodDurationMs: number
  defaultPeriodDurationMs: number
  periodCount: BoutPeriodCount
  currentPeriod: 'main' | 'extra'
  onClose: () => void
  onConfirm: (input: {
    mainDurationMs: number
    extraDurationMs: number
    periodCount: BoutPeriodCount
  }) => Promise<void>
}) {
  const [mainInput, setMainInput] = useState('')
  const [extraInput, setExtraInput] = useState('')
  const [rounds, setRounds] = useState<BoutPeriodCount>(2)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setMainInput(formatBoutDurationInput(mainPeriodDurationMs))
    setExtraInput(formatBoutDurationInput(extraPeriodDurationMs))
    setRounds(periodCount)
    setError(null)
  }, [open, mainPeriodDurationMs, extraPeriodDurationMs, periodCount])

  if (!open) return null

  const handleConfirm = async () => {
    try {
      const mainDurationMs = parseBoutDurationInput(mainInput)
      const extraDurationMs = rounds === 2 ? parseBoutDurationInput(extraInput) : mainDurationMs
      setError(null)
      await onConfirm({ mainDurationMs, extraDurationMs, periodCount: rounds })
    } catch (cause) {
      if (cause instanceof InvalidBoutDurationInputError) {
        setError(cause.message)
        return
      }
      throw cause
    }
  }

  const defaultLabel = formatBoutDurationInput(defaultPeriodDurationMs)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-background p-5 shadow-xl">
        <h2 className="text-lg font-semibold text-foreground">Время поединка</h2>
        <p className="mt-2 text-sm text-muted">
          Длительность раундов и их количество для текущего поединка. Формат: 3:00, 3, 2.5, 2m30s
          или 180s.
        </p>
        <p className="mt-1 text-xs text-muted">По умолчанию для категории: {defaultLabel}</p>

        <div className="mt-4 space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-foreground">Основной раунд</span>
            <input
              type="text"
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={mainInput}
              disabled={busy}
              onChange={(event) => setMainInput(event.target.value)}
              placeholder="3:00"
              autoComplete="off"
            />
          </label>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-foreground">Количество раундов</legend>
            <label className="flex cursor-pointer items-start gap-2 rounded-md border border-border px-3 py-2">
              <input
                type="radio"
                name="period-count"
                className="mt-1"
                checked={rounds === 1}
                disabled={busy || currentPeriod === 'extra'}
                onChange={() => setRounds(1)}
              />
              <span className="text-sm text-foreground">
                1 раунд
                <span className="mt-0.5 block text-xs text-muted">
                  При ничьей — решение по активности, без доп. времени
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2 rounded-md border border-border px-3 py-2">
              <input
                type="radio"
                name="period-count"
                className="mt-1"
                checked={rounds === 2}
                disabled={busy}
                onChange={() => setRounds(2)}
              />
              <span className="text-sm text-foreground">
                2 раунда
                <span className="mt-0.5 block text-xs text-muted">Основное + дополнительное время</span>
              </span>
            </label>
          </fieldset>

          {rounds === 2 ? (
            <label className="block">
              <span className="text-sm font-medium text-foreground">Дополнительный раунд</span>
              <input
                type="text"
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={extraInput}
                disabled={busy}
                onChange={(event) => setExtraInput(event.target.value)}
                placeholder="3:00"
                autoComplete="off"
              />
            </label>
          ) : null}
        </div>

        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            Отмена
          </Button>
          <Button disabled={busy} onClick={() => void handleConfirm()}>
            Сохранить
          </Button>
        </div>
      </div>
    </div>
  )
}
