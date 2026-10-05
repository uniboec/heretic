'use client'

import { useEffect, useState } from 'react'
import { withBasePath } from '@/lib/basePath'
import { readJsonResponse } from '@/lib/http/readJsonResponse'
import { fseAgeDivisions, formatAgeDivisionFilterLabel } from '@/lib/config/fseCategories'
import { experienceLevelOptions } from '@/lib/config/experienceLevel'
import { tournamentDisciplines } from '@/lib/config/tournament'
import {
  fromTournamentDatetimeLocalValue,
  toTournamentDatetimeLocalValue,
} from '@/lib/datetime/tournament'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { cn } from '@/lib/cn'
import {
  adminModal,
  adminModalBody,
  adminModalClose,
  adminModalEyebrow,
  adminModalFooter,
  adminModalHead,
  adminModalTitle,
  adminModalWide,
} from '@/lib/ui/adminSurfaceStyles'
import { AdminField } from './AdminField'
import { AdminInput } from './AdminInput'
import { AdminSelect } from './AdminSelect'
import { fieldControlClassName } from '@/lib/ui/fieldControlStyles'
import type { CategoryDiscountRuleRecord } from '@/lib/registration/categoryDiscountTypes'

export type AdminDiscountRuleRow = CategoryDiscountRuleRecord

interface Props {
  open: boolean
  rule: AdminDiscountRuleRow | null
  onClose: () => void
  onSaved: (rule: AdminDiscountRuleRow) => void
}

const emptyForm = {
  label: '',
  description: '',
  discountPercent: '10',
  discipline: '',
  experienceLevel: '',
  ageDivisionId: '',
  enabled: true,
  showOnSite: false,
  startsAt: '',
  endsAt: '',
}

