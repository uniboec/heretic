'use client'

import { Fragment, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { withBasePath } from '@/lib/basePath'
import { readJsonResponse } from '@/lib/http/readJsonResponse'
import { type RegistrationStageId } from '@/lib/config/tournament'
import { tournamentPageCopy } from '@/lib/content/tournament-page'
import { cn } from '@/lib/cn'

interface CountdownParts {
  days: number
  hours: number
  minutes: number
  seconds: number
}

interface TournamentState {
  closed: boolean
  closeCountdown: CountdownParts
  stage: {
    id: RegistrationStageId
    bannerTitle: string
    bannerDetail: string
    pricePerDiscipline: number
    countdown: CountdownParts | null
  } | null
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function pluralUnit(key: string, value: number, compact = false): string {
  if (compact) {
    if (key === 'days') return 'дн'
    if (key === 'hours') return 'ч'
    if (key === 'minutes') return 'мин'
    return 'сек'
  }

  const mod10 = value % 10
  const mod100 = value % 100
  if (key === 'days') {
    if (mod10 === 1 && mod100 !== 11) return 'день'
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'дня'
    return 'дней'
  }
  if (key === 'hours') {
    if (mod10 === 1 && mod100 !== 11) return 'час'
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'часа'
    return 'часов'
  }
  if (key === 'minutes') {
    if (mod10 === 1 && mod100 !== 11) return 'минута'
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'минуты'
    return 'минут'
  }
  if (mod10 === 1 && mod100 !== 11) return 'секунда'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'секунды'
  return 'секунд'
}

function subscribeCompactTimer(listener: () => void) {
  const mq = window.matchMedia('not (min-width: 640px)')
  mq.addEventListener('change', listener)
  return () => mq.removeEventListener('change', listener)
}

function getCompactTimer() {
  return window.matchMedia('not (min-width: 640px)').matches
}

function useCompactTimer() {
  const mediaCompact = useSyncExternalStore(subscribeCompactTimer, getCompactTimer, () => false)
  const [compactLabels, setCompactLabels] = useState(false)

  useEffect(() => {
    setCompactLabels(mediaCompact)
  }, [mediaCompact])

  return compactLabels
}

const copy = tournamentPageCopy.timer

export function CountdownTimer({
  compact = false,
  large = false,
  plaque = false,
}: {
  compact?: boolean
  large?: boolean
  plaque?: boolean
}) {
  const compactLabels = useCompactTimer()
  const [state, setState] = useState<TournamentState | null>(null)
  const targetsRef = useRef({ close: 0, stage: 0, offset: 0, hasStage: false })

  useEffect(() => {
    const load = async () => {
      const result = await readJsonResponse<TournamentState & { now: string }>(
        await fetch(withBasePath('/api/tournament/state')),
      )
      if (!result.ok) return

      const json = result.data
      const serverNow = new Date(json.now).getTime()
      targetsRef.current.offset = serverNow - Date.now()
      targetsRef.current.close =
        serverNow +
        json.closeCountdown.days * 86400000 +
        json.closeCountdown.hours * 3600000 +
        json.closeCountdown.minutes * 60000 +
        json.closeCountdown.seconds * 1000
      if (json.stage?.countdown) {
        targetsRef.current.hasStage = true
        targetsRef.current.stage =
          serverNow +
          json.stage.countdown.days * 86400000 +
          json.stage.countdown.hours * 3600000 +
          json.stage.countdown.minutes * 60000 +
          json.stage.countdown.seconds * 1000
      } else {
        targetsRef.current.hasStage = false
      }
      setState(json)
    }

    load()
    const tick = setInterval(() => {
      const { close, stage, offset, hasStage } = targetsRef.current
      const now = Date.now() + offset
      const closeDiff = Math.max(0, close - now)
      const stageDiff = hasStage ? Math.max(0, stage - now) : 0

      setState((prev) => {
        if (!prev) return prev
        const closeCountdown = {
          days: Math.floor(closeDiff / 86400000),
          hours: Math.floor((closeDiff % 86400000) / 3600000),
          minutes: Math.floor((closeDiff % 3600000) / 60000),
          seconds: Math.floor((closeDiff % 60000) / 1000),
        }
        const stageCountdown = hasStage
          ? {
              days: Math.floor(stageDiff / 86400000),
              hours: Math.floor((stageDiff % 86400000) / 3600000),
              minutes: Math.floor((stageDiff % 3600000) / 60000),
              seconds: Math.floor((stageDiff % 60000) / 1000),
            }
          : null

        return {
          ...prev,
          closeCountdown,
          stage: prev.stage
            ? { ...prev.stage, countdown: stageCountdown }
            : null,
        }
      })
    }, 1000)

    return () => clearInterval(tick)
  }, [])

  if (!state || state.closed) {
    return plaque ? null : <p className="text-sm text-muted">{copy.loading}</p>
  }

  if (plaque) {
    const showStage = state.stage && state.stage.id !== 'late' && state.stage.countdown
    const parts = showStage ? state.stage!.countdown! : state.closeCountdown
    const isUrgent = parts.days === 0
    const title = showStage ? copy.plaqueTitle : copy.closeTitle

    const units = [
      { key: 'days', value: parts.days },
      { key: 'hours', value: parts.hours },
      { key: 'minutes', value: parts.minutes },
      { key: 'seconds', value: parts.seconds },
    ]

    return (
      <div
        className="event-countdown-plaque mt-4 rounded-[0.875rem] border border-border bg-surface p-4 px-[1.125rem] max-sm:mt-3.5 max-sm:p-3.5 max-sm:px-2.5"
        role="timer"
        aria-live="polite"
      >
        <p className="text-[0.9375rem] font-bold text-accent max-sm:text-sm max-sm:leading-snug">
          {title}
        </p>
        <div
          className={cn(
            'mt-3 flex items-start gap-1 max-sm:mt-2.5 max-sm:grid max-sm:w-full max-sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] max-sm:gap-x-[0.1875rem] max-sm:gap-y-0',
          )}
        >
          {units.map((unit, index) => (
            <Fragment key={unit.key}>
              <div className="flex min-w-12 flex-col items-center gap-[0.3125rem] max-sm:min-w-0 max-sm:w-full">
                <span
                  className={cn(
                    'flex size-[3.25rem] items-center justify-center rounded-lg border border-border bg-card text-[1.375rem] font-bold tabular-nums leading-none text-foreground max-sm:h-[2.375rem] max-sm:w-full max-sm:text-lg',
                    isUrgent &&
                      (unit.key === 'minutes' || unit.key === 'seconds') &&
                      'text-accent',
                  )}
                >
                  {pad(unit.value)}
                </span>
                <span className="max-w-full truncate text-[0.5625rem] font-bold uppercase tracking-wider text-muted max-sm:text-[0.5rem] max-sm:tracking-wide">
                  {pluralUnit(unit.key, unit.value, compactLabels)}
                </span>
              </div>
              {index < units.length - 1 && (
                <span
                  className="mt-2.5 text-xl font-semibold leading-none text-[#c5c9d0] max-sm:mt-[0.4375rem] max-sm:justify-self-center max-sm:text-[0.9375rem]"
                  aria-hidden="true"
                >
                  :
                </span>
              )}
            </Fragment>
          ))}
        </div>
      </div>
    )
  }

  const c = state.closeCountdown

  if (compact) {
    return (
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">{copy.title}</p>
        <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-foreground">
          {pad(c.days)}:{pad(c.hours)}:{pad(c.minutes)}:{pad(c.seconds)}
        </p>
      </div>
    )
  }

  const sizeClass = large ? 'text-2xl sm:text-3xl' : 'text-xl'

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-muted">{copy.title}</p>
      <div className={`grid grid-cols-4 gap-1.5 font-extrabold tabular-nums sm:gap-2 ${sizeClass}`}>
        {[
          [c.days, copy.units.days],
          [c.hours, copy.units.hours],
          [c.minutes, copy.units.minutes],
          [c.seconds, copy.units.seconds],
        ].map(([value, label]) => (
          <div
            key={label}
            className="rounded-lg border border-border bg-surface px-1 py-2.5 text-center sm:rounded-xl sm:px-2 sm:py-3"
          >
            <div>{pad(value as number)}</div>
            <div className="mt-1 text-[10px] font-medium uppercase text-muted">{label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
