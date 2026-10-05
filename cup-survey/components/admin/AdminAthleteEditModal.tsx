'use client'

import { useEffect, useMemo, useState } from 'react'
import { withBasePath } from '@/lib/basePath'
import { readJsonResponse } from '@/lib/http/readJsonResponse'
import { genderOptions } from '@/lib/config/tournament'
import { getEligibleSportRankGroups, sanitizeRankForBirthDate } from '@/lib/registration/rankRules'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { cn } from '@/lib/cn'
import {
  adminAthleteFormGrid,
  adminAthleteModalActions,
  adminAthleteModalBody,
  adminAthleteModalFooter,
  adminAthleteModalTotal,
  adminAthletePanel,
  adminAthletePanelHint,
  adminAthletePanelTitle,
  adminModal,
  adminModalAthlete,
  adminModalBody,
  adminModalClose,
  adminModalErrors,
  adminModalEyebrow,
  adminModalFooter,
  adminModalHead,
  adminModalSubtitle,
  adminModalTitle,
  adminModalWide,
} from '@/lib/ui/adminSurfaceStyles'
import { AdminInput } from './AdminInput'
import { AdminSelect } from './AdminSelect'
import { CategoryFields } from '@/components/registration/CategoryFields'
import type { AthleteFormRow, DisciplineEntryForm } from '@/components/registration/RegistrationForm'
import { sanitizeDisciplineEntries } from '@/components/registration/registrationFormUtils'
import { formatAthleteFullName } from '@/lib/registration/athleteName'
import { formatMoney } from '@/lib/formatMoney'
import {
  resolveEntryPrice,
  type CategoryDiscountRuleLike,
} from '@/lib/registration/pricing'
import { getEntryPaymentStatusLabel } from '@/lib/registration/status'
import type { EntryPaymentStatus } from '@/lib/registration/status'
import { AdminEditCodePanel } from './AdminEditCodePanel'

export interface AdminAthleteDetail {
  id: string
  lastName: string
  firstName: string
  middleName: string | null
  birthDate: string
  gender: string
  rank: string | null
  entries: Array<{
    id?: string
    discipline: string
    ageDivisionId: string | null
    weightCategoryId: string | null
    experienceLevel: string
    price?: number
    paymentStatus?: string
    paymentStatusLabel?: string
    graceEligibleStageId?: string | null
    graceEligibleStageLabel?: string | null
    gracePrice?: number | null
  }>
}

interface Props {
  open: boolean
  mode?: 'edit' | 'create'
  standaloneCreate?: boolean
  athlete: AdminAthleteDetail | null
  pricePerDiscipline: number
  registrationId?: string | null
  registrationPublicNumber?: number
  hasEditCode?: boolean
  onClose: () => void
  onSaved: () => void
  onEditCodeUpdated?: () => void
  onSubmit?: (payload: {
    lastName: string
    firstName: string
    middleName?: string
    birthDate: string
    gender: string
    rank: string
    clubName?: string
    city?: string
    phone?: string
    disciplineEntries: Array<{
      discipline: string
      ageDivisionId: string
      weightCategoryId: string
      experienceLevel: string
    }>
  }) => Promise<{ ok: boolean; errors?: string[] }>
}

function emptyFormRow(): AthleteFormRow {
  return {
    lastName: '',
    firstName: '',
    middleName: '',
    birthDate: '',
    gender: '',
    rank: 'none',
    disciplineEntries: [],
  }
}

