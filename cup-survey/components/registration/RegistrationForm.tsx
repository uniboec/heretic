'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { CollapsePanel } from '@/components/ui/CollapsePanel'
import { cn } from '@/lib/cn'
import { paymentUi } from '@/lib/ui/eventSurfaceStyles'
import { semanticAlertClasses } from '@/lib/ui/semanticSurfaceStyles'
import { EventInput, EventPhoneInput, EventSelect } from './EventFormFields'
import { getRegistrationPublicErrorMessage } from '@/lib/registration/publicErrorMessages'
import { withBasePath } from '@/lib/basePath'
import { readJsonResponse } from '@/lib/http/readJsonResponse'
import { routes } from '@/lib/routes'
import { formatMoney } from '@/lib/formatMoney'
import { getDefaultExperienceLevel } from '@/lib/config/experienceLevel'
import { genderOptions } from '@/lib/config/tournament'
import { getEligibleSportRankGroups, sanitizeRankForBirthDate } from '@/lib/registration/rankRules'
import { tournamentPageCopy } from '@/lib/content/tournament-page'
import { ClubSelector } from './ClubSelector'
import { DisciplineCategoryFields } from './DisciplineCategoryFields'
import { formatAthleteFullName } from '@/lib/registration/athleteName'
import { getDeviceToken, registrationDeviceHeaders } from '@/lib/registration/deviceClient'
import {
  collapseCompleteIndices,
  isAthletePersonalComplete,
  sanitizeDisciplineEntries,
} from './registrationFormUtils'
import { isLockedEntryStatus } from '@/lib/registration/editRules'
import type { EntryPaymentStatus } from '@/lib/registration/status'
import {
  applyClubDiscount,
  resolveEntryPrice,
  type CategoryDiscountRuleLike,
} from '@/lib/registration/pricing'
import { PriceWithDiscount } from './PriceWithDiscount'

const regCopy = tournamentPageCopy.registration

export interface DisciplineEntryForm {
  entryId?: string
  discipline: string
  ageDivisionId: string
  weightCategoryId: string
  experienceLevel: 'novice' | 'experienced'
  paymentStatus?: EntryPaymentStatus
  paymentStatusLabel?: string
  price?: number
}

export interface AthleteFormRow {
  athleteId?: string
  lastName: string
  firstName: string
  middleName: string
  birthDate: string
  gender: 'male' | 'female' | ''
  rank: string
  disciplineEntries: DisciplineEntryForm[]
}

export interface TeamFormData {
  clubId: string | null
  clubName: string
  city: string
  phone: string
  email: string
  athletes: AthleteFormRow[]
  consentPersonalData: boolean
  consentPublication: boolean
}

const emptyAthlete = (): AthleteFormRow => ({
  lastName: '',
  firstName: '',
  middleName: '',
  birthDate: '',
  gender: '',
  rank: 'none',
  disciplineEntries: [],
})

const emptyTeam = (): TeamFormData => ({
  clubId: null,
  clubName: '',
  city: '',
  phone: '',
  email: '',
  athletes: [emptyAthlete()],
  consentPersonalData: false,
  consentPublication: false,
})

const genderLabel = (id: string) =>
  genderOptions.find((g) => g.id === id)?.label ?? id

function athleteFieldId(index: number, field: string) {
  return `reg-athlete-${index}-${field}`
}

function athleteAutoComplete(index: number, token: string) {
  return `section-reg-athlete-${index} ${token}`
}

function entryAmount(
  entry: DisciplineEntryForm,
  basePricePerDiscipline: number,
  clubDiscountPercent: number | null,
  discountRules: CategoryDiscountRuleLike[],
  fallbackPrice: number,
): number {
  if (entry.price != null) return entry.price
  if (!entry.ageDivisionId || !entry.weightCategoryId) return fallbackPrice
  return resolveEntryPrice(
    basePricePerDiscipline,
    {
      discipline: entry.discipline,
      experienceLevel: entry.experienceLevel,
      ageDivisionId: entry.ageDivisionId,
    },
    discountRules,
    clubDiscountPercent,
  )
}

