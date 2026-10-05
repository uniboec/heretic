'use client'

import { useMemo } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { getEffectiveAutoMatAssignMode, type AutoMatAssignMode } from '@/lib/bouts/autoMatMode'
import {
  BOUT_BREAK_MINUTES_MAX,
  BOUT_BREAK_MINUTES_MIN,
  MAT_COUNT_OPTIONS,
} from '@/lib/bouts/settingsLimits'
import type { CompetitionStageSettings } from '@/lib/bouts/competitionStageSettings'
import type { StageTimingSummary } from '@/lib/bouts/scheduleTypes'
import type { MatKey } from '@/lib/bouts/startTimes.types'
import { AdminInputWithUnit } from '@/components/admin/AdminInputWithUnit'
import { AdminLocalTimeInput } from '@/components/admin/AdminLocalTimeInput'
import { AdminBoutsAdvancedSettings } from '@/components/admin/bouts/AdminBoutsAdvancedSettings'
import { AdminBoutsDraftStatus } from '@/components/admin/bouts/AdminBoutsDraftStatus'
import { useSyncedDraft } from '@/components/admin/bouts/useSyncedDraft'
import { validateTimingDraft } from '@/components/admin/bouts/validateBoutsTimingDraft'
import {
  validateAthleteSpacingDraft,
  type AthleteSpacingDraft,
} from '@/components/admin/bouts/validateAthleteSpacingDraft'
import {
  DEFAULT_ENABLED_ATHLETE_PARTICIPATION_SPACING,
  DEFAULT_TIME_ATHLETE_PARTICIPATION_SPACING,
  type AthleteParticipationSpacing,
} from '@/lib/bouts/athleteParticipationSpacing'
import {
  ATHLETE_SPACING_BOUT_COUNT_MAX,
  ATHLETE_SPACING_TIME_MAX_MINUTES,
} from '@/lib/bouts/settingsLimits'
import {
  adminBoutsSettingsBody,
  adminBoutsSettingsFieldGrid,
  adminBoutsSettingsSection,
  adminBoutsSettingsSectionHead,
  adminBoutsSettingsSectionTitle,
  adminBoutsSettingsSegmentTab,
  adminBoutsSettingsSegmentTabs,
  adminPanel,
  adminPanelHeader,
  adminSettingsCheckbox,
} from '@/lib/ui/adminSurfaceStyles'

export type BoutsSettingsSavingSection = 'core' | 'timing' | 'distribution' | 'rules' | 'advanced'

interface AdminBoutsControlsPanelProps {
  publicEnabled: boolean
  matCount: number
  matsEnabled: boolean
  autoMatAssignMode: AutoMatAssignMode
  effectiveAutoMatAssignMode?: AutoMatAssignMode
  autoMatByCategoryEnabled: boolean
  savingSection: BoutsSettingsSavingSection | null
  boutsStartTime: string
  matStartTimeOverrides: Partial<Record<MatKey, string>>
  boutBreakMinutes: number
  athleteParticipationSpacing: AthleteParticipationSpacing
  ageDivisionDurationOverrides: Record<string, number>
  pinAllFinalsToEnd: boolean
  competitionStageSettings: CompetitionStageSettings
  configuredCategoryStages: number[]
  stageSummaries?: StageTimingSummary[]
  onSaveSettings: (
    next: {
      publicEnabled?: boolean
      matCount?: number
      matsEnabled?: boolean
      autoMatAssignMode?: AutoMatAssignMode
      pinAllFinalsToEnd?: boolean
    },
    section: BoutsSettingsSavingSection,
  ) => void | Promise<void>
  onSaveTiming: (
    patch: Record<string, unknown>,
    section: 'timing' | 'advanced',
  ) => Promise<boolean>
}

