'use client'

import { useMemo } from 'react'
import { ChevronDown } from 'lucide-react'
import { DURATION_BANDS, getDefaultDurationTable } from '@/lib/bouts/boutDuration'
import type { CompetitionStageSettings } from '@/lib/bouts/competitionStageSettings'
import { MAX_BREAK_AFTER_STAGE_MINUTES } from '@/lib/bouts/competitionStageSettings'
import { maxConfiguredStage, resolveStageUiRange } from '@/lib/bouts/competitionStages'
import {
  AGE_DIVISION_DURATION_MAX,
  AGE_DIVISION_DURATION_MIN,
} from '@/lib/bouts/settingsLimits'
import type { StageTimingSummary } from '@/lib/bouts/scheduleTypes'
import { buildStageSettingsWarnings } from '@/lib/bouts/stageSettingsWarnings'
import { tournamentInfo } from '@/lib/config/tournament'
import type { MatKey } from '@/lib/bouts/startTimes.types'
import { Button } from '@/components/ui/Button'
import { Table } from '@/components/ui/Table'
import { AdminInput } from '@/components/admin/AdminInput'
import { AdminInputWithUnit } from '@/components/admin/AdminInputWithUnit'
import { AdminLocalTimeInput } from '@/components/admin/AdminLocalTimeInput'
import { AdminBoutsDraftStatus } from '@/components/admin/bouts/AdminBoutsDraftStatus'
import { useSyncedDraft } from '@/components/admin/bouts/useSyncedDraft'
import {
  hasRecordErrors,
  hasStageDraftErrors,
  validateDurationOverridesDraft,
  validateMatOverridesDraft,
  validateStageDraft,
} from '@/components/admin/bouts/validateBoutsAdvancedDraft'
import {
  adminBoutsAdvancedSection,
  adminBoutsAdvancedSectionTitle,
  adminBoutsCollapse,
  adminBoutsCollapseBody,
  adminBoutsCollapseSummary,
  adminBoutsInlineFields,
  adminBoutsScrollPanel,
  adminBoutsScrollPanelCompact,
  adminTableWrap,
} from '@/lib/ui/adminSurfaceStyles'

interface AdminBoutsAdvancedSettingsProps {
  matCount: number
  boutsStartTime: string
  matStartTimeOverrides: Partial<Record<MatKey, string>>
  ageDivisionDurationOverrides: Record<string, number>
  competitionStageSettings: CompetitionStageSettings
  configuredCategoryStages: number[]
  stageSummaries?: StageTimingSummary[]
  saving: boolean
  onSave: (patch: Record<string, unknown>) => Promise<boolean>
}

function matOverridesToDraft(overrides: Partial<Record<MatKey, string>>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(overrides).map(([key, value]) => [key, value]),
  )
}

function stageSettingsToDraft(settings: CompetitionStageSettings) {
  return {
    breaks: Object.fromEntries(
      Object.entries(settings.breaksAfterStageMinutes).map(([key, value]) => [key, String(value)]),
    ),
    notBefore: { ...settings.notBeforeStartTimes },
  }
}

function durationOverridesToDraft(overrides: Record<string, number>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(overrides).map(([key, value]) => [key, String(value)]),
  )
}

