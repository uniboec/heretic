'use client'

import { cn } from '@/lib/cn'
import {
  adminCardField,
  adminCardFields,
  adminPageActionsBtn,
  adminPanel,
  adminPanelHeader,
  adminRowCard,
  adminSettingsAlert,
  adminSettingsAlertError,
  adminSettingsAlertSuccess,
  adminSettingsCheckbox,
  adminSettingsEmpty,
  adminSettingsLayout,
  adminSettingsPage,
  adminSettingsPanelBody,
  adminSettingsPanelDesc,
  adminSettingsPanelTitle,
  adminSettingsPreview,
  adminSettingsStageBadge,
  adminSettingsStageFields,
  adminSettingsStageRowCurrent,
  adminSettingsStageTableRowCurrent,
  adminSettingsStagesList,
  adminSettingsStagesTable,
  adminTableWrap,
} from '@/lib/ui/adminSurfaceStyles'
import { useCallback, useEffect, useState } from 'react'
import { withBasePath } from '@/lib/basePath'
import { readJsonResponse } from '@/lib/http/readJsonResponse'
import { formatTournamentDateTime } from '@/lib/datetime/tournament'
import { formatMoney } from '@/lib/formatMoney'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Table } from '@/components/ui/Table'
import { TariffCard } from '@/components/tournament/TariffCard'
import { AdminInput } from './AdminInput'
import { AdminPageHeader } from './AdminPageHeader'
import { AdminStatCard } from './AdminStatCard'
import {
  AdminRegistrationStageEditModal,
  type RegistrationStageFormItem,
} from './AdminRegistrationStageEditModal'

interface ScheduleStage {
  id: string
  label: string
  period: string
  pricePerDiscipline: number
}

interface ScheduleResponse {
  schedule: {
    stagesList: ScheduleStage[]
    registrationClosesAt: string
  }
  stages: RegistrationStageFormItem[]
  registrationClosesAt: string
  maxAthletes: number | null
  showMaxAthletes: boolean
  currentAthleteCount: number
  currentStageId: string | null
}

function loadErrorMessage(error: string | undefined): string {
  if (error === 'DB_MIGRATION_REQUIRED') {
    return 'Нужно обновить базу данных: npm run db:deploy'
  }
  if (error === 'Unauthorized') {
    return 'Сессия админки истекла. Войдите снова.'
  }
  return 'Не удалось загрузить настройки регистрации.'
}

function createEmptyStage(index: number): RegistrationStageFormItem {
  return {
    id: `stage-${Date.now()}-${index}`,
    label: '',
    bannerTitle: '',
    pricePerDiscipline: 1800,
    startsAt: '',
    endsAt: '',
    usageCount: 0,
  }
}