function toFormRow(athlete: AdminAthleteDetail): AthleteFormRow {
  return {
    lastName: athlete.lastName,
    firstName: athlete.firstName,
    middleName: athlete.middleName ?? '',
    birthDate: athlete.birthDate,
    gender: athlete.gender as 'male' | 'female' | '',
    rank: athlete.rank ?? 'none',
    disciplineEntries: athlete.entries.map((entry) => ({
      entryId: entry.id,
      discipline: entry.discipline,
      ageDivisionId: entry.ageDivisionId ?? '',
      weightCategoryId: entry.weightCategoryId ?? '',
      experienceLevel: entry.experienceLevel as 'novice' | 'experienced',
      paymentStatus: entry.paymentStatus as EntryPaymentStatus | undefined,
      paymentStatusLabel:
        entry.paymentStatusLabel ??
        (entry.paymentStatus
          ? getEntryPaymentStatusLabel(entry.paymentStatus as EntryPaymentStatus)
          : undefined),
      price: entry.price,
    })),
  }
}

function entryAmount(entry: DisciplineEntryForm, fallbackPrice: number): number {
  return entry.price ?? fallbackPrice
}

export function AdminAthleteEditModal({
  open,
  mode = 'edit',
  standaloneCreate = false,
  athlete,
  pricePerDiscipline,
  registrationId,
  registrationPublicNumber,
  hasEditCode = false,
  onClose,
  onSaved,
  onEditCodeUpdated,
  onSubmit,
}: Props) {
  const isCreate = mode === 'create'
  const [form, setForm] = useState<AthleteFormRow | null>(null)
  const [clubName, setClubName] = useState('')
  const [city, setCity] = useState('')
  const [phone, setPhone] = useState('')
  const [errors, setErrors] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [basePricePerDiscipline, setBasePricePerDiscipline] = useState(pricePerDiscipline)
  const [discountRules, setDiscountRules] = useState<CategoryDiscountRuleLike[]>([])

  useEffect(() => {
    if (!open) return
    fetch(withBasePath('/api/tournament/state'))
      .then((response) =>
        readJsonResponse<{
          stage?: { pricePerDiscipline?: number }
          discountRules?: CategoryDiscountRuleLike[]
        }>(response),
      )
      .then((result) => {
        if (!result.ok) {
          setBasePricePerDiscipline(pricePerDiscipline)
          setDiscountRules([])
          return
        }
        setBasePricePerDiscipline(result.data.stage?.pricePerDiscipline ?? pricePerDiscipline)
        setDiscountRules(result.data.discountRules ?? [])
      })
      .catch(() => {
        setBasePricePerDiscipline(pricePerDiscipline)
        setDiscountRules([])
      })
  }, [open, pricePerDiscipline])

  useEffect(() => {
    if (!open) {
      setForm(null)
      setClubName('')
      setCity('')
      setPhone('')
      setErrors([])
      return
    }
    if (isCreate) {
      setForm(emptyFormRow())
      setClubName('')
      setCity('')
      setPhone('')
      setErrors([])
      return
    }
    if (!athlete) {
      setForm(null)
      setErrors([])
      return
    }
    setForm(toFormRow(athlete))
    setErrors([])
  }, [open, athlete, isCreate])

  const rankGroups = useMemo(
    () => (form?.birthDate ? getEligibleSportRankGroups(form.birthDate) : []),
    [form?.birthDate],
  )

  const totalAmount = useMemo(() => {
    if (!form) return 0
    return form.disciplineEntries.reduce((sum, entry) => {
      if (entry.price != null) return sum + entry.price
      if (!entry.ageDivisionId || !entry.weightCategoryId) return sum + pricePerDiscipline
      return (
        sum +
        resolveEntryPrice(
          basePricePerDiscipline,
          {
            discipline: entry.discipline,
            experienceLevel: entry.experienceLevel,
            ageDivisionId: entry.ageDivisionId,
          },
          discountRules,
          null,
        )
      )
    }, 0)
  }, [form, basePricePerDiscipline, discountRules, pricePerDiscipline])

  const title = isCreate
    ? 'Новый спортсмен'
    : form
      ? formatAthleteFullName({
          lastName: form.lastName,
          firstName: form.firstName,
          middleName: form.middleName,
        })
      : ''

  const update = (patch: Partial<AthleteFormRow>) => {
    setForm((current) => {
      if (!current) return current
      const next = { ...current, ...patch }
      if (patch.birthDate || patch.gender) {
        next.rank = sanitizeRankForBirthDate(next.rank, next.birthDate)
        next.disciplineEntries = sanitizeDisciplineEntries(
          next.birthDate,
          next.gender,
          next.disciplineEntries,
        )
      }
      if (patch.rank) {
        next.disciplineEntries = sanitizeDisciplineEntries(
          next.birthDate,
          next.gender,
          next.disciplineEntries,
        )
      }
      return next
    })
  }

  const submit = async () => {
    if (!form) return
    if (isCreate && !standaloneCreate && !registrationId) return
    if (!isCreate && !athlete) return

    setSaving(true)
    setErrors([])

    const payload = {
      lastName: form.lastName,
      firstName: form.firstName,
      middleName: form.middleName || undefined,
      birthDate: form.birthDate,
      gender: form.gender,
      rank: form.rank,
      ...(standaloneCreate
        ? {
            clubName,
            city,
            phone,
          }
        : {}),
      disciplineEntries: form.disciplineEntries.map((entry) => ({
        discipline: entry.discipline,
        ageDivisionId: entry.ageDivisionId,
        weightCategoryId: entry.weightCategoryId,
        experienceLevel: entry.experienceLevel,
      })),
    }

    const result = onSubmit
      ? await onSubmit(payload)
      : await readJsonResponse<{ errors?: string[] }>(
          await fetch(
            withBasePath(
              isCreate
                ? `/api/admin/registrations/${registrationId}/athletes`
                : `/api/admin/registrations/athletes/${athlete!.id}`,
            ),
            {
              method: isCreate ? 'POST' : 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            },
          ),
        ).then((response) =>
          response.ok
            ? { ok: true as const }
            : {
                ok: false as const,
                errors:
                  (response.body as { errors?: string[] } | undefined)?.errors ??
                  (isCreate
                    ? ['Не удалось добавить спортсмена.']
                    : ['Не удалось сохранить спортсмена.']),
              },
        )
    setSaving(false)

    if (!result.ok) {
      setErrors(
        result.errors ??
          (isCreate ? ['Не удалось добавить спортсмена.'] : ['Не удалось сохранить спортсмена.']),
      )
      return
    }

    onSaved()
    onClose()
  }

  return (
    <Modal
      open={open && Boolean(form && (isCreate || athlete))}
      onClose={onClose}
      layer="nested"
      panelClassName={cn(adminModal, adminModalWide, adminModalAthlete)}
      ariaLabelledBy="admin-athlete-edit-title"
    >
      {form && (
        <>
        <header className={adminModalHead}>
          <div className="min-w-0">
            <p className={adminModalEyebrow}>
              {isCreate ? 'Добавление' : 'Спортсмен'}
            </p>
            <h2 id="admin-athlete-edit-title" className={adminModalTitle}>{title || 'Без имени'}</h2>
            <p className={adminModalSubtitle}>
              {standaloneCreate
                ? 'Номер заявки будет присвоен автоматически после сохранения'
                : registrationPublicNumber
                  ? `Заявка №${registrationPublicNumber}`
                  : 'Заявка'}
              {!standaloneCreate && (
                <>
                  {' · '}
                  {form.disciplineEntries.length}{' '}
                  {form.disciplineEntries.length === 1
                    ? 'категория'
                    : form.disciplineEntries.length < 5
                      ? 'категории'
                      : 'категорий'}
                  {' · '}
                  {formatMoney(totalAmount, { plus: false })}
                </>
              )}
            </p>
          </div>
          <Button type="button" variant="ghost" className={adminModalClose} onClick={onClose} aria-label="Закрыть">
            ✕
          </Button>
        </header>

        <div className={cn(adminModalBody, adminAthleteModalBody)}>
          {standaloneCreate && (
            <section className={adminAthletePanel}>
              <h3 className={adminAthletePanelTitle}>Заявка</h3>
              <p className={adminAthletePanelHint}>
                Будет создана отдельная заявка с новым номером. Укажите клуб и контактный телефон.
              </p>
              <div className={adminAthleteFormGrid}>
                <AdminInput
                  label="Клуб"
                  value={clubName}
                  onChange={(event) => setClubName(event.target.value)}
                />
                <AdminInput
                  label="Город"
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                />
                <AdminInput
                  label="Телефон"
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                />
              </div>
            </section>
          )}

          <section className={adminAthletePanel}>
            <h3 className={adminAthletePanelTitle}>Личные данные</h3>
            <div className={adminAthleteFormGrid}>
              <AdminInput
                label="Фамилия"
                value={form.lastName}
                onChange={(event) => update({ lastName: event.target.value })}
              />
              <AdminInput
                label="Имя"
                value={form.firstName}
                onChange={(event) => update({ firstName: event.target.value })}
              />
              <AdminInput
                label="Отчество"
                hint="Необязательно"
                value={form.middleName}
                onChange={(event) => update({ middleName: event.target.value })}
              />
              <AdminInput
                label="Дата рождения"
                type="date"
                value={form.birthDate}
                onChange={(event) => update({ birthDate: event.target.value })}
              />
              <AdminSelect
                label="Пол"
                value={form.gender}
                onChange={(event) => update({ gender: event.target.value as 'male' | 'female' | '' })}
              >
                <option value="">Выберите</option>
                {genderOptions.map((option) => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </AdminSelect>
              <AdminSelect
                label="Разряд"
                value={form.rank}
                disabled={!form.birthDate}
                onChange={(event) => update({ rank: event.target.value })}
              >
                {rankGroups.map((group) => (
                  <optgroup key={group.label} label={group.label}>
                    {group.options.map((option) => (
                      <option key={option.id} value={option.id}>{option.label}</option>
                    ))}
                  </optgroup>
                ))}
              </AdminSelect>
            </div>
          </section>

          <section className={adminAthletePanel}>
            <h3 className={adminAthletePanelTitle}>Категории участия</h3>
            <p className={adminAthletePanelHint}>
              {isCreate
                ? 'Новые категории создаются со статусом «Не оплачено» по текущему этапу регистрации.'
                : 'Изменения в оплаченных категориях сохраняются сразу. Удаление не отменяет оплату автоматически.'}
            </p>
            <CategoryFields
              mode="admin"
              birthDate={form.birthDate}
              gender={form.gender}
              rank={form.rank}
              entries={form.disciplineEntries}
              basePricePerDiscipline={basePricePerDiscipline}
              discountRules={discountRules}
              fallbackPricePerDiscipline={pricePerDiscipline}
              onChange={(entries: DisciplineEntryForm[]) => update({ disciplineEntries: entries })}
            />
          </section>

          {registrationId && (
            <AdminEditCodePanel
              registrationId={registrationId}
              hasEditCode={hasEditCode}
              variant="athlete"
              description={
                registrationPublicNumber
                  ? `Код заявки №${registrationPublicNumber}. Один на всю заявку — действует для всех спортсменов клуба.`
                  : 'Код заявки. Один на всю заявку — действует для всех спортсменов клуба.'
              }
              onUpdated={onEditCodeUpdated}
            />
          )}

          {errors.length > 0 && (
            <ul className={adminModalErrors} role="alert">
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          )}
        </div>

        <footer className={cn(adminModalFooter, adminAthleteModalFooter)}>
          <p className={adminAthleteModalTotal}>
            Итого по спортсмену: <strong>{formatMoney(totalAmount, { plus: false })}</strong>
          </p>
          <div className={adminAthleteModalActions}>
            <Button type="button" variant="secondary" onClick={onClose}>Отмена</Button>
            <Button type="button" onClick={submit} disabled={saving}>
              {saving ? (isCreate ? 'Добавление…' : 'Сохранение…') : isCreate ? 'Добавить' : 'Сохранить'}
            </Button>
          </div>
        </footer>
        </>
      )}
    </Modal>
  )
}
