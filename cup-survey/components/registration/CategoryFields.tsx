'use client'

import { useEffect, useState } from 'react'
import { getDisciplineLabel, tournamentDisciplines } from '@/lib/config/tournament'
import {
  experienceLevelOptions,
  canRegisterAsNovice,
  getDefaultExperienceLevel,
} from '@/lib/config/experienceLevel'
import { Button } from '@/components/ui/Button'
import { CollapsePanel } from '@/components/ui/CollapsePanel'
import { cn } from '@/lib/cn'
import { formatMoney } from '@/lib/formatMoney'
import { formatAgeDivisionAgeRange } from '@/lib/config/fseCategories'
import {
  getEligibleAgeDivisions,
  getTournamentCategoryLabel,
  isAgeUpDivision,
} from '@/lib/registration/categoryRules'
import {
  resolveEntryPrice,
  type CategoryDiscountRuleLike,
} from '@/lib/registration/pricing'
import { tournamentInfo } from '@/lib/config/tournament'
import { tournamentPageCopy } from '@/lib/content/tournament-page'
import { DisciplineBadge } from '@/components/tournament/DisciplineBadge'
import { EntryPaymentStatusBadge } from '@/components/ui/EntryPaymentStatusBadge'
import type { DisciplineEntryForm } from './RegistrationForm'
import { EventSelect } from './EventFormFields'
import { isLockedEntryStatus } from '@/lib/registration/editRules'
import {
  collapseCompleteIndices,
  getAvailableWeightCategories,
  isCategoryComplete,
} from './registrationFormUtils'

const regCopy = tournamentPageCopy.registration

export interface CategoryFieldsProps {
  birthDate: string
  gender: 'male' | 'female' | ''
  rank: string
  entries: DisciplineEntryForm[]
  basePricePerDiscipline: number
  clubDiscountPercent?: number | null
  discountRules?: CategoryDiscountRuleLike[]
  fallbackPricePerDiscipline: number
  onChange: (entries: DisciplineEntryForm[]) => void
  /** В админке категории редактируются без блокировок по оплате. */
  mode?: 'registration' | 'admin'
}

function emptyEntry(discipline: string, rank: string): DisciplineEntryForm {
  return {
    discipline,
    ageDivisionId: '',
    weightCategoryId: '',
    experienceLevel: getDefaultExperienceLevel(rank),
  }
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={cn(
        'size-[1.125rem] shrink-0 text-muted transition-transform duration-[280ms] ease-[cubic-bezier(0.22,1,0.36,1)]',
        expanded && 'rotate-180',
      )}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
        clipRule="evenodd"
      />
    </svg>
  )
}

