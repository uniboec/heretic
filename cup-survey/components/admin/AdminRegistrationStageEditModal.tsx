'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { cn } from '@/lib/cn'
import {
  adminModal,
  adminModalBody,
  adminModalClose,
  adminModalEyebrow,
  adminModalFooter,
  adminModalHead,
  adminModalSchedule,
  adminModalTitle,
  adminScheduleModalBody,
  adminScheduleModalErrors,
} from '@/lib/ui/adminSurfaceStyles'
import { AdminInput } from './AdminInput'

export interface RegistrationStageFormItem {
  id: string
  label: string
  bannerTitle: string
  pricePerDiscipline: number
  startsAt: string
  endsAt: string
  usageCount: number
}

interface Props {
  open: boolean
  stage: RegistrationStageFormItem | null
  stageIndex: number
  stagesCount: number
  saving?: boolean
  onClose: () => void
  onApply: (stage: RegistrationStageFormItem, index: number) => void | Promise<void>
  onDelete?: (index: number) => void | Promise<void>
}

export function AdminRegistrationStageEditModal({
  open,
  stage,
  stageIndex,
  stagesCount,
  saving = false,
  onClose,
  onApply,
  onDelete,
}: Props) {
  const [form, setForm] = useState<RegistrationStageFormItem | null>(null)
  const [errors, setErrors] = useState<string[]>([])

  const isNew = stageIndex < 0
  const effectiveStageIndex = isNew ? stagesCount : stageIndex
  const requiresStartDate = effectiveStageIndex > 0

  useEffect(() => {
    if (!open || !stage) {
      setForm(null)
      setErrors([])
      return
    }
    setForm({ ...stage })
    setErrors([])
  }, [open, stage])

  const patch = (patch: Partial<RegistrationStageFormItem>) => {
    setForm((current) => (current ? { ...current, ...patch } : current))
    setErrors([])
  }

  const validate = (): string[] => {
    if (!form) return ['Этап не загружен.']
    const nextErrors: string[] = []
    if (!form.label.trim()) nextErrors.push('Укажите название этапа.')
    if (!Number.isFinite(form.pricePerDiscipline) || form.pricePerDiscipline < 0) {
      nextErrors.push('Укажите корректную стоимость.')
    }
    if (requiresStartDate && !form.startsAt.trim()) {
      nextErrors.push('Укажите начало этапа.')
    }
    if (!form.endsAt.trim()) nextErrors.push('Укажите окончание этапа.')
    return nextErrors
  }

  const apply = async () => {
    if (!form || saving) return
    const nextErrors = validate()
    if (nextErrors.length > 0) {
      setErrors(nextErrors)
      return
    }

    const label = form.label.trim()
    try {
      await onApply(
        {
          ...form,
          label,
          bannerTitle: label,
        },
        stageIndex,
      )
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'Не удалось сохранить этап.'])
    }
  }

  const remove = async () => {
    if (!form || !onDelete || stageIndex < 0 || saving) return
    if (form.usageCount > 0) {
      window.alert('Нельзя удалить этап, по которому уже есть заявки.')
      return
    }
    if (stagesCount <= 1) return
    if (!window.confirm(`Удалить этап «${form.label.trim() || `Этап ${stageIndex + 1}`}»?`)) return
    try {
      await onDelete(stageIndex)
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'Не удалось удалить этап.'])
    }
  }

  const canDelete =
    !isNew && stageIndex >= 0 && form && form.usageCount === 0 && stagesCount > 1

  return (
    <Modal
      open={open}
      onClose={onClose}
      panelClassName={cn(adminModal, adminModalSchedule)}
      ariaLabelledBy="admin-registration-stage-edit-title"
    >
      <header className={adminModalHead}>
        <div>
          <p className={adminModalEyebrow}>Этап регистрации</p>
          <h2 id="admin-registration-stage-edit-title" className={adminModalTitle}>
            {isNew ? 'Новый этап' : form?.label.trim() || `Этап ${stageIndex + 1}`}
          </h2>
        </div>
        <Button type="button" variant="ghost" className={adminModalClose} onClick={onClose} aria-label="Закрыть">
          Закрыть
        </Button>
      </header>

      <div className={cn(adminModalBody, adminScheduleModalBody)}>
        {form && (
          <div className="grid sm:grid-cols-2">
            <AdminInput
              fieldClassName="sm:col-span-2"
              label="Название на сайте"
              value={form.label}
              onChange={(event) => patch({ label: event.target.value })}
              placeholder="Например, Основная регистрация"
              autoFocus
              hint="Отображается в баннере и в списке тарифов на сайте."
            />

            <AdminInput
              label="Стоимость за категорию"
              type="number"
              min={0}
              step={100}
              value={form.pricePerDiscipline}
              onChange={(event) =>
                patch({ pricePerDiscipline: Number(event.target.value) })
              }
            />

            {requiresStartDate && (
              <AdminInput
                label="Начало этапа"
                type="datetime-local"
                value={form.startsAt}
                onChange={(event) => patch({ startsAt: event.target.value })}
              />
            )}

            <AdminInput
              label="Окончание этапа"
              type="datetime-local"
              value={form.endsAt}
              onChange={(event) => patch({ endsAt: event.target.value })}
            />
          </div>
        )}

        {errors.length > 0 && (
          <ul className={adminScheduleModalErrors}>
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        )}
      </div>

      <footer className={adminModalFooter}>
        {canDelete ? (
          <Button
            type="button"
            variant="ghost"
            className="mr-auto text-danger hover:bg-danger-soft"
            onClick={() => void remove()}
            disabled={saving}
          >
            Удалить
          </Button>
        ) : (
          <span className="mr-auto" />
        )}
        <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
          Отмена
        </Button>
        <Button type="button" onClick={() => void apply()} disabled={saving}>
          {saving ? 'Сохранение…' : isNew ? 'Добавить' : 'Сохранить'}
        </Button>
      </footer>
    </Modal>
  )
}