export function AdminDiscountRuleEditModal({ open, rule, onClose, onSaved }: Props) {
  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) {
      setForm(emptyForm)
      setErrors([])
      return
    }

    if (!rule) {
      setForm(emptyForm)
      setErrors([])
      return
    }

    setForm({
      label: rule.label ?? '',
      description: rule.description ?? '',
      discountPercent: String(rule.discountPercent),
      discipline: rule.discipline ?? '',
      experienceLevel: rule.experienceLevel ?? '',
      ageDivisionId: rule.ageDivisionId ?? '',
      enabled: rule.enabled,
      showOnSite: rule.showOnSite,
      startsAt: toTournamentDatetimeLocalValue(rule.startsAt),
      endsAt: toTournamentDatetimeLocalValue(rule.endsAt),
    })
    setErrors([])
  }, [open, rule])

  const save = async () => {
    setSaving(true)
    setErrors([])

    const payload = {
      label: form.label.trim() || null,
      description: form.description.trim() || null,
      discountPercent: Number(form.discountPercent),
      discipline: form.discipline || null,
      experienceLevel: form.experienceLevel || null,
      ageDivisionId: form.ageDivisionId || null,
      enabled: form.enabled,
      showOnSite: form.showOnSite,
      startsAt: fromTournamentDatetimeLocalValue(form.startsAt),
      endsAt: fromTournamentDatetimeLocalValue(form.endsAt),
    }

    try {
      const result = await readJsonResponse<{ rule?: AdminDiscountRuleRow; errors?: string[] }>(
        await fetch(
          withBasePath(rule ? `/api/admin/discount-rules/${rule.id}` : '/api/admin/discount-rules'),
          {
            method: rule ? 'PATCH' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          },
        ),
      )

      if (!result.ok) {
        const body = result.body as { errors?: string[] } | undefined
        if (Array.isArray(body?.errors) && body.errors.length > 0) {
          setErrors(body.errors)
          return
        }
        setErrors([result.error])
        return
      }

      onSaved(result.data.rule as AdminDiscountRuleRow)
      onClose()
    } catch {
      setErrors(['Не удалось сохранить правило скидки.'])
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      panelClassName={cn(adminModal, adminModalWide)}
      ariaLabelledBy="admin-discount-rule-title"
    >
      <header className={adminModalHead}>
        <div>
          <p className={adminModalEyebrow}>Скидки</p>
          <h2 id="admin-discount-rule-title" className={adminModalTitle}>
            {rule ? 'Редактировать правило' : 'Новое правило скидки'}
          </h2>
        </div>
        <Button type="button" variant="ghost" className={adminModalClose} onClick={onClose} aria-label="Закрыть">
          ✕
        </Button>
      </header>

      <div className={cn(adminModalBody, 'space-y-4')}>
        {errors.length > 0 && (
          <div className="rounded-lg border border-danger-border bg-danger-soft px-4 py-3 text-sm text-danger-foreground">
            {errors.map((error) => <p key={error}>{error}</p>)}
          </div>
        )}

        <AdminInput
          label="Название"
          value={form.label}
          onChange={(event) => setForm((prev) => ({ ...prev, label: event.target.value }))}
          placeholder="Например: скидка новичкам Tactic-Control"
        />

        <AdminField label="Описание">
          <textarea
            data-field-control
            className={fieldControlClassName({ density: 'compact', className: 'min-h-24 resize-y' })}
            value={form.description}
            onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
            placeholder="Кратко опишите условия скидки для посетителей сайта"
          />
        </AdminField>

        <AdminInput
          label="Скидка, %"
          inputMode="numeric"
          value={form.discountPercent}
          onChange={(event) => setForm((prev) => ({ ...prev, discountPercent: event.target.value }))}
        />

        <AdminSelect
          label="Дисциплина"
          value={form.discipline}
          onChange={(event) => setForm((prev) => ({ ...prev, discipline: event.target.value }))}
        >
          <option value="">Все дисциплины</option>
          {tournamentDisciplines.map((discipline) => (
            <option key={discipline.id} value={discipline.id}>{discipline.label}</option>
          ))}
        </AdminSelect>

        <AdminSelect
          label="Уровень"
          value={form.experienceLevel}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, experienceLevel: event.target.value }))
          }
        >
          <option value="">Все уровни</option>
          {experienceLevelOptions.map((level) => (
            <option key={level.id} value={level.id}>{level.label}</option>
          ))}
        </AdminSelect>

        <AdminSelect
          label="Возрастная группа"
          value={form.ageDivisionId}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, ageDivisionId: event.target.value }))
          }
        >
          <option value="">Все возрастные группы</option>
          {fseAgeDivisions.map((division) => (
            <option key={division.id} value={division.id}>
              {formatAgeDivisionFilterLabel(division, true)}
            </option>
          ))}
        </AdminSelect>

        <div className="grid gap-4 sm:grid-cols-2">
          <AdminInput
            label="Действует с"
            type="datetime-local"
            value={form.startsAt}
            onChange={(event) => setForm((prev) => ({ ...prev, startsAt: event.target.value }))}
          />

          <AdminInput
            label="Действует до"
            type="datetime-local"
            value={form.endsAt}
            onChange={(event) => setForm((prev) => ({ ...prev, endsAt: event.target.value }))}
          />
        </div>

        <p className="text-sm text-muted">
          Время указывается по Екатеринбургу (UTC+5). Пустые даты — без ограничения по сроку.
        </p>

        <label className="flex items-center gap-2 text-sm text-foreground">
          <Input
            controlOnly
            type="checkbox"
            className="w-auto min-h-0 shrink-0 border-0 bg-transparent p-0 shadow-none"
            checked={form.enabled}
            onChange={(event) => setForm((prev) => ({ ...prev, enabled: event.target.checked }))}
          />
          Правило активно
        </label>

        <label className="flex items-start gap-2 text-sm text-foreground">
          <Input
            controlOnly
            type="checkbox"
            className="mt-0.5 w-auto min-h-0 shrink-0 border-0 bg-transparent p-0 shadow-none"
            checked={form.showOnSite}
            onChange={(event) => setForm((prev) => ({ ...prev, showOnSite: event.target.checked }))}
          />
          <span>
            Показывать на сайте
            <span className="mt-1 block text-muted">
              Если выключено, скидка применяется только при регистрации и не отображается на главной.
            </span>
          </span>
        </label>

        <p className="text-sm text-muted">
          Пустые поля категорий означают «для всех». Если к категории подходит несколько правил и клубная скидка,
          применяется самая выгодная (максимальный процент), без суммирования.
        </p>
      </div>

      <footer className={adminModalFooter}>
        <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
          Отмена
        </Button>
        <Button type="button" onClick={save} disabled={saving}>
          {saving ? 'Сохранение…' : 'Сохранить'}
        </Button>
      </footer>
    </Modal>
  )
}

