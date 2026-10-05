'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import type { Corner } from '@/lib/bouts/mat-control/types'
import type { PenaltyLadder, SubmissionSubtype } from '@/lib/config/fseRules'
import { sideLabel } from './judgeAthlete'
import type { InternalBoutSide } from '@/lib/bouts/types'
import {
  DISQUALIFICATION_REASONS,
  disqualificationReasonLabel,
  getDisqualifiableCorners,
} from './disqualificationOptions'
import {
  DEFAULT_REQUIRES_OFFICIAL_START,
  requiresOfficialStartForMethod,
} from '@/lib/bouts/confirmValidation'
import type { VictoryMethod } from '@/lib/config/fseRules'

type FinishReason = 'submission' | 'choke' | 'forfeit' | 'injury'
type WizardStep =
  | 'reason'
  | 'winner'
  | 'subject'
  | 'subtype'
  | 'review'
  | 'disqualify_reason'
  | 'disqualify_athlete'

const wizardStackedBtn =
  'h-auto !min-h-0 w-full flex-col items-start justify-start gap-1 whitespace-normal py-3 text-left'

function WizardStackedButton({
  title,
  subtitle,
  onClick,
}: {
  title: string
  subtitle?: string
  onClick: () => void
}) {
  return (
    <Button variant="secondary" className={wizardStackedBtn} onClick={onClick}>
      <span className="w-full font-medium leading-snug text-foreground">{title}</span>
      {subtitle ? (
        <span className="w-full text-xs font-normal leading-snug text-muted">{subtitle}</span>
      ) : null}
    </Button>
  )
}

