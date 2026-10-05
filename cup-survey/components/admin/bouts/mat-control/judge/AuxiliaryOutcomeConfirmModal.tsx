'use client'

import { Button } from '@/components/ui/Button'
import { oppositeCorner } from '@/lib/bouts/assertBoutParticipantCorner'
import type { Corner } from '@/lib/bouts/mat-control/types'

import { BoutOutcomeConfirmSummary } from './BoutOutcomeConfirmSummary'

export type AuxiliaryOutcomeKind =
  | 'no_show'
  | 'doctor_removal'
  | 'equipment_disqualify'
  | 'clear_advantage'

const COPY: Record<
  AuxiliaryOutcomeKind,
  {
    title: string
    description: (scoreDifference?: number) => string
    confirmLabel: string
  }
> = {
  no_show: {
    title: 'Подтвердите неявку',
    description: () =>
      'Спортсмен не вышел на ковёр в отведённое время ожидания (2 мин). Поединок будет завершён.',
    confirmLabel: 'Зафиксировать неявку',
  },
  doctor_removal: {
    title: 'Подтвердите снятие врачом',
    description: () =>
      'Истекло время допуска врача (2 мин). Спортсмен не может продолжить бой.',
    confirmLabel: 'Подтвердить снятие',
  },
  equipment_disqualify: {
    title: 'Подтвердите дисквалификацию за экипировку',
    description: () => 'Экипировка не исправлена в отведённое время (2 мин).',
    confirmLabel: 'Подтвердить дисквалификацию',
  },
  clear_advantage: {
    title: 'Подтвердите завершение по Я.П.',
    description: (scoreDifference) =>
      scoreDifference != null
        ? `Разница в счёте — ${scoreDifference} баллов. Поединок завершается по явному преимуществу.`
        : 'Поединок завершается по явному преимуществу.',
    confirmLabel: 'Завершить по Я.П.',
  },
}

export function AuxiliaryOutcomeConfirmModal({
  open,
  busy,
  kind,
  corner,
  penalizedName,
  winnerName,
  scoreDifference,
  onClose,
  onConfirm,
}: {
  open: boolean
  busy: boolean
  kind: AuxiliaryOutcomeKind
  corner: Corner
  penalizedName: string
  winnerName: string
  scoreDifference?: number
  onClose: () => void
  onConfirm: () => Promise<void>
}) {
  if (!open) return null

  const copy = COPY[kind]
  const winnerCorner = oppositeCorner(corner)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl border border-border bg-background p-5 shadow-xl">
        <h2 className="text-lg font-semibold text-foreground">{copy.title}</h2>
        <p className="mt-2 text-sm leading-snug text-muted">{copy.description(scoreDifference)}</p>

        <BoutOutcomeConfirmSummary
          winnerName={winnerName}
          winnerCorner={winnerCorner}
          loserName={penalizedName}
          loserCorner={corner}
        />

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            Отмена
          </Button>
          <Button disabled={busy} onClick={() => void onConfirm()}>
            {copy.confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