export function AdminRegistrationScheduleDashboard() {
  const [stages, setStages] = useState<RegistrationStageFormItem[]>([])
  const [previewStages, setPreviewStages] = useState<ScheduleStage[]>([])
  const [registrationClosesAt, setRegistrationClosesAt] = useState('')
  const [maxAthletesInput, setMaxAthletesInput] = useState('')
  const [showMaxAthletes, setShowMaxAthletes] = useState(false)
  const [currentAthleteCount, setCurrentAthleteCount] = useState(0)
  const [currentStageId, setCurrentStageId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [success, setSuccess] = useState('')
  const [editingStageIndex, setEditingStageIndex] = useState<number | null>(null)
  const [draftStage, setDraftStage] = useState<RegistrationStageFormItem | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const result = await readJsonResponse<ScheduleResponse & { error?: string }>(
        await fetch(withBasePath('/api/admin/registration-schedule')),
      )
      if (!result.ok) {
        const code =
          result.body && typeof result.body === 'object' && 'error' in result.body
            ? String((result.body as { error?: string }).error)
            : undefined
        setLoadError(loadErrorMessage(code))
        return
      }
      const json = result.data
      setStages(json.stages)
      setPreviewStages(json.schedule.stagesList)
      setRegistrationClosesAt(json.registrationClosesAt)
      setMaxAthletesInput(json.maxAthletes != null ? String(json.maxAthletes) : '')
      setShowMaxAthletes(json.showMaxAthletes)
      setCurrentAthleteCount(json.currentAthleteCount)
      setCurrentStageId(json.currentStageId)
    } catch {
      setLoadError('Не удалось загрузить настройки регистрации.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const openStageEditor = (index: number) => {
    const stage = stages[index]
    if (!stage) return
    setDraftStage({ ...stage })
    setEditingStageIndex(index)
  }

  const openNewStageEditor = () => {
    const draft = createEmptyStage(stages.length)
    const previousStage = stages[stages.length - 1]
    if (previousStage?.endsAt) {
      draft.startsAt = previousStage.endsAt
    }
    setDraftStage(draft)
    setEditingStageIndex(-1)
  }

  const closeStageEditor = () => {
    setEditingStageIndex(null)
    setDraftStage(null)
  }

  const persistStages = async (
    nextStages: RegistrationStageFormItem[],
    options?: { rethrow?: boolean },
  ) => {
    setSaving(true)
    setErrors([])
    setSuccess('')
    try {
      const result = await readJsonResponse<ScheduleResponse & { errors?: string[] }>(
        await fetch(withBasePath('/api/admin/registration-schedule'), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            registrationClosesAt,
            maxAthletes: maxAthletesInput.trim() ? Number(maxAthletesInput) : null,
            showMaxAthletes,
            stages: nextStages.map((stage, index) => ({
              id: stage.id,
              label: stage.label,
              bannerTitle: stage.label.trim(),
              pricePerDiscipline: Number(stage.pricePerDiscipline),
              startsAt: index === 0 ? stage.startsAt || null : stage.startsAt,
              endsAt: stage.endsAt,
            })),
          }),
        }),
      )
      if (!result.ok) {
        const body = result.body as { errors?: string[] } | undefined
        const messages = Array.isArray(body?.errors) ? body.errors : [result.error]
        setErrors(messages)
        if (options?.rethrow) {
          throw new Error(messages.join(' '))
        }
        return
      }
      const json = result.data
      setStages(json.stages)
      setPreviewStages(json.schedule.stagesList)
      setRegistrationClosesAt(json.registrationClosesAt)
      setMaxAthletesInput(json.maxAthletes != null ? String(json.maxAthletes) : '')
      setShowMaxAthletes(json.showMaxAthletes)
      setCurrentAthleteCount(json.currentAthleteCount)
      setCurrentStageId(json.currentStageId ?? null)
      setSuccess('Настройки сохранены.')
      closeStageEditor()
    } finally {
      setSaving(false)
    }
  }

  const applyStage = async (stage: RegistrationStageFormItem, index: number) => {
    const previousStages = stages
    const nextStages =
      index < 0
        ? [...stages, stage]
        : stages.map((item, itemIndex) => (itemIndex === index ? stage : item))

    const ids = nextStages.map((item) => item.id.trim()).filter(Boolean)
    if (new Set(ids).size !== ids.length) {
      throw new Error('Идентификаторы этапов должны быть уникальными.')
    }

    setStages(nextStages)
    try {
      await persistStages(nextStages, { rethrow: true })
    } catch (error) {
      setStages(previousStages)
      throw error
    }
  }

  const removeStage = async (index: number) => {
    const previousStages = stages
    const nextStages = stages.filter((_, stageIndex) => stageIndex !== index)
    setStages(nextStages)
    try {
      await persistStages(nextStages, { rethrow: true })
    } catch (error) {
      setStages(previousStages)
      throw error
    }
  }

  const save = async () => {
    await persistStages(stages)
  }

  const currentStage = previewStages.find((stage) => stage.id === currentStageId) ?? null
  const athleteLimitLabel =
    maxAthletesInput.trim() !== ''
      ? `${currentAthleteCount} / ${maxAthletesInput}`
      : loading
        ? '…'
        : `${currentAthleteCount} · без лимита`

  return (
    <div className={adminSettingsPage}>
      <AdminPageHeader
        title="Настройки"
        description="Этапы регистрации, тарифы, даты и закрытие приёма заявок. Все значения — по времени Екатеринбурга (UTC+5)."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              className={adminPageActionsBtn}
              onClick={openNewStageEditor}
              disabled={loading || saving}
            >
              Добавить этап
            </Button>
            <Button type="button" className={adminPageActionsBtn} onClick={() => void save()} disabled={saving || loading}>
              {saving ? 'Сохранение…' : 'Сохранить'}
            </Button>
          </div>
        }
      />

      {loadError && (
        <p className={`${adminSettingsAlert} ${adminSettingsAlertError}`}>{loadError}</p>
      )}

      {success && (
        <p className={`${adminSettingsAlert} ${adminSettingsAlertSuccess}`}>{success}</p>
      )}

      {errors.length > 0 && (
        <div className={`${adminSettingsAlert} ${adminSettingsAlertError}`}>
          {errors.map((error) => (
            <p key={error}>{error}</p>
          ))}
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard
          label="Текущий этап"
          value={loading ? '…' : currentStage?.label ?? 'Закрыто'}
        />
        <AdminStatCard
          label="Тариф сейчас"
          value={
            loading || !currentStage
              ? '…'
              : formatMoney(currentStage.pricePerDiscipline, { plus: false })
          }
        />
        <AdminStatCard label="Спортсменов" value={athleteLimitLabel} />
        <AdminStatCard
          label="Закрытие регистрации"
          value={loading ? '…' : formatTournamentDateTime(registrationClosesAt)}
        />
      </section>

      <div className={adminSettingsLayout}>
        <section className={adminPanel}>
          <div className={adminPanelHeader}>
            <div>
              <p className={adminSettingsPanelTitle}>Параметры приёма</p>
              <p className={adminSettingsPanelDesc}>Лимит участников и дата закрытия регистрации.</p>
            </div>
          </div>
          <div className={adminSettingsPanelBody}>
            <AdminInput
              fieldClassName="admin-settings-field"
              label="Максимум спортсменов"
              type="number"
              min={1}
              step={1}
              value={maxAthletesInput}
              onChange={(event) => {
                setMaxAthletesInput(event.target.value)
                setSuccess('')
              }}
              disabled={loading}
              placeholder="Без лимита"
              hint={`Пустое поле — без ограничения. Сейчас зарегистрировано: ${loading ? '…' : currentAthleteCount}.`}
            />

            <label className={adminSettingsCheckbox}>
              <Input
                controlOnly
                type="checkbox"
                className="w-auto min-h-0 shrink-0 border-0 bg-transparent p-0 shadow-none"
                checked={showMaxAthletes}
                onChange={(event) => {
                  setShowMaxAthletes(event.target.checked)
                  setSuccess('')
                }}
                disabled={loading || !maxAthletesInput.trim()}
              />
              <span>Показывать лимит на сайте</span>
            </label>

            <AdminInput
              fieldClassName="admin-settings-field"
              label="Полное закрытие приёма заявок"
              type="datetime-local"
              value={registrationClosesAt}
              onChange={(event) => {
                setRegistrationClosesAt(event.target.value)
                setSuccess('')
              }}
              disabled={loading}
              hint="После этой даты новые заявки и оплаты на сайте будут недоступны."
            />
          </div>
        </section>

        <section className={`${adminPanel} overflow-hidden`}>
          <div className={adminPanelHeader}>
            <div>
              <p className={adminSettingsPanelTitle}>Этапы регистрации ({stages.length})</p>
              <p className={adminSettingsPanelDesc}>
                Тарифы и периоды. Нажмите «Изменить» — изменения сохраняются сразу.
              </p>
            </div>
          </div>

          <div className={adminSettingsStagesList}>
            {loading && (
              <p className={adminSettingsEmpty}>Загрузка…</p>
            )}
            {!loading &&
              stages.map((stage, index) => {
                const preview = previewStages.find((item) => item.id === stage.id)
                const isCurrent = stage.id === currentStageId

                return (
                  <article
                    key={stage.id}
                    className={cn(adminRowCard, isCurrent && adminSettingsStageRowCurrent)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <Button
                        type="button"
                        variant="ghost"
                        className="min-w-0 flex-1 text-left"
                        onClick={() => openStageEditor(index)}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-foreground">
                            {stage.label.trim() || `Этап ${index + 1}`}
                          </p>
                          {isCurrent && (
                            <span className={adminSettingsStageBadge}>Сейчас</span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-muted">
                          ID: {stage.id}
                          {stage.usageCount > 0 ? ` · заявок: ${stage.usageCount}` : ''}
                        </p>
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        className="min-h-9 shrink-0 px-3 py-1.5 text-xs"
                        onClick={() => openStageEditor(index)}
                      >
                        Изменить
                      </Button>
                    </div>

                    <dl className={cn(adminCardFields, adminSettingsStageFields)}>
                      <div className={adminCardField}>
                        <dt>Тариф</dt>
                        <dd>{formatMoney(stage.pricePerDiscipline, { plus: false })}</dd>
                      </div>
                      <div className={adminCardField}>
                        <dt>Период</dt>
                        <dd>{preview?.period ?? '—'}</dd>
                      </div>
                      <div className={adminCardField}>
                        <dt>Заявок</dt>
                        <dd>{stage.usageCount > 0 ? stage.usageCount : '—'}</dd>
                      </div>
                    </dl>
                  </article>
                )
              })}
            {!loading && stages.length === 0 && (
              <p className={adminSettingsEmpty}>Этапы не настроены.</p>
            )}
          </div>

          <div className={cn(adminSettingsStagesTable, adminTableWrap)}>
            <Table>
              <thead>
                <tr>
                  <th>Этап</th>
                  <th>ID</th>
                  <th>Тариф</th>
                  <th>Период</th>
                  <th>Заявок</th>
                  <th aria-label="Действия" />
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={6} className="text-center text-muted">
                      Загрузка…
                    </td>
                  </tr>
                )}
                {!loading &&
                  stages.map((stage, index) => {
                    const preview = previewStages.find((item) => item.id === stage.id)
                    const isCurrent = stage.id === currentStageId

                    return (
                      <tr
                        key={stage.id}
                        className={cn(isCurrent && adminSettingsStageTableRowCurrent)}
                      >
                        <td className="font-medium">
                          <div className="flex flex-wrap items-center gap-2">
                            <span>{stage.label.trim() || `Этап ${index + 1}`}</span>
                            {isCurrent && (
                              <span className={adminSettingsStageBadge}>Сейчас</span>
                            )}
                          </div>
                        </td>
                        <td className="text-muted">{stage.id}</td>
                        <td className="font-semibold text-accent">
                          {formatMoney(stage.pricePerDiscipline, { plus: false })}
                        </td>
                        <td className="text-muted">{preview?.period ?? '—'}</td>
                        <td>{stage.usageCount > 0 ? stage.usageCount : '—'}</td>
                        <td className="text-right">
                          <Button
                            type="button"
                            variant="secondary"
                            className="min-h-9 px-3 py-1.5 text-xs"
                            onClick={() => openStageEditor(index)}
                          >
                            Изменить
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                {!loading && stages.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center text-muted">
                      Этапы не настроены.
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          </div>
        </section>
      </div>

      <section className={adminPanel}>
        <div className={adminPanelHeader}>
          <div>
            <p className={adminSettingsPanelTitle}>Как это отображается на сайте</p>
            <p className={adminSettingsPanelDesc}>
              Превью блока тарифов на главной странице турнира.
            </p>
          </div>
        </div>
        <div className={adminSettingsPreview}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {previewStages.map((stage) => (
              <TariffCard
                key={stage.id}
                label={stage.label}
                period={stage.period}
                pricePerDiscipline={stage.pricePerDiscipline}
                current={stage.id === currentStageId}
              />
            ))}
          </div>
        </div>
      </section>

      <AdminRegistrationStageEditModal
        open={editingStageIndex !== null}
        stage={draftStage}
        stageIndex={editingStageIndex ?? -1}
        stagesCount={stages.length}
        saving={saving}
        onClose={closeStageEditor}
        onApply={applyStage}
        onDelete={removeStage}
      />
    </div>
  )
}