export function CategoryFields({
  birthDate,
  gender,
  rank,
  entries,
  basePricePerDiscipline,
  clubDiscountPercent = null,
  discountRules = [],
  fallbackPricePerDiscipline,
  onChange,
  mode = 'registration',
}: CategoryFieldsProps) {
  const isAdmin = mode === 'admin'
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set(entries.length ? [0] : []))
  const canSelectCategories = Boolean(birthDate && gender)
  const eligibleDivisions =
    canSelectCategories && gender ? getEligibleAgeDivisions(birthDate, gender) : []
  const noviceAllowed = canRegisterAsNovice(rank)

  useEffect(() => {
    if (entries.length === 0) {
      setExpanded(new Set())
      return
    }
    setExpanded((prev) => {
      const valid = new Set<number>()
      prev.forEach((index) => {
        if (index < entries.length) valid.add(index)
      })
      if (valid.size === 0) valid.add(entries.length - 1)
      return valid
    })
  }, [entries.length])

  const addCategory = (disciplineId: string) => {
    const newIndex = entries.length
    onChange([...entries, emptyEntry(disciplineId, rank)])
    setExpanded(collapseCompleteIndices(entries, isCategoryComplete, newIndex))
  }

  const removeCategory = (index: number) => {
    const entry = entries[index]
    if (!isAdmin && entry.paymentStatus && isLockedEntryStatus(entry.paymentStatus)) return
    if (
      isAdmin &&
      entry.paymentStatus &&
      isLockedEntryStatus(entry.paymentStatus) &&
      !window.confirm(
        `Удалить категорию со статусом «${entry.paymentStatusLabel ?? entry.paymentStatus}»? Это не отменит оплату автоматически.`,
      )
    ) {
      return
    }
    onChange(entries.filter((_, i) => i !== index))
    setExpanded((prev) => {
      const next = new Set<number>()
      prev.forEach((i) => {
        if (i < index) next.add(i)
        if (i > index) next.add(i - 1)
      })
      return next
    })
  }

  const patchCategory = (index: number, patch: Partial<DisciplineEntryForm>) => {
    const entry = entries[index]
    if (!isAdmin && entry.paymentStatus && isLockedEntryStatus(entry.paymentStatus)) return
    onChange(entries.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }

  const toggleExpanded = (index: number) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  return (
    <div>
      {!canSelectCategories && (
        <p className="text-sm text-muted">
          Укажите дату рождения и пол, чтобы добавить категорию. Возрастная группа подбирается на{' '}
          {tournamentInfo.eventDateLabel}.
        </p>
      )}
      {entries.length > 0 && (
        <div className="flex flex-col gap-2.5">
          {entries.map((entry, index) => {
            const weights = getAvailableWeightCategories(entries, index)
            const disciplineLabel = getDisciplineLabel(entry.discipline, true)
            const isExpanded = expanded.has(index)
            const complete = isCategoryComplete(entry)
            const locked = !isAdmin && Boolean(entry.paymentStatus && isLockedEntryStatus(entry.paymentStatus))
            const showPaymentBadge = Boolean(entry.paymentStatus && entry.paymentStatus !== 'UNPAID')
            const displayPrice =
              entry.price ??
              (complete && entry.ageDivisionId
                ? resolveEntryPrice(
                    basePricePerDiscipline,
                    {
                      discipline: entry.discipline,
                      experienceLevel: entry.experienceLevel,
                      ageDivisionId: entry.ageDivisionId,
                    },
                    discountRules,
                    clubDiscountPercent,
                  )
                : fallbackPricePerDiscipline)
            const summary =
              complete && entry.ageDivisionId && entry.weightCategoryId
                ? getTournamentCategoryLabel(
                    entry.ageDivisionId,
                    entry.weightCategoryId,
                    entry.experienceLevel,
                  )
                : regCopy.categoryIncomplete

            return (
              <div
                key={entry.entryId ?? `${index}-${entry.discipline}`}
                className={cn(
                  'overflow-hidden rounded-xl border border-border bg-card',
                  locked &&
                    'border-accent/30 bg-accent-soft/10',
                  !isExpanded && 'transition-[border-color,box-shadow] duration-150 hover:border-[rgb(15_20_25/0.14)] hover:shadow-[0_1px_3px_rgb(15_20_25/0.04)]',
                )}
              >
                <div
                  className={cn(
                    'flex items-center justify-between gap-3 border-b border-transparent px-3 py-2.5 transition-[border-color] duration-[280ms]',
                    !isExpanded && 'py-2.5 max-[479px]:flex-wrap max-[479px]:gap-2',
                    isExpanded && 'border-border',
                  )}
                >
                  <Button
                    type="button"
                    variant="ghost"
                    className="flex h-auto min-h-0 min-w-0 flex-1 items-center justify-start gap-2 p-0 text-left hover:bg-transparent"
                    aria-expanded={isExpanded}
                    onClick={() => toggleExpanded(index)}
                  >
                    <ChevronIcon expanded={isExpanded} />
                    <span className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1.5">
                      <DisciplineBadge discipline={entry.discipline} size="sm">
                        {disciplineLabel}
                      </DisciplineBadge>
                      {complete && (
                        <span className="text-sm font-medium leading-snug text-foreground">{summary}</span>
                      )}
                      {!complete && (
                        <span className="text-sm font-normal leading-snug text-muted">
                          {regCopy.categoryIncomplete}
                        </span>
                      )}
                    </span>
                  </Button>
                  <div
                    className={cn(
                      'flex shrink-0 items-center gap-3',
                      isAdmin && 'flex-wrap justify-end gap-1.5',
                      !isExpanded && 'max-[479px]:w-full max-[479px]:justify-between max-[479px]:pl-[1.625rem]',
                    )}
                  >
                    {showPaymentBadge && entry.paymentStatusLabel && entry.paymentStatus && (
                      <EntryPaymentStatusBadge
                        status={entry.paymentStatus}
                        label={entry.paymentStatusLabel}
                      />
                    )}
                    <span className="whitespace-nowrap rounded-lg bg-accent-soft px-2 py-1 text-[0.8125rem] font-bold leading-tight text-accent">
                      {formatMoney(displayPrice, { plus: false })}
                    </span>
                    {!locked && (
                      <Button
                        type="button"
                        variant="ghost"
                        className="min-h-11 px-1.5 text-xs font-semibold text-muted hover:text-accent"
                        onClick={(e) => {
                          e.stopPropagation()
                          removeCategory(index)
                        }}
                      >
                        Удалить
                      </Button>
                    )}
                    {locked && !isAdmin && (
                      <span className="whitespace-nowrap text-xs font-semibold text-muted">
                        {regCopy.lockedCategoryHint}
                      </span>
                    )}
                  </div>
                </div>

                <CollapsePanel open={isExpanded}>
                  <div className="p-3">
                    <div className="grid grid-cols-1 items-start gap-2.5 sm:grid-cols-[minmax(5.5rem,0.7fr)_minmax(0,1.15fr)_minmax(0,1fr)] [&_label]:text-[0.8125rem]">
                      <EventSelect
                        label={regCopy.divisionLabel}
                        value={entry.experienceLevel}
                        disabled={locked || !noviceAllowed}
                        onChange={(e) =>
                          patchCategory(index, {
                            experienceLevel: e.target.value as DisciplineEntryForm['experienceLevel'],
                            weightCategoryId: '',
                          })
                        }
                      >
                        {(noviceAllowed
                          ? experienceLevelOptions
                          : experienceLevelOptions.filter((o) => o.id === 'experienced')
                        ).map((level) => (
                          <option key={level.id} value={level.id}>{level.label}</option>
                        ))}
                      </EventSelect>

                      <EventSelect
                        label="Возраст"
                        value={entry.ageDivisionId}
                        disabled={locked || !canSelectCategories}
                        onChange={(e) =>
                          patchCategory(index, {
                            ageDivisionId: e.target.value,
                            weightCategoryId: '',
                          })
                        }
                      >
                        <option value="">Выберите</option>
                        {eligibleDivisions.map((division) => {
                          const ageUp =
                            gender && isAgeUpDivision(birthDate, gender, division.id)
                          return (
                            <option key={division.id} value={division.id}>
                              {formatAgeDivisionAgeRange(division)}
                              {ageUp ? ` (${regCopy.ageUpOptionSuffix})` : ''}
                            </option>
                          )
                        })}
                      </EventSelect>

                      <EventSelect
                        label="Вес"
                        value={entry.weightCategoryId}
                        disabled={locked || !entry.ageDivisionId}
                        onChange={(e) => patchCategory(index, { weightCategoryId: e.target.value })}
                      >
                        <option value="">Выберите</option>
                        {weights.map((weight) => (
                          <option key={weight.id} value={weight.id}>{weight.label}</option>
                        ))}
                      </EventSelect>
                    </div>

                    {complete && !isAdmin && (
                      <p className="mt-2 text-xs leading-snug text-muted">{summary}</p>
                    )}
                  </div>
                </CollapsePanel>
              </div>
            )
          })}
        </div>
      )}

      <div className="mt-3.5">
        <p className="mb-2 text-[0.8125rem] font-semibold text-foreground">{regCopy.addCategoryTitle}</p>
        <div className="flex flex-wrap gap-2">
          {tournamentDisciplines.map((d) => (
            <Button
              key={d.id}
              type="button"
              variant="ghost"
              disabled={!canSelectCategories}
              onClick={() => addCategory(d.id)}
              className="rounded-[0.625rem] border border-border bg-card px-3.5 py-2 text-[0.8125rem] font-semibold text-accent hover:border-accent/25 hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-50"
            >
              {d.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}