export function AdminBoutsControlsPanel({
  publicEnabled,
  matCount,
  matsEnabled,
  autoMatAssignMode,
  effectiveAutoMatAssignMode,
  autoMatByCategoryEnabled,
  savingSection,
  boutsStartTime,
  matStartTimeOverrides,
  boutBreakMinutes,
  athleteParticipationSpacing,
  ageDivisionDurationOverrides,
  pinAllFinalsToEnd,
  competitionStageSettings,
  configuredCategoryStages,
  stageSummaries = [],
  onSaveSettings,
  onSaveTiming,
}: AdminBoutsControlsPanelProps) {
  const effectiveMode =
    effectiveAutoMatAssignMode ??
    getEffectiveAutoMatAssignMode({
      autoMatAssignMode,
      autoMatByCategoryEnabled,
    })

  const timingServer = useMemo(
    () => ({ boutsStartTime, boutBreakMinutes }),
    [boutsStartTime, boutBreakMinutes],
  )
  const {
    draft: timingDraft,
    updateDraft: setTimingDraft,
    isDirty: timingDirty,
    acceptServerValue: acceptTiming,
  } = useSyncedDraft(timingServer)

  const spacingServer = useMemo(
    () => athleteParticipationSpacing,
    [athleteParticipationSpacing],
  )
  const {
    draft: spacingDraft,
    updateDraft: setSpacingDraft,
    isDirty: spacingDirty,
    acceptServerValue: acceptSpacing,
  } = useSyncedDraft<AthleteSpacingDraft>(spacingServer)

  const timingErrors = useMemo(() => validateTimingDraft(timingDraft), [timingDraft])
  const spacingErrors = useMemo(() => validateAthleteSpacingDraft(spacingDraft), [spacingDraft])
  const timingValid = Object.keys(timingErrors).length === 0
  const spacingValid = Object.keys(spacingErrors).length === 0
  const spacingUnit = spacingDraft.mode === 'TIME' ? 'мин' : 'слотов'
  const spacingMax =
    spacingDraft.mode === 'TIME'
      ? ATHLETE_SPACING_TIME_MAX_MINUTES
      : ATHLETE_SPACING_BOUT_COUNT_MAX

  const coreSaving = savingSection === 'core'
  const timingSaving = savingSection === 'timing'
  const distributionSaving = savingSection === 'distribution'
  const rulesSaving = savingSection === 'rules'
  const advancedSaving = savingSection === 'advanced'

  function selectBoutDistribution(byTime: boolean) {
    onSaveSettings(
      { autoMatAssignMode: byTime ? 'BY_BOUT_TIME' : 'BY_BOUT' },
      'distribution',
    )
  }

  function selectCategoryDistribution(byTime: boolean) {
    onSaveSettings(
      { autoMatAssignMode: byTime ? 'BY_CATEGORY_TIME' : 'BY_CATEGORY' },
      'distribution',
    )
  }

  async function saveTiming() {
    const ok = await onSaveTiming(
      {
        boutsStartTime: timingDraft.boutsStartTime,
        boutBreakMinutes: timingDraft.boutBreakMinutes,
        athleteParticipationSpacing: spacingDraft,
      },
      'timing',
    )
    if (ok) {
      acceptTiming(timingDraft)
      acceptSpacing(spacingDraft)
    }
  }

  return (
    <section className={`${adminPanel} overflow-hidden`}>
      <div className={adminPanelHeader}>Настройки расписания</div>

      <div className={adminBoutsSettingsBody}>
        <section className={adminBoutsSettingsSection} aria-labelledby="bouts-settings-core">
          <div className={adminBoutsSettingsSectionHead}>
            <h2 id="bouts-settings-core" className={adminBoutsSettingsSectionTitle}>Основное</h2>
          </div>
          <div className={adminBoutsSettingsFieldGrid}>
            <div>
              <p className="mb-2 text-sm font-medium text-foreground">Ковров</p>
              <div className={adminBoutsSettingsSegmentTabs} role="group" aria-label="Ковров">
                {MAT_COUNT_OPTIONS.map((value) => (
                  <Button
                    key={value}
                    type="button"
                    variant="ghost"
                    disabled={coreSaving}
                    className={adminBoutsSettingsSegmentTab(matCount === value)}
                    onClick={() => onSaveSettings({ matCount: value }, 'core')}
                  >
                    {value}
                  </Button>
                ))}
              </div>
            </div>
            <label className={adminSettingsCheckbox}>
              <input
                type="checkbox"
                checked={matsEnabled}
                disabled={coreSaving}
                onChange={(event) =>
                  onSaveSettings({ matsEnabled: event.target.checked }, 'core')
                }
              />
              <span>
                Номера с префиксом ковра
                <span className="mt-0.5 block text-xs font-normal text-muted">
                  Если выключено, публичная нумерация идёт без префикса (1, 2, 3…).
                </span>
              </span>
            </label>
          </div>
        </section>

        <section className={adminBoutsSettingsSection} aria-labelledby="bouts-settings-timing">
          <div className={adminBoutsSettingsSectionHead}>
            <h2 id="bouts-settings-timing" className={adminBoutsSettingsSectionTitle}>Время и паузы</h2>
            <AdminBoutsDraftStatus saving={timingSaving} isDirty={timingDirty || spacingDirty} />
          </div>
          <div className={adminBoutsSettingsFieldGrid}>
            <AdminLocalTimeInput
              label="Начало"
              className="w-28"
              value={timingDraft.boutsStartTime}
              error={timingErrors.boutsStartTime}
              disabled={timingSaving}
              onChange={(value) =>
                setTimingDraft((current) => ({ ...current, boutsStartTime: value }))
              }
            />
            <AdminInputWithUnit
              label="Пауза между поединками"
              unit="мин"
              className="w-20"
              type="number"
              min={BOUT_BREAK_MINUTES_MIN}
              max={BOUT_BREAK_MINUTES_MAX}
              value={timingDraft.boutBreakMinutes}
              error={timingErrors.boutBreakMinutes}
              disabled={timingSaving}
              onChange={(event) =>
                setTimingDraft((current) => ({
                  ...current,
                  boutBreakMinutes: Number(event.target.value),
                }))
              }
            />
          </div>

          <div className="mt-6 space-y-4 border-t border-border pt-4">
            <label className={adminSettingsCheckbox}>
              <Input
                controlOnly
                type="checkbox"
                className="w-auto min-h-0 shrink-0 border-0 bg-transparent p-0 shadow-none"
                checked={spacingDraft.enabled}
                disabled={timingSaving}
                onChange={(event) =>
                  setSpacingDraft((current) =>
                    event.target.checked
                      ? {
                          ...current,
                          enabled: true,
                          mode: 'BOUT_COUNT',
                          regular: DEFAULT_ENABLED_ATHLETE_PARTICIPATION_SPACING.regular,
                          medal: DEFAULT_ENABLED_ATHLETE_PARTICIPATION_SPACING.medal,
                        }
                      : { ...current, enabled: false },
                  )
                }
              />
              <span>Интервал между участиями спортсмена</span>
            </label>

            {spacingDraft.enabled ? (
              <>
                <div>
                  <p className="mb-2 text-sm font-medium text-foreground">Режим интервала</p>
                  <div className={adminBoutsSettingsSegmentTabs} role="group">
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={timingSaving}
                      className={adminBoutsSettingsSegmentTab(spacingDraft.mode === 'BOUT_COUNT')}
                      onClick={() =>
                        setSpacingDraft((current) => ({
                          ...current,
                          mode: 'BOUT_COUNT',
                          regular: DEFAULT_ENABLED_ATHLETE_PARTICIPATION_SPACING.regular,
                          medal: DEFAULT_ENABLED_ATHLETE_PARTICIPATION_SPACING.medal,
                        }))
                      }
                    >
                      По количеству слотов
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={timingSaving}
                      className={adminBoutsSettingsSegmentTab(spacingDraft.mode === 'TIME')}
                      onClick={() =>
                        setSpacingDraft((current) => ({
                          ...current,
                          mode: 'TIME',
                          regular: DEFAULT_TIME_ATHLETE_PARTICIPATION_SPACING.regular,
                          medal: DEFAULT_TIME_ATHLETE_PARTICIPATION_SPACING.medal,
                        }))
                      }
                    >
                      По времени
                    </Button>
                  </div>
                </div>
                <div className={adminBoutsSettingsFieldGrid}>
                  <AdminInputWithUnit
                    label="Обычные поединки"
                    unit={spacingUnit}
                    className="w-24"
                    type="number"
                    min={spacingDraft.mode === 'TIME' ? 1 : 2}
                    max={spacingMax}
                    value={spacingDraft.regular}
                    error={spacingErrors.regular}
                    disabled={timingSaving}
                    onChange={(event) =>
                      setSpacingDraft((current) => ({
                        ...current,
                        regular: Number(event.target.value),
                      }))
                    }
                  />
                  <AdminInputWithUnit
                    label="Медальные поединки"
                    unit={spacingUnit}
                    className="w-24"
                    type="number"
                    min={spacingDraft.mode === 'TIME' ? 1 : 5}
                    max={spacingMax}
                    value={spacingDraft.medal}
                    error={spacingErrors.medal}
                    disabled={timingSaving}
                    onChange={(event) =>
                      setSpacingDraft((current) => ({
                        ...current,
                        medal: Number(event.target.value),
                      }))
                    }
                  />
                </div>
                <p className="text-xs text-muted">
                  Учитываются все ковры и дисциплины. Параллельные бои на разных коврах считаются
                  одним слотом. Система автоматически поддерживает порядок очереди.
                </p>
              </>
            ) : null}
          </div>

          <div className="mt-4">
            <Button
              type="button"
              variant="secondary"
              className="min-h-10 px-4"
              disabled={timingSaving || (!timingDirty && !spacingDirty) || !timingValid || !spacingValid}
              onClick={() => void saveTiming()}
            >
              Сохранить
            </Button>
          </div>
        </section>

        <section className={adminBoutsSettingsSection} aria-labelledby="bouts-settings-distribution">
          <div className={adminBoutsSettingsSectionHead}>
            <h2 id="bouts-settings-distribution" className={adminBoutsSettingsSectionTitle}>
              Распределение по коврам
            </h2>
          </div>
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-sm font-medium text-foreground">Поединки по коврам</p>
              <div
                className={adminBoutsSettingsSegmentTabs}
                role="group"
                aria-label="Поединки по коврам"
              >
                <Button
                  type="button"
                  variant="ghost"
                  disabled={distributionSaving}
                  className={adminBoutsSettingsSegmentTab(effectiveMode === 'BY_BOUT')}
                  onClick={() => selectBoutDistribution(false)}
                >
                  По количеству
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={distributionSaving}
                  className={adminBoutsSettingsSegmentTab(effectiveMode === 'BY_BOUT_TIME')}
                  onClick={() => selectBoutDistribution(true)}
                >
                  По времени
                </Button>
              </div>
            </div>

            {autoMatByCategoryEnabled ? (
              <div>
                <p className="mb-2 text-sm font-medium text-foreground">Категории целиком по коврам</p>
                <div
                  className={adminBoutsSettingsSegmentTabs}
                  role="group"
                  aria-label="Категории целиком по коврам"
                >
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={distributionSaving}
                    className={adminBoutsSettingsSegmentTab(effectiveMode === 'BY_CATEGORY')}
                    onClick={() => selectCategoryDistribution(false)}
                  >
                    По количеству
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={distributionSaving}
                    className={adminBoutsSettingsSegmentTab(effectiveMode === 'BY_CATEGORY_TIME')}
                    onClick={() => selectCategoryDistribution(true)}
                  >
                    По времени
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted">Доступно распределение только отдельных поединков.</p>
            )}
          </div>
        </section>

        <section className={adminBoutsSettingsSection} aria-labelledby="bouts-settings-rules">
          <div className={adminBoutsSettingsSectionHead}>
            <h2 id="bouts-settings-rules" className={adminBoutsSettingsSectionTitle}>Правила проведения</h2>
          </div>
          <div className="flex flex-col gap-3">
            <label className={adminSettingsCheckbox}>
              <Input
                controlOnly
                type="checkbox"
                className="w-auto min-h-0 shrink-0 border-0 bg-transparent p-0 shadow-none"
                checked={pinAllFinalsToEnd}
                disabled={rulesSaving}
                onChange={(event) =>
                  onSaveSettings({ pinAllFinalsToEnd: event.target.checked }, 'rules')
                }
              />
              <span>Финалы в конце ковра</span>
            </label>
            <label className={adminSettingsCheckbox}>
              <Input
                controlOnly
                type="checkbox"
                className="w-auto min-h-0 shrink-0 border-0 bg-transparent p-0 shadow-none"
                checked={publicEnabled}
                disabled={rulesSaving}
                onChange={(event) =>
                  onSaveSettings({ publicEnabled: event.target.checked }, 'rules')
                }
              />
              <span>Публичная страница «Поединки»</span>
            </label>
          </div>
        </section>

        <AdminBoutsAdvancedSettings
          matCount={matCount}
          boutsStartTime={boutsStartTime}
          matStartTimeOverrides={matStartTimeOverrides}
          ageDivisionDurationOverrides={ageDivisionDurationOverrides}
          competitionStageSettings={competitionStageSettings}
          configuredCategoryStages={configuredCategoryStages}
          stageSummaries={stageSummaries}
          saving={advancedSaving}
          onSave={(patch) => onSaveTiming(patch, 'advanced')}
        />
      </div>
    </section>
  )
}