export function BoutFinishWizard({
  open,
  busy,
  redSide,
  blueSide,
  redEntryId,
  blueEntryId,
  onClose,
  onSubmit,
  onDisqualify,
  fightClockStarted = true,
}: {
  open: boolean
  busy: boolean
  fightClockStarted?: boolean
  redSide: InternalBoutSide
  blueSide: InternalBoutSide
  redEntryId?: string | null
  blueEntryId?: string | null
  onClose: () => void
  onSubmit: (input: {
    intent:
      | 'STOPPAGE_SUBMISSION'
      | 'STOPPAGE_CHOKE'
      | 'STOPPAGE_FORFEIT'
      | 'STOPPAGE_INJURY'
    payload: Record<string, unknown>
  }) => Promise<void>
  onDisqualify?: (corner: Corner, ladder: PenaltyLadder) => void
}) {
  const [step, setStep] = useState<WizardStep>('reason')
  const [reason, setReason] = useState<FinishReason | null>(null)
  const [winnerCorner, setWinnerCorner] = useState<Corner>('red')
  const [subjectCorner, setSubjectCorner] = useState<Corner>('red')
  const [submissionSubtype, setSubmissionSubtype] = useState<SubmissionSubtype>('ARM')
  const [disqualifyLadder, setDisqualifyLadder] = useState<PenaltyLadder | null>(null)

  if (!open) return null

  const redName = sideLabel(redSide)
  const blueName = sideLabel(blueSide)
  const disqualifiableCorners = getDisqualifiableCorners({ redEntryId, blueEntryId })

  function finishReasonRequiresClock(value: FinishReason): boolean {
    const methodMap: Record<FinishReason, VictoryMethod> = {
      submission: 'SUBMISSION',
      choke: 'CHOKE',
      forfeit: 'FORFEIT',
      injury: 'INJURY',
    }
    return requiresOfficialStartForMethod(methodMap[value], DEFAULT_REQUIRES_OFFICIAL_START)
  }

  function clockGateMessage(value: FinishReason): string | null {
    if (fightClockStarted || !finishReasonRequiresClock(value)) return null
    return 'Для выбранного способа завершения требуется официальный старт боя (запуск таймера).'
  }

  function reset() {
    setStep('reason')
    setReason(null)
    setWinnerCorner('red')
    setSubjectCorner('red')
    setSubmissionSubtype('ARM')
    setDisqualifyLadder(null)
  }

  function handleClose() {
    reset()
    onClose()
  }

  function handleBack() {
    if (step === 'reason') {
      handleClose()
      return
    }
    if (step === 'disqualify_athlete') {
      setStep('disqualify_reason')
      return
    }
    if (step === 'disqualify_reason') {
      setDisqualifyLadder(null)
      setStep('reason')
      return
    }
    setStep('reason')
  }

  async function handleConfirm() {
    if (!reason) return
    if (reason === 'submission') {
      await onSubmit({
        intent: 'STOPPAGE_SUBMISSION',
        payload: { winnerCorner, submissionSubtype },
      })
    } else if (reason === 'choke') {
      await onSubmit({ intent: 'STOPPAGE_CHOKE', payload: { winnerCorner } })
    } else if (reason === 'forfeit') {
      await onSubmit({ intent: 'STOPPAGE_FORFEIT', payload: { forfeitingCorner: subjectCorner } })
    } else {
      await onSubmit({ intent: 'STOPPAGE_INJURY', payload: { injuredCorner: subjectCorner } })
    }
    reset()
    onClose()
  }

  function handleDisqualify(corner: Corner, ladder: PenaltyLadder) {
    onDisqualify?.(corner, ladder)
    reset()
    onClose()
  }

  function athleteButtonLabel(corner: Corner): string {
    const name = corner === 'red' ? redName : blueName
    const cornerLabel = corner === 'red' ? 'Красный' : 'Синий'
    return `${cornerLabel} — ${name}`
  }

  function winnerHintForDisqualified(corner: Corner): string {
    const winnerName = corner === 'red' ? blueName : redName
    const winnerCornerLabel = corner === 'red' ? 'синий' : 'красный'
    return `Победит ${winnerName} (${winnerCornerLabel})`
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl border border-border bg-background p-5 shadow-xl">
        <h2 className="text-lg font-semibold text-foreground">Завершение поединка</h2>
        {!fightClockStarted ? (
          <p className="mt-2 text-xs font-medium text-amber-700">
            Таймер не запущен — для побед по очкам, болевым и травме нужен официальный старт.
          </p>
        ) : null}

        {step === 'reason' ? (
          <div className="mt-4 space-y-2">
            <p className="text-sm text-muted">Причина завершения</p>
            {(
              [
                ['submission', 'Болевой приём'],
                ['choke', 'Удушающий приём'],
                ['forfeit', 'Отказ от продолжения (О.Т.К.)'],
                ['injury', 'Невозможность продолжать'],
              ] as const
            ).map(([value, label]) => {
              const gate = clockGateMessage(value)
              return (
              <Button
                key={value}
                variant="secondary"
                className="w-full justify-start"
                disabled={Boolean(gate)}
                title={gate ?? undefined}
                onClick={() => {
                  setReason(value)
                  if (value === 'forfeit' || value === 'injury') setStep('subject')
                  else setStep('winner')
                }}
              >
                {label}
              </Button>
              )
            })}
            {onDisqualify && disqualifiableCorners.length > 0 ? (
              <Button
                variant="secondary"
                className="w-full justify-start"
                onClick={() => setStep('disqualify_reason')}
              >
                Дисквалификация
              </Button>
            ) : null}
          </div>
        ) : null}

        {step === 'disqualify_reason' ? (
          <div className="mt-4 space-y-2">
            <p className="text-sm text-muted">Причина дисквалификации</p>
            {DISQUALIFICATION_REASONS.map((option) => (
              <WizardStackedButton
                key={option.ladder}
                title={option.label}
                subtitle={option.description}
                onClick={() => {
                  setDisqualifyLadder(option.ladder)
                  setStep('disqualify_athlete')
                }}
              />
            ))}
          </div>
        ) : null}

        {step === 'disqualify_athlete' && disqualifyLadder ? (
          <div className="mt-4 space-y-2">
            <p className="text-sm text-muted">
              Основание: {disqualificationReasonLabel(disqualifyLadder)}
            </p>
            <p className="text-sm font-medium text-foreground">Кого дисквалифицировать?</p>
            <p className="text-xs text-muted">Выберите спортсмена, которого снимают с поединка.</p>
            {disqualifiableCorners.map((corner) => (
              <WizardStackedButton
                key={corner}
                title={athleteButtonLabel(corner)}
                subtitle={winnerHintForDisqualified(corner)}
                onClick={() => handleDisqualify(corner, disqualifyLadder)}
              />
            ))}
          </div>
        ) : null}

        {step === 'winner' ? (
          <div className="mt-4 space-y-2">
            <p className="text-sm text-muted">Кто победил?</p>
            <Button variant="secondary" className="w-full" onClick={() => { setWinnerCorner('red'); setStep(reason === 'submission' ? 'subtype' : 'review') }}>
              Красный — {redName}
            </Button>
            <Button variant="secondary" className="w-full" onClick={() => { setWinnerCorner('blue'); setStep(reason === 'submission' ? 'subtype' : 'review') }}>
              Синий — {blueName}
            </Button>
          </div>
        ) : null}

        {step === 'subject' ? (
          <div className="mt-4 space-y-2">
            <p className="text-sm text-muted">
              {reason === 'forfeit' ? 'Кто отказался?' : 'Кто не может продолжать?'}
            </p>
            <Button variant="secondary" className="w-full" onClick={() => { setSubjectCorner('red'); setStep('review') }}>
              {redName} (красный)
            </Button>
            <Button variant="secondary" className="w-full" onClick={() => { setSubjectCorner('blue'); setStep('review') }}>
              {blueName} (синий)
            </Button>
          </div>
        ) : null}

        {step === 'subtype' ? (
          <div className="mt-4 space-y-2">
            <p className="text-sm text-muted">Какой болевой приём?</p>
            {(['ARM', 'LEG', 'OTHER'] as const).map((subtype) => (
              <Button
                key={subtype}
                variant="secondary"
                className="w-full"
                onClick={() => {
                  setSubmissionSubtype(subtype)
                  setStep('review')
                }}
              >
                {subtype === 'ARM' ? 'На руку' : subtype === 'LEG' ? 'На ногу' : 'Другое'}
              </Button>
            ))}
          </div>
        ) : null}

        {step === 'review' ? (
          <div className="mt-4 space-y-2 text-sm">
            <p className="font-medium text-foreground">Проверьте результат</p>
            {reason === 'forfeit' || reason === 'injury' ? (
              <p>
                Победитель:{' '}
                {subjectCorner === 'red' ? blueName : redName} (
                {subjectCorner === 'red' ? 'синий' : 'красный'})
              </p>
            ) : (
              <p>
                Победитель: {winnerCorner === 'red' ? redName : blueName}
              </p>
            )}
            {reason && clockGateMessage(reason) ? (
              <p className="text-xs text-amber-700">{clockGateMessage(reason)}</p>
            ) : null}
            <Button
              className="mt-3 w-full"
              disabled={busy || Boolean(reason && clockGateMessage(reason))}
              onClick={() => void handleConfirm()}
            >
              Подтвердить остановку
            </Button>
          </div>
        ) : null}

        <div className="mt-4 flex justify-between">
          <Button variant="secondary" onClick={handleBack}>
            ← Назад
          </Button>
          <Button variant="secondary" onClick={handleClose}>Отмена</Button>
        </div>
      </div>
    </div>
  )
}