export function AdminBoutsAdvancedSettings({
  matCount,
  boutsStartTime,
  matStartTimeOverrides,
  ageDivisionDurationOverrides,
  competitionStageSettings,
  configuredCategoryStages,
  stageSummaries = [],
  saving,
  onSave,
}: AdminBoutsAdvancedSettingsProps) {
  const serverMatDraft = useMemo(
    () => matOverridesToDraft(matStartTimeOverrides),
    [matStartTimeOverrides],
  )
  const serverStageDraft = useMemo(
    () => stageSettingsToDraft(competitionStageSettings),
    [competitionStageSettings],
  )
  const serverDurationDraft = useMemo(
    () => durationOverridesToDraft(ageDivisionDurationOverrides),
    [ageDivisionDurationOverrides],
  )

  const {
    draft: matOverrides,
    updateDraft: setMatOverrides,
    isDirty: matOverridesDirty,
    acceptServerValue: acceptMatOverrides,
  } = useSyncedDraft(serverMatDraft)

  const {
    draft: stageDraft,
    updateDraft: setStageDraft,
    isDirty: stagesDirty,
    acceptServerValue: acceptStages,
  } = useSyncedDraft(serverStageDraft)

  const {
    draft: durationOverrides,
    updateDraft: setDurationOverrides,
    isDirty: durationsDirty,
    acceptServerValue: acceptDurations,
  } = useSyncedDraft(serverDurationDraft)

  const stageUiRange = resolveStageUiRange({
    configuredCategoryStages,
    stageSettings: competitionStageSettings,
  })

  const visibleStages = useMemo(() => {
    const stages = new Set<number>()
    for (let stage = 1; stage <= stageUiRange.maxSelectable; stage += 1) {
      stages.add(stage)
    }
    for (const stage of configuredCategoryStages) {
      if (stage >= 1 && stage <= stageUiRange.maxSelectable) stages.add(stage)
    }
    const configuredOnly = maxConfiguredStage(competitionStageSettings)
    if (configuredOnly > 0) {
      for (let stage = 1; stage <= Math.min(configuredOnly, stageUiRange.maxSelectable); stage += 1) {
        stages.add(stage)
      }
    }
    return [...stages].sort((a, b) => a - b)
  }, [competitionStageSettings, configuredCategoryStages, stageUiRange.maxSelectable])

  const stageWarnings = useMemo(
    () =>
      buildStageSettingsWarnings({
        stageSettings: competitionStageSettings,
        stageSummaries,
        eventDate: tournamentInfo.eventDate,
        draftNotBefore: stageDraft.notBefore,
      }),
    [competitionStageSettings, stageDraft.notBefore, stageSummaries],
  )
  const warningsByStage = useMemo(
    () => new Map(stageWarnings.map((warning) => [warning.stage, warning])),
    [stageWarnings],
  )

  const matErrors = useMemo(() => {
    const allErrors = validateMatOverridesDraft(matOverrides)
    const scoped: Record<string, string> = {}
    for (let index = 1; index <= matCount; index += 1) {
      const key = String(index)
      if (allErrors[key]) scoped[key] = allErrors[key]
    }
    return scoped
  }, [matCount, matOverrides])

  const stageErrors = useMemo(() => validateStageDraft(stageDraft), [stageDraft])
  const durationErrors = useMemo(
    () => validateDurationOverridesDraft(durationOverrides),
    [durationOverrides],
  )

  const matOverridesValid = !hasRecordErrors(matErrors)
  const stagesValid = !hasStageDraftErrors(stageErrors)
  const durationsValid = !hasRecordErrors(durationErrors)

  const durationRows = getDefaultDurationTable()

  async function saveMatOverrides() {
    const overrides: Partial<Record<MatKey, string>> = {}
    for (let index = 1; index <= matCount; index += 1) {
      const key = String(index) as MatKey
      const value = matOverrides[key]?.trim()
      if (value) overrides[key] = value
    }
    const ok = await onSave({ matStartTimeOverrides: overrides })
    if (ok) acceptMatOverrides(matOverridesToDraft(overrides))
  }

  async function saveStageSettings() {
    const breaksAfterStageMinutes: Record<string, number> = {}
    const notBeforeStartTimes: Record<string, string> = {}
    for (const [key, value] of Object.entries(stageDraft.breaks)) {
      const trimmed = value.trim()
      if (!trimmed) continue
      breaksAfterStageMinutes[key] = Number(trimmed)
    }
    for (const [key, value] of Object.entries(stageDraft.notBefore)) {
      const trimmed = value.trim()
      if (!trimmed) continue
      notBeforeStartTimes[key] = trimmed
    }
    const nextSettings = {
      breaksAfterStageMinutes,
      notBeforeStartTimes,
    }
    const ok = await onSave({ competitionStageSettings: nextSettings })
    if (ok) acceptStages(stageSettingsToDraft(nextSettings))
  }

  async function saveDurations() {
    const parsed: Record<string, number> = {}
    for (const [key, value] of Object.entries(durationOverrides)) {
      const trimmed = value.trim()
      if (!trimmed) continue
      parsed[key] = Number(trimmed)
    }
    const ok = await onSave({ ageDivisionDurationOverrides: parsed })
    if (ok) acceptDurations(durationOverridesToDraft(parsed))
  }

  return (
    <details className={adminBoutsCollapse}>
      <summary className={adminBoutsCollapseSummary}>
        Дополнительные настройки
        <ChevronDown
          className="h-4 w-4 shrink-0 text-muted [[open]_&]:rotate-180"
          strokeWidth={1.75}
          aria-hidden="true"
        />
      </summary>
      <div className={`${adminBoutsCollapseBody} space-y-5`}>
        {matCount > 1 ? (
          <section className={adminBoutsAdvancedSection}>
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h3 className={adminBoutsAdvancedSectionTitle}>Время начала по коврам</h3>
              <AdminBoutsDraftStatus saving={saving} isDirty={matOverridesDirty} />
            </div>
            <div className={adminBoutsInlineFields}>
              {Array.from({ length: matCount }, (_, index) => {
                const matIndex = index + 1
                const key = String(matIndex) as MatKey
                return (
                  <AdminLocalTimeInput
                    key={key}
                    label={`Ковёр ${matIndex}`}
                    className="w-28"
                    placeholder={boutsStartTime || '10:00'}
                    value={matOverrides[key] ?? ''}
                    error={matErrors[key]}
                    disabled={saving}
                    onChange={(nextValue) =>
                      setMatOverrides((current) => ({
                        ...current,
                        [key]: nextValue,
                      }))
                    }
                  />
                )
              })}
            </div>
            <div className="mt-4">
              <Button
                type="button"
                variant="secondary"
                className="min-h-10 px-4"
                disabled={saving || !matOverridesDirty || !matOverridesValid}
                onClick={() => void saveMatOverrides()}
              >
                Сохранить
              </Button>
            </div>
          </section>
        ) : null}

        <section className={adminBoutsAdvancedSection}>
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h3 className={adminBoutsAdvancedSectionTitle}>Этапы</h3>
            <AdminBoutsDraftStatus saving={saving} isDirty={stagesDirty} />
          </div>
          <div className={`${adminTableWrap} ${adminBoutsScrollPanel} ${adminBoutsScrollPanelCompact}`}>
            <Table className="min-w-full">
              <thead>
                <tr>
                  <th>Этап</th>
                  <th>Не ранее</th>
                  <th className="w-28">Пауза после</th>
                </tr>
              </thead>
              <tbody>
                {visibleStages.map((stage) => {
                  const key = String(stage)
                  return (
                    <tr key={stage}>
                      <td className="text-sm font-medium">Этап {stage}</td>
                      <td>
                        {stage === 1 ? (
                          <span className="text-sm text-muted">{boutsStartTime || '—'}</span>
                        ) : (
                          <div className="space-y-1">
                            <AdminLocalTimeInput
                              className="w-28"
                              placeholder="—"
                              value={stageDraft.notBefore[key] ?? ''}
                              error={stageErrors.notBefore[key]}
                              disabled={saving}
                              onChange={(nextValue) =>
                                setStageDraft((current) => ({
                                  ...current,
                                  notBefore: { ...current.notBefore, [key]: nextValue },
                                }))
                              }
                            />
                            {warningsByStage.get(stage) ? (
                              <p className="max-w-xs text-xs text-amber-700 dark:text-amber-400">
                                {warningsByStage.get(stage)?.message}
                              </p>
                            ) : null}
                          </div>
                        )}
                      </td>
                      <td>
                        <AdminInputWithUnit
                          unit="мин"
                          className="w-20"
                          type="number"
                          min={0}
                          max={MAX_BREAK_AFTER_STAGE_MINUTES}
                          placeholder="0"
                          value={stageDraft.breaks[key] ?? ''}
                          error={stageErrors.breaks[key]}
                          disabled={saving}
                          onChange={(event) =>
                            setStageDraft((current) => ({
                              ...current,
                              breaks: { ...current.breaks, [key]: event.target.value },
                            }))
                          }
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </Table>
          </div>
          <div className="mt-4">
            <Button
              type="button"
              variant="secondary"
              className="min-h-10 px-4"
              disabled={saving || !stagesDirty || !stagesValid}
              onClick={() => void saveStageSettings()}
            >
              Сохранить
            </Button>
          </div>
        </section>

        <section className={adminBoutsAdvancedSection}>
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h3 className={adminBoutsAdvancedSectionTitle}>Длительность поединков</h3>
            <AdminBoutsDraftStatus saving={saving} isDirty={durationsDirty} />
          </div>
          <p className="mb-3 text-xs text-muted">
            {DURATION_BANDS.map((band) => `${band.label} → ${band.minutes} мин`).join(' · ')}
          </p>
          <div className={`${adminTableWrap} ${adminBoutsScrollPanel} ${adminBoutsScrollPanelCompact}`}>
            <Table className="min-w-full">
              <thead>
                <tr>
                  <th>Группа</th>
                  <th className="w-20">По умолчанию</th>
                  <th className="w-24">Своя</th>
                </tr>
              </thead>
              <tbody>
                {durationRows.map((row) => (
                  <tr key={row.ageDivisionId}>
                    <td className="text-sm">{row.label}</td>
                    <td className="text-sm text-muted">{row.defaultMinutes}</td>
                    <td>
                      <AdminInputWithUnit
                        unit="мин"
                        className="w-16"
                        type="number"
                        min={AGE_DIVISION_DURATION_MIN}
                        max={AGE_DIVISION_DURATION_MAX}
                        placeholder="—"
                        value={durationOverrides[row.ageDivisionId] ?? ''}
                        error={durationErrors[row.ageDivisionId]}
                        disabled={saving}
                        onChange={(event) =>
                          setDurationOverrides((current) => ({
                            ...current,
                            [row.ageDivisionId]: event.target.value,
                          }))
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
          <div className="mt-4">
            <Button
              type="button"
              variant="secondary"
              className="min-h-10 px-4"
              disabled={saving || !durationsDirty || !durationsValid}
              onClick={() => void saveDurations()}
            >
              Сохранить
            </Button>
          </div>
        </section>
      </div>
    </details>
  )
}