function athleteEntryTotal(
  athlete: AthleteFormRow,
  basePricePerDiscipline: number,
  clubDiscountPercent: number | null,
  discountRules: CategoryDiscountRuleLike[],
  fallbackPrice: number,
): number {
  return athlete.disciplineEntries.reduce(
    (sum, entry) =>
      sum +
      entryAmount(entry, basePricePerDiscipline, clubDiscountPercent, discountRules, fallbackPrice),
    0,
  )
}

function athleteHasLockedEntries(athlete: AthleteFormRow): boolean {
  return athlete.disciplineEntries.some(
    (entry) => entry.paymentStatus && isLockedEntryStatus(entry.paymentStatus),
  )
}

interface Props {
  editToken?: string
  initialData?: TeamFormData
  lockedPricePerDiscipline?: number
}

export function RegistrationForm({ editToken, initialData, lockedPricePerDiscipline }: Props) {
  const router = useRouter()
  const [data, setData] = useState<TeamFormData>(initialData ?? emptyTeam())
  const initialClubIdRef = useRef(initialData?.clubId ?? null)
  const [basePricePerDiscipline, setBasePricePerDiscipline] = useState(1500)
  const [clubDiscountPercent, setClubDiscountPercent] = useState<number | null>(null)
  const [discountRules, setDiscountRules] = useState<CategoryDiscountRuleLike[]>([])
  const [stageLabel, setStageLabel] = useState('')
  const [closed, setClosed] = useState(false)
  const [editCode, setEditCode] = useState('')
  const [errors, setErrors] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [clientReady, setClientReady] = useState(false)
  const [expandedAthletes, setExpandedAthletes] = useState<Set<number>>(() => new Set([0]))
  const errorsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setClientReady(true)
  }, [])

  useEffect(() => {
    fetch(withBasePath('/api/tournament/state'))
      .then((response) =>
        readJsonResponse<{
          closed?: boolean
          stage?: { pricePerDiscipline?: number; label?: string }
          discountRules?: unknown[]
        }>(response),
      )
      .then((result) => {
        if (!result.ok) return
        setClosed(Boolean(result.data.closed))
        setBasePricePerDiscipline(result.data.stage?.pricePerDiscipline ?? 1500)
        setStageLabel(result.data.stage?.label ?? '')
        setDiscountRules((result.data.discountRules ?? []) as CategoryDiscountRuleLike[])
      })
      .catch(() => undefined)
  }, [])

  const pricePerDiscipline = useMemo(() => {
    const clubChanged = Boolean(editToken && data.clubId !== initialClubIdRef.current)
    if (editToken && lockedPricePerDiscipline != null && !clubChanged) {
      return lockedPricePerDiscipline
    }
    return applyClubDiscount(basePricePerDiscipline, clubDiscountPercent)
  }, [
    editToken,
    lockedPricePerDiscipline,
    data.clubId,
    basePricePerDiscipline,
    clubDiscountPercent,
  ])

  const totals = useMemo(() => {
    const entryCount = data.athletes.reduce((sum, athlete) => sum + athlete.disciplineEntries.length, 0)
    const totalAmount = data.athletes.reduce(
      (sum, athlete) =>
        sum +
        athleteEntryTotal(
          athlete,
          basePricePerDiscipline,
          clubDiscountPercent,
          discountRules,
          pricePerDiscipline,
        ),
      0,
    )
    const baseTotalAmount = entryCount * basePricePerDiscipline
    return { entryCount, totalAmount, baseTotalAmount }
  }, [
    data.athletes,
    basePricePerDiscipline,
    clubDiscountPercent,
    discountRules,
    pricePerDiscipline,
  ])

  const patch = (partial: Partial<TeamFormData>) => setData((prev) => ({ ...prev, ...partial }))

  const patchAthlete = (index: number, partial: Partial<AthleteFormRow>) => {
    setData((prev) => ({
      ...prev,
      athletes: prev.athletes.map((a, i) => (i === index ? { ...a, ...partial } : a)),
    }))
  }

  const patchAthleteBirthDate = (index: number, birthDate: string) => {
    const athlete = data.athletes[index]
    if (athleteHasLockedEntries(athlete)) return
    const rank = sanitizeRankForBirthDate(athlete.rank, birthDate)
    const rankChanged = rank !== athlete.rank
    let disciplineEntries = athlete.disciplineEntries
    if (rankChanged) {
      disciplineEntries = disciplineEntries.map((entry) => ({
        ...entry,
        experienceLevel: getDefaultExperienceLevel(rank),
      }))
    }
    patchAthlete(index, {
      birthDate,
      rank,
      disciplineEntries: sanitizeDisciplineEntries(birthDate, athlete.gender, disciplineEntries),
    })
  }

  const addAthlete = () => {
    const newIndex = data.athletes.length
    patch({ athletes: [...data.athletes, emptyAthlete()] })
    setExpandedAthletes(collapseCompleteIndices(data.athletes, isAthletePersonalComplete, newIndex))
  }

  const removeAthlete = (index: number) => {
    if (athleteHasLockedEntries(data.athletes[index])) return
    patch({ athletes: data.athletes.filter((_, i) => i !== index) })
    setExpandedAthletes((prev) => {
      const next = new Set<number>()
      prev.forEach((i) => {
        if (i < index) next.add(i)
        if (i > index) next.add(i - 1)
      })
      if (next.size === 0 && data.athletes.length > 1) next.add(0)
      return next
    })
  }

  const toggleAthleteExpanded = (index: number) => {
    setExpandedAthletes((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  const showErrors = (messages: string[]) => {
    setErrors(messages)
    requestAnimationFrame(() => {
      errorsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }

  const submit = async () => {
    setSubmitting(true)
    setErrors([])

    const payload = {
      ...(data.clubId ? { clubId: data.clubId } : { clubName: data.clubName, city: data.city }),
      phone: data.phone,
      email: data.email,
      consentPersonalData: data.consentPersonalData,
      consentPublication: data.consentPublication,
      ...(!editToken ? { editCode, deviceToken: getDeviceToken() } : {}),
      athletes: data.athletes.map((a) => ({
        ...(a.athleteId ? { athleteId: a.athleteId } : {}),
        lastName: a.lastName,
        firstName: a.firstName,
        middleName: a.middleName || undefined,
        birthDate: a.birthDate,
        gender: a.gender,
        rank: a.rank,
        disciplineEntries: a.disciplineEntries.map((entry) => ({
          ...(entry.entryId ? { entryId: entry.entryId } : {}),
          discipline: entry.discipline,
          ageDivisionId: entry.ageDivisionId,
          weightCategoryId: entry.weightCategoryId,
          experienceLevel: entry.experienceLevel,
        })),
      })),
    }

    const url = editToken
      ? withBasePath(`/api/registrations/edit/${editToken}`)
      : withBasePath('/api/registrations')
    const method = editToken ? 'PATCH' : 'POST'

    try {
      const result = await readJsonResponse<{ id?: string; error?: string; errors?: string[] }>(
        await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...registrationDeviceHeaders(),
          },
          body: JSON.stringify(payload),
        }),
      )

      if (!result.ok) {
        const payload = result.body as { errors?: string[]; error?: string } | undefined
        if (payload?.errors?.length) {
          showErrors(payload.errors)
          return
        }
        showErrors([
          getRegistrationPublicErrorMessage(
            payload?.error,
            'Не удалось отправить заявку. Проверьте данные и попробуйте снова.',
          ),
        ])
        return
      }

      if (!result.data.id) {
        showErrors(['Заявка отправлена, но не удалось открыть страницу подтверждения.'])
        return
      }

      router.push(withBasePath(routes.registration(result.data.id)))
    } catch {
      showErrors(['Не удалось отправить заявку. Проверьте подключение к интернету и попробуйте снова.'])
    } finally {
      setSubmitting(false)
    }
  }

  if (closed) {
    return (
      <Card className="py-12 text-center text-muted">Регистрация закрыта.</Card>
    )
  }

  return (
    <>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_17.5rem] lg:gap-6">
        <div className="flex flex-col gap-4">
          <FormSection title={regCopy.clubStepTitle} hint={regCopy.clubStepHint}>
            <ClubSelector
              value={{ clubId: data.clubId, clubName: data.clubName, city: data.city }}
              onChange={(club) => {
                patch({ clubId: club.clubId, clubName: club.clubName, city: club.city })
                setClubDiscountPercent(club.discountPercent ?? null)
              }}
            />
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <EventPhoneInput
                label="Телефон"
                hint="Обязательно"
                required
                value={data.phone}
                onChange={(v) => patch({ phone: v })}
              />
              <EventInput
                label="Электронная почта"
                hint="Необязательно"
                type="email"
                autoComplete="email"
                value={data.email}
                onChange={(e) => patch({ email: e.target.value })}
              />
            </div>
          </FormSection>

          <FormSection title={regCopy.athletesStepTitle} hint={regCopy.athletesStepHint}>
            <div className="flex flex-col gap-3.5">
              {data.athletes.map((athlete, index) => {
                const amount = athleteEntryTotal(
                  athlete,
                  basePricePerDiscipline,
                  clubDiscountPercent,
                  discountRules,
                  pricePerDiscipline,
                )
                const displayName = formatAthleteFullName(athlete)
                const isExpanded = expandedAthletes.has(index)
                const personalComplete = isAthletePersonalComplete(athlete)
                const hasLockedEntries = athleteHasLockedEntries(athlete)
                const metaParts: string[] = []
                if (athlete.gender) metaParts.push(genderLabel(athlete.gender))
                if (athlete.disciplineEntries.length > 0) {
                  metaParts.push(
                    `${athlete.disciplineEntries.length} кат. · ${formatMoney(amount, { plus: false })}`,
                  )
                }
                const summary =
                  displayName || metaParts.length > 0
                    ? [displayName, ...metaParts].filter(Boolean).join(' · ')
                    : regCopy.athleteIncomplete
                const eligibleRankGroups = getEligibleSportRankGroups(athlete.birthDate)

                return (
                  <article
                    key={index}
                    className="overflow-hidden rounded-[0.875rem] border border-border bg-background-soft"
                  >
                    <div
                      className={cn(
                        'flex items-center justify-between gap-3 border-b border-transparent bg-card px-4 py-3 transition-[border-color] duration-[280ms] max-sm:flex-col max-sm:items-stretch max-sm:gap-2.5',
                        isExpanded && 'border-border',
                      )}
                    >
                      <Button
                        type="button"
                        variant="ghost"
                        className="flex h-auto min-h-0 min-w-0 flex-1 items-start justify-start gap-2 p-0 text-left hover:bg-transparent"
                        aria-expanded={isExpanded}
                        onClick={() => toggleAthleteExpanded(index)}
                      >
                        <AthleteChevron expanded={isExpanded} />
                        <span className="min-w-0">
                          <p className="text-[0.9375rem] font-bold text-foreground">Спортсмен {index + 1}</p>
                          <p className="mt-1 text-xs leading-snug text-muted">{summary}</p>
                        </span>
                      </Button>
                      <div className="flex shrink-0 items-center gap-2.5 max-sm:w-full max-sm:justify-between max-sm:pl-[1.625rem]">
                        {!isExpanded && personalComplete && (
                          <span className="text-xs font-semibold text-muted max-sm:whitespace-normal max-sm:text-left">
                            {regCopy.expandItem}
                          </span>
                        )}
                        {data.athletes.length > 1 && !hasLockedEntries && (
                          <Button
                            type="button"
                            variant="ghost"
                            className="min-h-11 shrink-0 px-2 text-[0.8125rem] font-semibold text-accent"
                            onClick={() => removeAthlete(index)}
                          >
                            Удалить
                          </Button>
                        )}
                        {hasLockedEntries && (
                          <span className="text-xs font-semibold text-muted max-sm:whitespace-normal max-sm:text-left">
                            {regCopy.lockedAthleteHint}
                          </span>
                        )}
                      </div>
                    </div>

                    <CollapsePanel open={isExpanded}>
                    <div className="px-4 py-4 max-sm:px-3.5">
                      <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-muted">
                        {regCopy.personalDataTitle}
                      </h3>
                      <div className="grid min-w-0 items-start gap-3.5 sm:grid-cols-3">
                        <EventInput
                          id={athleteFieldId(index, 'last-name')}
                          name={`athlete_${index}_last_name`}
                          label="Фамилия"
                          autoComplete={athleteAutoComplete(index, 'family-name')}
                          value={athlete.lastName}
                          onChange={(e) => patchAthlete(index, { lastName: e.target.value })}
                        />
                        <EventInput
                          id={athleteFieldId(index, 'first-name')}
                          name={`athlete_${index}_first_name`}
                          label="Имя"
                          autoComplete={athleteAutoComplete(index, 'given-name')}
                          value={athlete.firstName}
                          onChange={(e) => patchAthlete(index, { firstName: e.target.value })}
                        />
                        <EventInput
                          id={athleteFieldId(index, 'middle-name')}
                          name={`athlete_${index}_middle_name`}
                          label={regCopy.middleNameLabel}
                          autoComplete="off"
                          data-1p-ignore
                          data-lpignore="true"
                          value={athlete.middleName}
                          onChange={(e) => patchAthlete(index, { middleName: e.target.value })}
                        />
                        <EventInput
                          id={athleteFieldId(index, 'birth-date')}
                          name={`athlete_${index}_birth_date`}
                          label="Дата рождения"
                          type="date"
                          autoComplete={athleteAutoComplete(index, 'bday')}
                          value={athlete.birthDate}
                          disabled={hasLockedEntries}
                          onChange={(e) => patchAthleteBirthDate(index, e.target.value)}
                        />
                        <EventSelect
                          id={athleteFieldId(index, 'gender')}
                          name={`athlete_${index}_gender`}
                          label="Пол"
                          autoComplete={athleteAutoComplete(index, 'sex')}
                          value={athlete.gender}
                          disabled={hasLockedEntries}
                          onChange={(e) => {
                            if (hasLockedEntries) return
                            const gender = e.target.value as AthleteFormRow['gender']
                            patchAthlete(index, {
                              gender,
                              disciplineEntries: sanitizeDisciplineEntries(
                                athlete.birthDate,
                                gender,
                                athlete.disciplineEntries,
                              ),
                            })
                          }}
                        >
                          <option value="">Выберите</option>
                          {genderOptions.map((g) => (
                            <option key={g.id} value={g.id}>{g.label}</option>
                          ))}
                        </EventSelect>
                        <EventSelect
                          id={athleteFieldId(index, 'rank')}
                          name={`athlete_${index}_rank`}
                          label="Разряд"
                          autoComplete="off"
                          disabled={!athlete.birthDate}
                          value={athlete.rank}
                          onChange={(e) => {
                            const rank = e.target.value
                            patchAthlete(index, {
                              rank,
                              disciplineEntries: athlete.disciplineEntries.map((entry) => ({
                                ...entry,
                                experienceLevel:
                                  entry.paymentStatus && isLockedEntryStatus(entry.paymentStatus)
                                    ? entry.experienceLevel
                                    : getDefaultExperienceLevel(rank),
                              })),
                            })
                          }}
                        >
                          {eligibleRankGroups.map((group) => (
                            <optgroup key={group.label} label={group.label}>
                              {group.options.map((rank) => (
                                <option key={rank.id} value={rank.id}>{rank.label}</option>
                              ))}
                            </optgroup>
                          ))}
                        </EventSelect>
                      </div>
                    </div>

                    <div className="border-t border-border px-4 py-4 max-sm:px-3.5">
                      <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-muted">
                        {regCopy.categoriesTitle}
                      </h3>
                      {hasLockedEntries && (
                        <p className="mb-3 text-sm text-muted">{regCopy.lockedPersonalHint}</p>
                      )}
                      <DisciplineCategoryFields
                        birthDate={athlete.birthDate}
                        gender={athlete.gender}
                        rank={athlete.rank}
                        entries={athlete.disciplineEntries}
                        basePricePerDiscipline={basePricePerDiscipline}
                        clubDiscountPercent={clubDiscountPercent}
                        discountRules={discountRules}
                        fallbackPricePerDiscipline={pricePerDiscipline}
                        onChange={(disciplineEntries) => patchAthlete(index, { disciplineEntries })}
                      />
                      {editToken && (
                        <p className="mt-3 text-sm text-muted">{regCopy.newCategoryPaymentNote}</p>
                      )}
                      {athlete.disciplineEntries.length > 0 && (
                        <p className="mt-3 text-sm text-muted">
                          {athlete.disciplineEntries.length} кат.
                          {athlete.disciplineEntries.length === 1 ? 'егория' : athlete.disciplineEntries.length < 5 ? 'егории' : 'егорий'}
                          {' · '}
                          <strong className="font-bold text-foreground">{formatMoney(amount, { plus: false })}</strong>
                        </p>
                      )}
                    </div>
                    </CollapsePanel>
                  </article>
                )
              })}
            </div>
            <Button
              type="button"
              variant="secondary"
              className="mt-3.5 min-h-11 w-full sm:w-auto"
              onClick={addAthlete}
            >
              {regCopy.addAthlete}
            </Button>
          </FormSection>

          <FormSection title={regCopy.confirmStepTitle}>
            {!editToken && clientReady && (
              <div className="mb-5">
                <div
                  className="mb-4 flex items-start gap-3 rounded-xl border border-accent/30 bg-gradient-to-b from-accent-soft to-card p-3.5 shadow-[0_1px_2px_rgb(from_var(--color-accent)_r_g_b/0.06)]"
                  role="note"
                >
                  <span
                    className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-extrabold leading-none text-card"
                    aria-hidden="true"
                  >
                    !
                  </span>
                  <p className="m-0 text-[0.9375rem] font-medium leading-snug text-foreground">
                    {regCopy.editCodeNotice}{' '}
                    <strong className="font-extrabold text-accent">{regCopy.editCodeNoticeEmphasis}</strong>
                  </p>
                </div>
                <EventInput
                  label={regCopy.editCodeLabel}
                  type="password"
                  name="registration-edit-code"
                  autoComplete="off"
                  data-1p-ignore
                  data-lpignore="true"
                  value={editCode}
                  onChange={(e) => setEditCode(e.target.value)}
                  placeholder={regCopy.editCodePlaceholder}
                />
              </div>
            )}

            <div className="rounded-xl border border-border bg-background-soft p-4">
              <p className="mb-3 text-[0.8125rem] font-bold text-foreground">{regCopy.consentBlockTitle}</p>
              <label className="flex cursor-pointer items-start gap-3 text-sm leading-normal text-foreground">
                <Input controlOnly type="checkbox" className="mt-0.5 size-[1.125rem] w-auto min-h-0 shrink-0 accent-accent" checked={data.consentPersonalData} onChange={(e) => patch({ consentPersonalData: e.target.checked })} />
                <span>Согласен на обработку персональных данных</span>
              </label>
              <label className="mt-2.5 flex cursor-pointer items-start gap-3 text-sm leading-normal text-foreground">
                <Input controlOnly type="checkbox" className="mt-0.5 size-[1.125rem] w-auto min-h-0 shrink-0 accent-accent" checked={data.consentPublication} onChange={(e) => patch({ consentPublication: e.target.checked })} />
                <span>Согласен на публикацию в списке участников</span>
              </label>
            </div>

            {errors.length > 0 && (
              <div ref={errorsRef} className={cn(semanticAlertClasses.danger, 'mt-4')} role="alert">
                {errors.map((e) => <p key={e}>{e}</p>)}
              </div>
            )}

            <div className="mt-5 flex flex-col-reverse items-stretch gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
              <Link
                href={withBasePath('/')}
                className="text-center text-sm font-semibold text-muted transition-colors hover:text-accent"
              >
                {regCopy.backToTournament}
              </Link>
              <Button
                type="button"
                className="min-h-12 w-full px-8 sm:w-auto sm:min-w-56"
                onClick={submit}
                disabled={submitting}
              >
                {submitting ? 'Отправка…' : editToken ? 'Сохранить' : 'Зарегистрироваться'}
              </Button>
            </div>
          </FormSection>
        </div>

        <aside
          className="hidden rounded-card border border-border bg-card p-5 shadow-[0_4px_24px_rgb(15_20_25/0.06)] lg:sticky lg:top-[5.5rem] lg:block"
          aria-label="Итого по заявке"
        >
          <p className="text-[0.6875rem] font-bold uppercase tracking-wide text-muted">Итого</p>
          {stageLabel && <p className="mt-1 text-[0.8125rem] font-semibold text-accent">{stageLabel}</p>}
          <p className="mt-2 text-[2rem] font-extrabold tabular-nums leading-none tracking-tight text-foreground">
            <PriceWithDiscount
              amount={totals.totalAmount}
              originalAmount={
                totals.totalAmount < totals.baseTotalAmount ? totals.baseTotalAmount : null
              }
              size="lg"
            />
          </p>
          {totals.entryCount > 0 && (
            <p className="mt-1.5 text-sm font-semibold text-foreground">
              {regCopy.summaryCategories(totals.entryCount, formatMoney(totals.totalAmount, { plus: false }))}
            </p>
          )}
          <p className="mt-1 text-xs text-muted">
            <PriceWithDiscount
              amount={pricePerDiscipline}
              originalAmount={
                clubDiscountPercent && pricePerDiscipline < basePricePerDiscipline
                  ? basePricePerDiscipline
                  : null
              }
              size="sm"
            />
            {' '}за категорию
          </p>
          {clubDiscountPercent && clubDiscountPercent > 0 && pricePerDiscipline < basePricePerDiscipline && (
            <p className={cn(paymentUi.discountText, 'mt-1 text-xs')}>
              <span className={cn(paymentUi.discountBadge, 'mr-2')}>−{clubDiscountPercent}%</span>
              Скидка клуба
            </p>
          )}

          {data.athletes.some((a) => a.disciplineEntries.length > 0 || formatAthleteFullName(a)) && (
            <>
              <div className="my-4 border-t border-border" />
              <p className="text-[0.6875rem] font-bold uppercase tracking-wide text-muted">
                {regCopy.summaryAthletes}
              </p>
              <ul className="mt-2.5 flex flex-col gap-2.5">
                {data.athletes.map((a, i) => {
                  const amount = athleteEntryTotal(
                    a,
                    basePricePerDiscipline,
                    clubDiscountPercent,
                    discountRules,
                    pricePerDiscipline,
                  )
                  const displayName = formatAthleteFullName(a)
                  if (!displayName && !a.disciplineEntries.length) return null
                  return (
                    <li key={i} className="text-[0.8125rem] leading-snug">
                      <span className="block font-semibold text-foreground">
                        {displayName || `Спортсмен ${i + 1}`}
                      </span>
                      {a.disciplineEntries.length > 0 && (
                        <span className="mt-0.5 block text-muted">
                          {a.disciplineEntries.length} кат. — {formatMoney(amount, { plus: false })}
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>
            </>
          )}

          <p className="mt-4 text-[0.6875rem] leading-snug text-muted">{regCopy.summaryPaymentNote}</p>
          <p className="mt-2 text-xs font-semibold text-accent">Проверьте данные перед отправкой</p>
        </aside>
      </div>

      <div
        className="fixed inset-x-2 bottom-[calc(0.5rem+env(safe-area-inset-bottom,0px))] z-[45] flex items-center justify-between gap-3 rounded-xl border border-border bg-white/97 p-2.5 shadow-[0_8px_32px_rgb(15_20_25/0.14)] backdrop-blur-xl sm:inset-x-3 sm:bottom-[calc(0.75rem+env(safe-area-inset-bottom,0px))] sm:p-3 sm:px-4 lg:hidden"
        role="region"
        aria-label="Итого по заявке"
      >
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted">Итого</p>
          <p className="text-xl font-extrabold tabular-nums text-accent">
            {formatMoney(totals.totalAmount, { plus: false })}
          </p>
        </div>
        <Button type="button" className="min-h-11 shrink-0 px-5" onClick={submit} disabled={submitting}>
          {submitting ? '…' : editToken ? 'Сохранить' : 'Отправить'}
        </Button>
      </div>
    </>
  )
}

function AthleteChevron({ expanded }: { expanded: boolean }) {
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

function FormSection({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <section className="overflow-visible rounded-card border border-border bg-card shadow-card">
      <header className="px-4 pt-4 max-sm:px-3.5 sm:px-5 sm:pt-5">
        <h2 className="text-[1.0625rem] font-bold text-foreground">{title}</h2>
        {hint && <p className="mt-1 text-[0.8125rem] leading-snug text-muted">{hint}</p>}
      </header>
      <div className="p-4 max-sm:px-3.5 sm:p-5 sm:pt-4">{children}</div>
    </section>
  )
}
